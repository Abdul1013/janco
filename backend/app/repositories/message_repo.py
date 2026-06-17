"""
Message Repository — asyncpg implementation.

All database CRUD for the ``messages`` table (in-app chat).
Cursor-based pagination keeps large chat histories efficient.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.db.pool import get_pool


async def create_message(job_id: str, sender_id: str, content: str) -> dict:
    """Insert a new chat message.

    Args:
        job_id: The job this message belongs to.
        sender_id: The user sending the message.
        content: Message text.

    Returns:
        The created message row.
    """
    pool = get_pool()
    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO messages (job_id, sender_id, content, created_at)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            uuid.UUID(str(job_id)),
            uuid.UUID(str(sender_id)),
            content,
            now,
        )
    return dict(row) if row else {}


async def get_messages(
    job_id: str,
    cursor: str | None = None,
    limit: int = 50,
) -> dict:
    """Fetch paginated messages for a job (newest first).

    Args:
        job_id: The job whose messages to fetch.
        cursor: ISO timestamp — fetch messages *older* than this point.
        limit: Max messages to return.

    Returns:
        Dict with ``messages`` list (chronological order) and ``has_more`` flag.
    """
    pool = get_pool()
    fetch_limit = limit + 1  # one extra to detect has_more

    async with pool.acquire() as conn:
        if cursor:
            rows = await conn.fetch(
                """
                SELECT * FROM messages
                WHERE job_id = $1 AND created_at < $2
                ORDER BY created_at DESC
                LIMIT $3
                """,
                uuid.UUID(str(job_id)),
                datetime.fromisoformat(cursor),
                fetch_limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM messages
                WHERE job_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                uuid.UUID(str(job_id)),
                fetch_limit,
            )

    messages = [dict(r) for r in rows]
    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    # Return in chronological order (oldest first) for display
    messages.reverse()

    return {"messages": messages, "has_more": has_more}
