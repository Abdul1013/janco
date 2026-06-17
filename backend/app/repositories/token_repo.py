"""
Refresh Token Repository.

Implements server-side token rotation with reuse detection:

* store_refresh_token  — persist a new token (bcrypt-hashed)
* consume_refresh_token — validate, revoke (rotation), detect reuse
* revoke_all_for_user  — invalidate every session (logout / password change)

Security properties
-------------------
* Raw token strings are never stored; only their bcrypt hashes.
* Reuse detection: if a revoked token is presented again, the entire
  rotation family is immediately invalidated, forcing re-login.
* Token families tie all rotated tokens for a single login session together.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.db.pool import get_pool
from app.utils.security import hash_refresh_token


async def store_refresh_token(
    user_id: str,
    raw_token: str,
    family_id: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Hash *raw_token* and persist it in the refresh_tokens table."""
    pool = get_pool()
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    token_hash = hash_refresh_token(raw_token)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO refresh_tokens
              (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            uuid.UUID(str(user_id)),
            token_hash,
            uuid.UUID(str(family_id)),
            expires_at,
            user_agent,
            ip_address,
        )


async def consume_refresh_token(raw_token: str) -> dict | None:
    """Find, verify, and rotate a refresh token — race-condition safe.

    Uses a single transaction with SELECT FOR UPDATE so that two
    concurrent requests presenting the same token cannot both succeed:

      Request A: SELECT FOR UPDATE → locks row → proceeds to revoke
      Request B: SELECT FOR UPDATE → blocks until A commits
                 A's commit sets revoked_at → B sees revoked row → reuse
                 attack path → family revoked → returns None

    Steps:
    1. SHA-256 hash the raw token (deterministic, same as store-time).
    2. Open transaction: SELECT FOR UPDATE on the token row.
    3a. Row found, revoked_at IS NOT NULL → reuse attack → revoke family.
    3b. Row found, revoked_at IS NULL → valid → revoke, return row.
    4. Row not found (no match / expired) → return None.

    Returns:
        The matched row dict, or None if invalid / expired / reuse.
    """
    pool = get_pool()
    token_hash = hash_refresh_token(raw_token)

    async with pool.acquire() as conn:
        async with conn.transaction():
            # FOR UPDATE ensures concurrent requests with the same token
            # serialise here — the second request blocks until the first
            # commits, then sees revoked_at is set and returns None.
            row = await conn.fetchrow(
                """
                SELECT id, user_id, token_hash, family_id, revoked_at
                FROM refresh_tokens
                WHERE token_hash = $1 AND expires_at > NOW()
                FOR UPDATE
                """,
                token_hash,
            )

            if not row:
                return None

            matched = dict(row)

            if matched["revoked_at"] is not None:
                # Reuse attack — this token was already consumed.
                # Invalidate the entire rotation family to force re-login.
                await conn.execute(
                    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1",
                    matched["family_id"],
                )
                return None

            # Valid single-use token — revoke it (rotation; caller issues new one)
            await conn.execute(
                "UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1",
                matched["id"],
            )
            return matched


async def revoke_all_for_user(user_id: str) -> None:
    """Invalidate every active refresh token for *user_id* (logout / password change)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE refresh_tokens
            SET revoked_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL
            """,
            uuid.UUID(str(user_id)),
        )
