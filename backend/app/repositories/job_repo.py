"""
Job Repository — asyncpg implementation.

All database CRUD for the ``jobs`` table.  Status transitions are
validated here using the enum defined in schema/job_schema.py.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.db.pool import get_pool
from app.db.redis import get_redis
from app.schema.job_schema import JobStatus, VALID_TRANSITIONS

_ADMIN_STATS_CACHE_KEY = "janco:admin_stats"


async def create_job(data: dict[str, Any]) -> dict:
    """Insert a new job row.

    Args:
        data: Job fields (user_id, service_type, rooms, etc.).

    Returns:
        The created job row.

    Raises:
        HTTPException 400: If the insert returns no data.
    """
    data.setdefault("status", JobStatus.PENDING.value)
    data.setdefault("payment_status", "unpaid")
    data.setdefault("created_at", datetime.now(timezone.utc))

    pool = get_pool()
    cols = list(data.keys())
    vals: list[Any] = []
    for k, v in data.items():
        if k in ("user_id", "janitor_id") and isinstance(v, str):
            vals.append(uuid.UUID(str(v)))
        else:
            vals.append(v)
    placeholders = ", ".join(f"${i + 1}" for i in range(len(vals)))
    col_names = ", ".join(cols)

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"INSERT INTO jobs ({col_names}) VALUES ({placeholders}) RETURNING *",
            *vals,
        )
    if not row:
        raise HTTPException(status_code=400, detail="Failed to create job.")
    return dict(row)


async def get_job(job_id: str) -> dict | None:
    """Fetch a single job by ID.

    Returns:
        Job dict or None.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM jobs WHERE id = $1", uuid.UUID(str(job_id))
        )
    return dict(row) if row else None


async def get_user_jobs(
    user_id: str,
    status_filter: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    """Fetch paginated jobs for a user.

    Returns:
        Dict with ``jobs`` list, ``count``, ``page``, ``limit``.
    """
    pool = get_pool()
    offset = (page - 1) * limit

    async with pool.acquire() as conn:
        if status_filter:
            rows = await conn.fetch(
                """
                SELECT *, COUNT(*) OVER() AS total_count
                FROM jobs
                WHERE user_id = $1 AND status = $2
                ORDER BY created_at DESC
                LIMIT $3 OFFSET $4
                """,
                uuid.UUID(str(user_id)),
                status_filter,
                limit,
                offset,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT *, COUNT(*) OVER() AS total_count
                FROM jobs
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
                """,
                uuid.UUID(str(user_id)),
                limit,
                offset,
            )

    jobs = [dict(r) for r in rows]
    total = int(jobs[0]["total_count"]) if jobs else 0
    # Strip the window-function column from each row
    for j in jobs:
        j.pop("total_count", None)

    return {"jobs": jobs, "count": total, "page": page, "limit": limit}


async def get_janitor_jobs(
    janitor_id: str,
    status_filter: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> dict:
    """Fetch paginated jobs assigned to a janitor, joined with customer profile.

    Returns:
        Dict with ``jobs`` list (including ``customer_name``, ``customer_phone``),
        ``count``, ``page``, ``limit``.
    """
    pool = get_pool()
    offset = (page - 1) * limit

    async with pool.acquire() as conn:
        if status_filter:
            rows = await conn.fetch(
                """
                SELECT j.*, p.full_name AS customer_name, p.phone AS customer_phone,
                       COUNT(*) OVER() AS total_count
                FROM jobs j
                JOIN profiles p ON p.id = j.user_id
                WHERE j.janitor_id = $1 AND j.status = $2
                ORDER BY j.created_at DESC
                LIMIT $3 OFFSET $4
                """,
                uuid.UUID(str(janitor_id)),
                status_filter,
                limit,
                offset,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT j.*, p.full_name AS customer_name, p.phone AS customer_phone,
                       COUNT(*) OVER() AS total_count
                FROM jobs j
                JOIN profiles p ON p.id = j.user_id
                WHERE j.janitor_id = $1
                ORDER BY j.created_at DESC
                LIMIT $2 OFFSET $3
                """,
                uuid.UUID(str(janitor_id)),
                limit,
                offset,
            )

    jobs = [dict(r) for r in rows]
    total = int(jobs[0]["total_count"]) if jobs else 0
    for j in jobs:
        j.pop("total_count", None)

    return {"jobs": jobs, "count": total, "page": page, "limit": limit}


async def update_status(job_id: str, new_status: str) -> dict:
    """Update a job's status with transition validation.

    Raises:
        HTTPException 400: Invalid transition.
        HTTPException 404: Job not found.
    """
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    current = JobStatus(job["status"])
    target = JobStatus(new_status)

    if target not in VALID_TRANSITIONS.get(current, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition: {current.value} → {target.value}",
        )

    update_data: dict[str, Any] = {"status": target.value}
    if target == JobStatus.COMPLETED:
        update_data["completed_at"] = datetime.now(timezone.utc)

    pool = get_pool()
    set_clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(update_data.keys()))
    vals: list[Any] = [uuid.UUID(str(job_id))] + list(update_data.values())

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            f"UPDATE jobs SET {set_clauses} WHERE id = $1 RETURNING *",
            *vals,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Update failed.")

    # Invalidate admin stats cache — status change makes cached KPIs stale
    r = get_redis()
    if r is not None:
        try:
            await r.delete(_ADMIN_STATS_CACHE_KEY)
        except Exception:
            pass  # Cache miss on next request is fine

    return dict(row)


async def assign_janitor(job_id: str, janitor_id: str) -> dict:
    """Assign a janitor to a job — double-booking safe.

    Prevents a janitor from being assigned to more than one active
    (confirmed or in_progress) job at a time.  The check is performed
    inside a transaction so concurrent dispatch calls serialise safely.
    A DB-level partial unique index (idx_jobs_janitor_one_active) provides
    a hard constraint as a belt-and-suspenders guarantee.

    Raises:
        HTTPException 409: Janitor already has an active job.
        HTTPException 404: Job not found.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Application-level guard: fast 409 with a clear message before
            # the DB constraint would fire a generic integrity error.
            active = await conn.fetchval(
                """
                SELECT id FROM jobs
                WHERE janitor_id = $1
                  AND status IN ('confirmed', 'in_progress')
                LIMIT 1
                """,
                uuid.UUID(str(janitor_id)),
            )
            if active:
                raise HTTPException(
                    status_code=409,
                    detail="Janitor already has an active job. Cannot double-assign.",
                )

            row = await conn.fetchrow(
                "UPDATE jobs SET janitor_id = $2 WHERE id = $1 RETURNING *",
                uuid.UUID(str(job_id)),
                uuid.UUID(str(janitor_id)),
            )

    if not row:
        raise HTTPException(status_code=404, detail="Job not found.")
    return dict(row)


async def unassign_janitor(job_id: str) -> dict:
    """Remove the janitor from a job, leaving it pending for re-assignment.

    Used when a janitor rejects an assigned (pending) job. Status is left
    unchanged ('pending') so the booking can be re-matched.

    Raises:
        HTTPException 404: Job not found.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE jobs SET janitor_id = NULL WHERE id = $1 RETURNING *",
            uuid.UUID(str(job_id)),
        )
    if not row:
        raise HTTPException(status_code=404, detail="Job not found.")

    # Invalidate admin stats cache — assignment change makes cached KPIs stale
    r = get_redis()
    if r is not None:
        try:
            await r.delete(_ADMIN_STATS_CACHE_KEY)
        except Exception:
            pass

    return dict(row)


async def delete_job(job_id: str) -> bool:
    """Delete a job (only pending or cancelled).

    Raises:
        HTTPException 400: Job is in a non-deletable state.
        HTTPException 404: Job not found.
    """
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job["status"] not in [JobStatus.PENDING.value, JobStatus.CANCELLED.value]:
        raise HTTPException(
            status_code=400,
            detail="Can only delete pending or cancelled jobs.",
        )

    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM jobs WHERE id = $1", uuid.UUID(str(job_id)))
    return True
