"""
Security Utilities — password hashing and JWT token lifecycle.

This is the ONLY place PyJWT and bcrypt are used.  All token creation,
verification, and password operations must go through these helpers.

Algorithms
----------
* Passwords    — bcrypt cost 12 (low-entropy input, brute-force protection needed)
* Access JWT   — HS256 with a 32-byte random secret from settings
* Refresh token — 64-byte cryptographically secure random string;
                  SHA-256 hashed before DB storage.
                  bcrypt is NOT used here because bcrypt has a 72-byte input limit
                  and refresh tokens are already high-entropy random values that
                  don't benefit from bcrypt's key-stretching.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt  # PyJWT

from app.config import settings


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain* (cost 12)."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches the stored bcrypt *hashed*."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Access token (short-lived JWT, HS256)
# ---------------------------------------------------------------------------

def create_access_token(user_id: str, role: str, admin_level: str | None = None) -> str:
    """Issue a signed access token valid for ACCESS_TOKEN_EXPIRE_MINUTES.

    Args:
        admin_level: For admin accounts, the sub-tier ('super_admin' | 'admin' |
            'viewer') used for fine-grained dashboard authorization. None for
            non-admin accounts.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "admin_level": admin_level,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": str(uuid.uuid4()),  # unique ID — enables per-token revocation later
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT access token.

    Raises:
        jwt.ExpiredSignatureError: Token has expired.
        jwt.InvalidTokenError:     Any other JWT validation failure.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["exp", "sub", "iat"]},
    )


# ---------------------------------------------------------------------------
# Refresh token (opaque random string — hashed in DB)
# ---------------------------------------------------------------------------

def generate_refresh_token() -> str:
    """Return a 64-byte cryptographically secure URL-safe string."""
    return secrets.token_urlsafe(64)  # 512 bits of entropy


def hash_refresh_token(raw: str) -> str:
    """SHA-256 hash a raw refresh token for safe DB storage.

    Refresh tokens are 512-bit random strings — they don't need bcrypt's
    key-stretching (that's for low-entropy passwords).  SHA-256 is fast,
    has no byte-length limit, and is sufficient for high-entropy tokens.
    """
    return hashlib.sha256(raw.encode()).hexdigest()


def verify_refresh_token(raw: str, hashed: str) -> bool:
    """Return True if the raw token matches its SHA-256 hash (constant-time)."""
    return hmac.compare_digest(hashlib.sha256(raw.encode()).hexdigest(), hashed)
