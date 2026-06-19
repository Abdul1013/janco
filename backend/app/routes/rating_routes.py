"""
Rating Routes — asyncpg implementation.

Endpoints:
    POST /v1/ratings                      — submit rating for a completed job
    GET  /v1/ratings/janitor/{janitor_id} — get rating summary + paginated reviews
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db.pool import get_pool
from app.engines.trust_engine import calculate_trust_score
from app.middleware.auth import get_current_user
from app.repositories import janitor_repo, job_repo

router = APIRouter(prefix="/ratings", tags=["Ratings"])


class RatingCreate(BaseModel):
    job_id: str
    score: int = Field(..., ge=1, le=5, description="Star rating 1-5")
    comment: str = Field("", max_length=500)


class RatingSummary(BaseModel):
    janitor_id: str
    avg_rating: float
    total_ratings: int
    ratings: list[dict]


@router.post("")
async def submit_rating(
    payload: RatingCreate,
    user_id: str = Depends(get_current_user),
):
    """Submit a rating for a completed job.

    Validates the job is completed and user is the owner.
    Triggers trust score recalculation after insertion.
    """
    job = await job_repo.get_job(payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed jobs.")
    if str(job["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="You can only rate your own jobs.")

    janitor_id = str(job["janitor_id"]) if job.get("janitor_id") else None
    if not janitor_id:
        raise HTTPException(status_code=400, detail="Job has no assigned janitor.")

    pool = get_pool()

    # Duplicate check
    async with pool.acquire() as conn:
        existing = await conn.fetchval(
            "SELECT id FROM ratings WHERE job_id = $1 AND user_id = $2",
            uuid.UUID(payload.job_id),
            uuid.UUID(user_id),
        )
    if existing:
        raise HTTPException(status_code=409, detail="You have already rated this job.")

    # Insert rating
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ratings (job_id, janitor_id, user_id, score, comment)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            """,
            uuid.UUID(payload.job_id),
            uuid.UUID(janitor_id),
            uuid.UUID(user_id),
            payload.score,
            payload.comment,
        )
    if not row:
        raise HTTPException(status_code=500, detail="Failed to submit rating.")

    trust_info = await _recalculate_trust(janitor_id)

    return {"rating": dict(row), "trust_update": trust_info}


@router.get("/janitor/{janitor_id}")
async def get_janitor_ratings(
    janitor_id: str,
    page: int = 1,
    limit: int = 20,
):
    """Get a janitor's rating summary and paginated reviews."""
    pool = get_pool()
    offset = (page - 1) * limit

    async with pool.acquire() as conn:
        # Paginated ratings joined with reviewer profile
        rows = await conn.fetch(
            """
            SELECT r.*, p.full_name, p.avatar_url,
                   COUNT(*) OVER() AS total_count
            FROM ratings r
            JOIN profiles p ON p.id = r.user_id
            WHERE r.janitor_id = $1
            ORDER BY r.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            uuid.UUID(janitor_id),
            limit,
            offset,
        )

        # Average from all ratings (not just this page)
        avg_row = await conn.fetchrow(
            "SELECT COUNT(*) AS total, AVG(score) AS avg FROM ratings WHERE janitor_id = $1",
            uuid.UUID(janitor_id),
        )

    ratings = [dict(r) for r in rows]
    total = int(ratings[0]["total_count"]) if ratings else 0
    for r in ratings:
        r.pop("total_count", None)

    avg = round(float(avg_row["avg"]), 2) if avg_row and avg_row["avg"] else 0.0

    return {
        "janitor_id": janitor_id,
        "avg_rating": avg,
        "total_ratings": int(avg_row["total"]) if avg_row else 0,
        "ratings": ratings,
        "page": page,
        "limit": limit,
    }


async def _recalculate_trust(janitor_id: str) -> dict:
    """Recalculate and persist a janitor's trust score after a new rating."""
    janitor = await janitor_repo.get_by_id(janitor_id)
    if not janitor:
        return {"score": 0.0, "tier": "Pending"}

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT COUNT(*) AS total, AVG(score) AS avg FROM ratings WHERE janitor_id = $1",
            uuid.UUID(janitor_id),
        )

    avg_rating = round(float(row["avg"]), 2) if row and row["avg"] else 0.0

    trust = calculate_trust_score(
        is_verified=janitor.get("is_verified", False),
        punctuality_rate=janitor.get("punctuality_rate", 0.0),
        avg_rating=avg_rating,
    )

    await janitor_repo.update_trust_score(janitor_id, trust.score, trust.tier.value)

    # Update denormalised avg_rating on janitor row
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE janitors SET avg_rating = $1 WHERE id = $2",
            avg_rating,
            uuid.UUID(janitor_id),
        )

    return {"score": trust.score, "tier": trust.tier.value}
