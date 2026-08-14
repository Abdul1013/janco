"""
User / Profile Repository — asyncpg implementation.

All database CRUD for the ``profiles`` table.  No business logic —
that belongs in services.  Every function returns raw data dicts
or raises on failure.
"""

from __future__ import annotations

import uuid
from typing import Any

from app.db.pool import get_pool


async def create_profile(user_id: str, data: dict[str, Any]) -> dict:
    """Insert a new profile row.

    Args:
        user_id: New user's UUID.
        data: Profile fields (email, full_name, role, password_hash, etc.).

    Returns:
        The created profile row as a dict.
    """
    pool = get_pool()
    cols = ["id"] + list(data.keys())
    vals: list[Any] = [uuid.UUID(str(user_id))] + list(data.values())
    placeholders = ", ".join(f"${i + 1}" for i in range(len(vals)))
    col_names = ", ".join(cols)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO profiles ({col_names}) VALUES ({placeholders}) RETURNING *",
            *vals,
        )
    return dict(row) if row else {}


async def get_profile(user_id: str) -> dict | None:
    """Fetch a single active profile by user ID.

    Deleted accounts are intentionally hidden from normal profile reads.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            # Never return the hash to callers — strip it here
            "SELECT id, email, full_name, phone, avatar_url, role, address, "
            "landmark, lat, lng, push_token, is_registered, created_at, deleted_at "
            "FROM profiles WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE",
            uuid.UUID(str(user_id)),
        )
    return dict(row) if row else None


async def get_recipients(audience: str) -> list[dict]:
    """Return broadcast recipients for an audience segment.

    Args:
        audience: 'all_customers' | 'all_janitors' | 'all_users'.

    Returns:
        List of {id, email, full_name, push_token} for active accounts only.
    """
    role_filter = {
        "all_customers": "AND role = 'customer'",
        "all_janitors": "AND role = 'janitor'",
        "all_users": "AND role IN ('customer','janitor')",
    }.get(audience)
    if role_filter is None:
        return []

    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT id::text, email, full_name, push_token
            FROM profiles
            WHERE is_active = TRUE {role_filter}
            """
        )
    return [dict(r) for r in rows]


async def get_recipient(user_id: str) -> dict | None:
    """Return a single broadcast recipient by id (active accounts only)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id::text, email, full_name, push_token "
            "FROM profiles WHERE id = $1 AND is_active = TRUE",
            uuid.UUID(str(user_id)),
        )
    return dict(row) if row else None


async def update_profile(user_id: str, data: dict[str, Any]) -> dict | None:
    """Update profile fields.

    Args:
        user_id: Primary key.
        data: Fields to update (only non-None keys should be passed).

    Returns:
        Updated profile dict or None if not found.
    """
    pool = get_pool()
    set_clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(data.keys()))
    vals: list[Any] = [uuid.UUID(str(user_id))] + list(data.values())
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"UPDATE profiles SET {set_clauses} WHERE id = $1 AND deleted_at IS NULL RETURNING "
            "id, email, full_name, phone, avatar_url, role, address, "
            "landmark, lat, lng, push_token, is_registered, created_at",
            *vals,
        )
    return dict(row) if row else None


async def anonymize_profile(user_id: str) -> bool:
    """Permanently remove direct identifiers from a user profile.

    This is the privacy-safe baseline for a standard account-deletion flow.
    It preserves the record key for auditability while removing personal data.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE profiles
            SET email = $2,
                full_name = 'Deleted User',
                phone = NULL,
                avatar_url = NULL,
                address = NULL,
                landmark = NULL,
                lat = NULL,
                lng = NULL,
                push_token = NULL,
                is_registered = FALSE,
                password_hash = NULL,
                is_active = FALSE,
                deleted_at = COALESCE(deleted_at, NOW()),
                anonymized_at = COALESCE(anonymized_at, NOW())
            WHERE id = $1 AND deleted_at IS NULL
            """,
            uuid.UUID(str(user_id)),
            f"deleted+{user_id}@janco.app",
        )
    return bool(result)
