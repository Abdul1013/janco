"""
Auth Service.

Owns the full authentication lifecycle — signup, login, token refresh,
logout, and password update.  No Supabase dependency; uses asyncpg
directly for credential lookups and delegates to token_repo for
refresh-token management.

All sensitive operations (password compare, token verify) are done in
utils/security.py so the logic stays here at a business level.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

import asyncio

from app.config import settings
from app.db.pool import get_pool
from app.repositories import token_repo, user_repo
from app.services import email_service
from app.utils.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    verify_password,
)

# Password reset token expiry
RESET_TOKEN_EXPIRE_MINUTES = 30


async def signup(
    email: str,
    password: str,
    full_name: str,
    accepted_terms: bool = False,
) -> dict:
    """Create a new user account.

    Args:
        email: Must be unique.
        password: Plain-text — bcrypt-hashed before storage.
        full_name: Display name.
        accepted_terms: Whether the user accepted the Terms & Privacy Policy.
            Acceptance is also enforced at the schema layer; stored here with a
            timestamp + version for audit.

    Returns:
        Dict with ``user_id``, ``access_token``, ``refresh_token``.

    Raises:
        HTTPException 409: Email already registered.
        HTTPException 400: Terms not accepted.
    """
    if not accepted_terms:
        raise HTTPException(
            status_code=400,
            detail="You must accept the Terms & Conditions and Privacy Policy.",
        )

    pool = get_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchval(
            "SELECT id FROM profiles WHERE email = $1", email
        )
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered.")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)

    await user_repo.create_profile(user_id, {
        "email": email,
        "full_name": full_name,
        "role": "customer",
        "password_hash": pw_hash,
        "terms_accepted_at": datetime.now(timezone.utc),
        "terms_version": settings.LEGAL_VERSION,
    })

    access_token = create_access_token(user_id, "customer")
    raw_refresh = generate_refresh_token()
    family_id = str(uuid.uuid4())
    await token_repo.store_refresh_token(user_id, raw_refresh, family_id)

    return {
        "message": "Account created successfully.",
        "user_id": user_id,
        "access_token": access_token,
        "refresh_token": raw_refresh,
    }


async def login(email: str, password: str) -> dict:
    """Authenticate with email and password.

    Returns:
        Dict with ``access_token``, ``refresh_token``, and ``user`` profile.

    Raises:
        HTTPException 401: Invalid credentials (generic message — no enumeration).
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, password_hash, role, is_active, admin_level FROM profiles WHERE email = $1", email
        )

    # Constant-time comparison — verify_password handles this via bcrypt
    if not row or not row["password_hash"] or not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    # Check account suspension (is_active defaults True for legacy rows without the column)
    if not row.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")

    user_id = str(row["id"])
    role = row["role"] or "customer"
    admin_level = row["admin_level"]

    profile = await user_repo.get_profile(user_id)

    access_token = create_access_token(user_id, role, admin_level)
    raw_refresh = generate_refresh_token()
    family_id = str(uuid.uuid4())
    await token_repo.store_refresh_token(user_id, raw_refresh, family_id)

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "user": profile,
    }


async def refresh(raw_refresh_token: str) -> dict:
    """Issue new tokens by consuming a valid refresh token (rotation).

    Returns:
        Dict with new ``access_token`` and ``refresh_token``.

    Raises:
        HTTPException 401: Token invalid, expired, or reuse detected.
    """
    consumed = await token_repo.consume_refresh_token(raw_refresh_token)
    if not consumed:
        raise HTTPException(
            status_code=401,
            detail="Refresh token is invalid or expired. Please log in again.",
        )

    user_id = str(consumed["user_id"])
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT role, admin_level FROM profiles WHERE id = $1", uuid.UUID(user_id)
        )

    role = row["role"] if row else "customer"
    admin_level = row["admin_level"] if row else None
    new_access = create_access_token(user_id, role, admin_level)
    new_raw_refresh = generate_refresh_token()

    # Issue new refresh token in the same rotation family
    await token_repo.store_refresh_token(
        user_id, new_raw_refresh, str(consumed["family_id"])
    )

    return {
        "access_token": new_access,
        "refresh_token": new_raw_refresh,
    }


async def logout(user_id: str) -> dict:
    """Invalidate all refresh tokens for this user (all devices)."""
    await token_repo.revoke_all_for_user(user_id)
    return {"message": "Logged out successfully."}


async def request_password_reset(email: str) -> dict:
    """Generate a password reset token and send it via email.

    In beta, the token is returned in the response (no email service).
    In production, this would dispatch an email via SendGrid/SES.

    The response is always 200 to prevent email enumeration.

    Args:
        email: The user's registered email address.

    Returns:
        Success message (always, even if email doesn't exist).
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM profiles WHERE email = $1", email
        )

    if not row:
        # Don't reveal whether email exists — prevent enumeration
        return {"message": "If an account with that email exists, a reset link has been sent."}

    user_id = str(row["id"])

    # Generate a secure reset token
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)

    # Invalidate any existing unused reset tokens for this user
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
            uuid.UUID(user_id),
        )
        await conn.execute(
            """INSERT INTO password_resets (user_id, token_hash, expires_at)
               VALUES ($1, $2, $3)""",
            uuid.UUID(user_id),
            token_hash,
            expires_at,
        )

    # Send the reset email (fire-and-forget — does not block the response)
    asyncio.create_task(
        email_service.send_password_reset(email=email, raw_token=raw_token)
    )

    return {
        "message": "If an account with that email exists, a reset link has been sent.",
    }


async def confirm_password_reset(token: str, new_password: str) -> dict:
    """Verify a reset token and update the user's password.

    Race-condition safe: the token row is locked with SELECT FOR UPDATE
    inside a single transaction so concurrent reset requests with the
    same token cannot both pass validation.

    bcrypt hashing is intentionally performed BEFORE acquiring the lock
    so we hold the row lock for only microseconds, not ~300 ms.

    Args:
        token: Raw reset token from the email link.
        new_password: New password to set.

    Returns:
        Success message.

    Raises:
        HTTPException 400: Token invalid, expired, or already used.
    """
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    pool = get_pool()

    # Hash the password BEFORE taking the DB lock — bcrypt is ~300 ms and
    # we must not hold a row lock during CPU-bound work.
    pw_hash = hash_password(new_password)

    async with pool.acquire() as conn:
        async with conn.transaction():
            # FOR UPDATE locks the row; concurrent requests with the same token
            # block here until the first request commits and marks it used.
            row = await conn.fetchrow(
                """SELECT id, user_id, expires_at, used_at
                   FROM password_resets
                   WHERE token_hash = $1
                   FOR UPDATE""",
                token_hash,
            )

            if not row:
                raise HTTPException(
                    status_code=400, detail="Invalid or expired reset token."
                )

            if row["used_at"] is not None:
                raise HTTPException(
                    status_code=400,
                    detail="This reset token has already been used.",
                )

            if row["expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=400,
                    detail="Reset token has expired. Please request a new one.",
                )

            user_id = str(row["user_id"])

            # Atomically update password and mark token consumed
            await conn.execute(
                "UPDATE profiles SET password_hash = $1 WHERE id = $2",
                pw_hash,
                uuid.UUID(user_id),
            )
            await conn.execute(
                "UPDATE password_resets SET used_at = NOW() WHERE id = $1",
                row["id"],
            )

    # Revoke all refresh tokens — force re-login on all devices
    await token_repo.revoke_all_for_user(user_id)

    return {"message": "Password has been reset successfully. Please log in with your new password."}


async def update_password(user_id: str, new_password: str) -> dict:
    """Change password and revoke all existing sessions.

    Revoking sessions forces re-login on every device — intentional
    security behaviour after a password change.
    """
    pw_hash = hash_password(new_password)
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE profiles SET password_hash = $1 WHERE id = $2",
            pw_hash,
            uuid.UUID(user_id),
        )
    await token_repo.revoke_all_for_user(user_id)
    return {"message": "Password updated. Please log in again on all devices."}
