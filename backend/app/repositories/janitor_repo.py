"""
Janitor Repository — asyncpg implementation.

All database CRUD for the ``janitors`` table.  JOIN with profiles where
caller needs display fields (full_name, avatar_url).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db.pool import get_pool


async def get_by_id(janitor_id: str) -> dict | None:
    """Fetch a single janitor with joined profile fields.

    Returns:
        Janitor dict with ``full_name`` and ``avatar_url`` from profiles, or None.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT j.*, p.full_name, p.avatar_url, p.email, p.phone
            FROM janitors j
            JOIN profiles p ON p.id = j.id
            WHERE j.id = $1
            """,
            uuid.UUID(str(janitor_id)),
        )
    return dict(row) if row else None


async def get_available(service_type: str | None = None, limit: int = 50) -> list[dict]:
    """Fetch available, verified janitors (bounded to *limit* rows).

    Capped at 50 by default — dispatch only needs the best candidates,
    not every janitor in the system.  Ordered by rating DESC so the
    highest-quality janitors are always included within the cap.

    Args:
        service_type: Optional filter — only janitors offering this service
                      (matched via Postgres ``ANY`` array operator).
        limit: Maximum rows to return (default 50).

    Returns:
        List of janitor dicts with joined profile fields.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        if service_type:
            rows = await conn.fetch(
                """
                SELECT j.*, p.full_name, p.avatar_url
                FROM janitors j
                JOIN profiles p ON p.id = j.id
                WHERE j.availability = TRUE
                  AND j.is_verified = TRUE
                  AND $1 = ANY(j.service_types)
                ORDER BY j.avg_rating DESC, j.created_at DESC
                LIMIT $2
                """,
                service_type,
                limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT j.*, p.full_name, p.avatar_url
                FROM janitors j
                JOIN profiles p ON p.id = j.id
                WHERE j.availability = TRUE
                  AND j.is_verified = TRUE
                ORDER BY j.avg_rating DESC, j.created_at DESC
                LIMIT $1
                """,
                limit,
            )
    return [dict(r) for r in rows]


async def update_availability(janitor_id: str, available: bool) -> dict | None:
    """Toggle a janitor's availability status.

    Returns:
        Updated janitor dict or None if not found.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE janitors SET availability = $2 WHERE id = $1 RETURNING *",
            uuid.UUID(str(janitor_id)),
            available,
        )
    return dict(row) if row else None


async def update_trust_score(janitor_id: str, score: float, tier: str) -> dict | None:
    """Update a janitor's trust score and tier.

    Returns:
        Updated janitor dict or None.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE janitors SET trust_score = $2, trust_tier = $3 WHERE id = $1 RETURNING *",
            uuid.UUID(str(janitor_id)),
            score,
            tier,
        )
    return dict(row) if row else None


async def get_recent_job_count(janitor_id: str, days: int = 7) -> int:
    """Count completed jobs for a janitor in the last *days* days."""
    pool = get_pool()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    async with pool.acquire() as conn:
        count = await conn.fetchval(
            """
            SELECT COUNT(*) FROM jobs
            WHERE janitor_id = $1
              AND status = 'completed'
              AND created_at >= $2
            """,
            uuid.UUID(str(janitor_id)),
            cutoff,
        )
    return int(count or 0)


async def get_recent_job_counts_batch(
    janitor_ids: list[str], days: int = 7
) -> dict[str, int]:
    """Batch version of get_recent_job_count — one query for N janitors.

    Replaces the N+1 loop in the dispatch flow: instead of one query per
    janitor, a single GROUP BY returns counts for all of them at once.

    Args:
        janitor_ids: List of janitor UUID strings.
        days: Look-back window in days (default 7).

    Returns:
        Dict mapping janitor_id (str) → completed job count.
        Janitors with zero completed jobs are not present in the dict
        (callers should use ``counts.get(jid, 0)``).
    """
    if not janitor_ids:
        return {}
    pool = get_pool()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    uuids = [uuid.UUID(str(jid)) for jid in janitor_ids]
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT janitor_id, COUNT(*) AS job_count
            FROM jobs
            WHERE janitor_id = ANY($1)
              AND status = 'completed'
              AND created_at >= $2
            GROUP BY janitor_id
            """,
            uuids,
            cutoff,
        )
    return {str(r["janitor_id"]): int(r["job_count"]) for r in rows}
