"""
Admin Routes.

Protected endpoints for reviewing janitor applications, managing jobs,
viewing customers, monitoring ratings, and configuring pricing.
Only users with role='admin' can access these.

Endpoints:
    GET   /v1/admin/stats                  — extended KPI overview (weekly/monthly)
    GET   /v1/admin/revenue/daily          — daily revenue + service breakdown
    GET   /v1/admin/analytics              — top performers + operational alerts
    GET   /v1/admin/jobs                   — all jobs with status + payment filters
    GET   /v1/admin/jobs/:id               — single job detail
    PATCH /v1/admin/jobs/:id               — update job status
    PATCH /v1/admin/jobs/:id/pay           — update payment status
    GET   /v1/admin/users                  — customer list with search
    GET   /v1/admin/janitors/active        — approved active janitor roster
    GET   /v1/admin/ratings                — all ratings feed
    GET   /v1/admin/applications           — list all janitor applications
    GET   /v1/admin/applications/:id       — get full application details
    PATCH /v1/admin/applications/:id       — approve / reject application
    GET   /v1/admin/pricing                — get pricing config
    PATCH /v1/admin/pricing                — update pricing config
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.db.pool import get_pool
from app.middleware.auth import get_current_user_with_role
from app.repositories import job_repo
from app.repositories.pricing_config import KNOWN_KEYS, load_config, update_config

router = APIRouter(prefix="/admin", tags=["Admin"])


class JobStatusPatch(BaseModel):
    """Payload for updating a job's status from the admin panel."""
    status: str

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"pending", "confirmed", "in_progress", "completed", "cancelled"}
        if v not in allowed:
            raise ValueError(f"status must be one of {sorted(allowed)}")
        return v


class JobPaymentPatch(BaseModel):
    """Payload for updating a job's payment status from the admin panel."""
    payment_status: str

    @field_validator("payment_status", mode="before")
    @classmethod
    def validate_payment_status(cls, v: str) -> str:
        allowed = {"unpaid", "pending", "paid", "refunded"}
        if v not in allowed:
            raise ValueError(f"payment_status must be one of {sorted(allowed)}")
        return v


class ApplicationReview(BaseModel):
    """Payload for approving or rejecting a janitor application."""
    status: str  # 'approved' or 'rejected'
    notes: str = ""


class PricingConfigUpdate(BaseModel):
    """Payload for updating one or more pricing config keys."""
    updates: dict[str, float]

    @field_validator("updates")
    @classmethod
    def validate_keys(cls, v: dict) -> dict:
        unknown = set(v.keys()) - KNOWN_KEYS
        if unknown:
            raise ValueError(f"Unknown pricing keys: {', '.join(sorted(unknown))}")
        for key, val in v.items():
            if val < 0:
                raise ValueError(f"Pricing value for '{key}' must be non-negative.")
        return v


def _require_admin(role_info: dict):
    """Ensure the caller is an admin."""
    if role_info.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return role_info["user_id"]


@router.get("/stats")
async def get_stats(
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return extended aggregate KPI stats including weekly and monthly breakdowns."""
    _require_admin(role_info)
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
              -- All-time job totals
              (SELECT COUNT(*)               FROM jobs)                                        AS total_jobs,
              (SELECT COUNT(*)               FROM jobs WHERE status = 'completed')             AS total_completed,
              (SELECT COUNT(*)               FROM jobs WHERE status = 'pending')               AS pending_jobs,
              (SELECT COUNT(*)               FROM jobs WHERE status = 'in_progress')           AS active_jobs,
              (SELECT COUNT(*)               FROM jobs WHERE status = 'cancelled')             AS total_cancelled,
              (SELECT COUNT(*)               FROM jobs WHERE DATE(created_at) = CURRENT_DATE)  AS jobs_today,
              (SELECT COALESCE(SUM(price),0) FROM jobs WHERE status = 'completed')            AS total_revenue,

              -- This week (last 7 days)
              (SELECT COUNT(*)               FROM jobs
               WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')                          AS jobs_this_week,
              (SELECT COALESCE(SUM(price),0) FROM jobs
               WHERE status = 'completed'
                 AND created_at >= CURRENT_DATE - INTERVAL '7 days')                          AS revenue_this_week,

              -- This month (last 30 days)
              (SELECT COUNT(*)               FROM jobs
               WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')                         AS jobs_this_month,
              (SELECT COALESCE(SUM(price),0) FROM jobs
               WHERE status = 'completed'
                 AND created_at >= CURRENT_DATE - INTERVAL '30 days')                         AS revenue_this_month,

              -- Accounts
              (SELECT COUNT(*)               FROM profiles WHERE role = 'customer')            AS total_customers,
              (SELECT COUNT(*)               FROM profiles WHERE role = 'customer'
               AND created_at >= CURRENT_DATE - INTERVAL '30 days')                           AS new_customers_month,
              (SELECT COUNT(*)               FROM janitors)                                    AS total_janitors,
              (SELECT COUNT(*)               FROM janitors
               WHERE approval_status = 'approved' AND is_verified = true)                     AS active_janitors,
              (SELECT COUNT(*)               FROM janitors WHERE approval_status = 'pending')  AS pending_applications,
              (SELECT COALESCE(AVG(score),0) FROM ratings)                                    AS avg_rating
            """
        )
    d = dict(row)
    # Cast Decimal/numeric values to Python float/int
    for k in ("total_revenue", "revenue_this_week", "revenue_this_month", "avg_rating"):
        d[k] = float(d[k])
    return d


@router.get("/revenue/daily")
async def get_daily_revenue(
    days: int = Query(30, ge=1, le=365, description="Number of past days to include"),
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return per-day revenue, service-type breakdown, and payment health for the last N days."""
    _require_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        daily_rows = await conn.fetch(
            """
            SELECT DATE(created_at) AS day,
                   COUNT(*)         AS job_count,
                   COALESCE(SUM(price), 0) AS revenue
            FROM jobs
            WHERE status = 'completed'
              AND created_at >= CURRENT_DATE - $1::int
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            """,
            days,
        )

        service_rows = await conn.fetch(
            """
            SELECT service_type,
                   COUNT(*) AS job_count,
                   COALESCE(SUM(price), 0) AS revenue,
                   COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
            FROM jobs
            WHERE created_at >= CURRENT_DATE - $1::int
            GROUP BY service_type
            ORDER BY revenue DESC
            """,
            days,
        )

        unpaid_row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS unpaid_count,
                   COALESCE(SUM(price), 0) AS unpaid_value
            FROM jobs
            WHERE status = 'completed'
              AND payment_status IN ('unpaid', 'pending')
            """
        )

    daily = []
    for r in daily_rows:
        daily.append({
            "day": r["day"].isoformat(),
            "job_count": int(r["job_count"]),
            "revenue": float(r["revenue"]),
        })

    by_service = []
    for r in service_rows:
        by_service.append({
            "service_type": r["service_type"],
            "job_count": int(r["job_count"]),
            "revenue": float(r["revenue"]),
            "cancelled": int(r["cancelled"]),
        })

    return {
        "daily": daily,
        "by_service": by_service,
        "unpaid_count": int(unpaid_row["unpaid_count"]),
        "unpaid_value": float(unpaid_row["unpaid_value"]),
        "days": days,
    }


@router.get("/analytics")
async def get_analytics(
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return top performers (janitors + customers) and operational alert counts."""
    _require_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        janitor_rows = await conn.fetch(
            """
            SELECT jan.id::text, p.full_name, jan.avg_rating, jan.trust_tier,
                   COUNT(j.id) AS job_count,
                   COALESCE(SUM(j.price), 0) AS revenue_generated
            FROM janitors jan
            JOIN profiles p ON p.id = jan.id
            LEFT JOIN jobs j ON j.janitor_id = jan.id AND j.status = 'completed'
            WHERE jan.is_verified = true
            GROUP BY jan.id, p.full_name, jan.avg_rating, jan.trust_tier
            ORDER BY revenue_generated DESC
            LIMIT 5
            """
        )

        customer_rows = await conn.fetch(
            """
            SELECT p.id::text, p.full_name, p.email,
                   COUNT(j.id) AS booking_count,
                   COALESCE(SUM(j.price), 0) AS total_spend
            FROM profiles p
            JOIN jobs j ON j.user_id = p.id AND j.status = 'completed'
            WHERE p.role = 'customer'
            GROUP BY p.id, p.full_name, p.email
            ORDER BY total_spend DESC
            LIMIT 5
            """
        )

        stale_row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS stale_jobs
            FROM jobs
            WHERE status = 'pending'
              AND janitor_id IS NULL
              AND created_at < NOW() - INTERVAL '24 hours'
            """
        )

        overdue_row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS overdue_jobs
            FROM jobs
            WHERE status IN ('pending', 'confirmed', 'in_progress')
              AND scheduled_date IS NOT NULL
              AND scheduled_date::date < CURRENT_DATE
            """
        )

    top_janitors = []
    for r in janitor_rows:
        top_janitors.append({
            "id": r["id"],
            "full_name": r["full_name"],
            "avg_rating": float(r["avg_rating"] or 0),
            "trust_tier": r["trust_tier"],
            "job_count": int(r["job_count"]),
            "revenue_generated": float(r["revenue_generated"]),
        })

    top_customers = []
    for r in customer_rows:
        top_customers.append({
            "id": r["id"],
            "full_name": r["full_name"],
            "email": r["email"],
            "booking_count": int(r["booking_count"]),
            "total_spend": float(r["total_spend"]),
        })

    return {
        "top_janitors": top_janitors,
        "top_customers": top_customers,
        "stale_jobs": int(stale_row["stale_jobs"]),
        "overdue_jobs": int(overdue_row["overdue_jobs"]),
    }


@router.get("/jobs")
async def list_all_jobs(
    status: str = Query(None, description="Filter by job status"),
    payment_status: str = Query(None, description="Filter by payment status"),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return paginated list of all jobs with customer + janitor names.

    Supports optional filtering by job status and/or payment status.
    """
    _require_admin(role_info)
    pool = get_pool()
    offset = (page - 1) * limit

    # Build dynamic WHERE clause + params
    conditions = []
    params: list = []

    if status:
        params.append(status)
        conditions.append(f"j.status = ${len(params)}")
    if payment_status:
        params.append(payment_status)
        conditions.append(f"j.payment_status = ${len(params)}")

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    params.append(limit)
    limit_ph = f"${len(params)}"
    params.append(offset)
    offset_ph = f"${len(params)}"

    query = f"""
        SELECT j.id::text, j.service_type, j.status, j.payment_status,
               j.price, j.transport_fee, j.rooms, j.scheduled_date,
               j.created_at, j.address,
               cu.full_name AS customer_name,
               jan.full_name AS janitor_name,
               COUNT(*) OVER() AS total_count
        FROM jobs j
        JOIN profiles cu ON cu.id = j.user_id
        LEFT JOIN profiles jan ON jan.id = j.janitor_id
        {where_clause}
        ORDER BY j.created_at DESC
        LIMIT {limit_ph} OFFSET {offset_ph}
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    jobs = [dict(r) for r in rows]
    total = int(jobs[0]["total_count"]) if jobs else 0
    for j in jobs:
        j.pop("total_count", None)

    return {"jobs": jobs, "count": total, "page": page, "limit": limit}


@router.get("/jobs/{job_id}")
async def get_job_detail(
    job_id: str,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return full detail of a single job with customer and janitor profiles."""
    _require_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT j.id::text, j.service_type, j.status, j.payment_status,
                   j.price, j.transport_fee, j.rooms, j.toilets,
                   j.scheduled_date, j.scheduled_time, j.address,
                   j.latitude, j.longitude, j.notes, j.created_at,
                   j.user_id::text, j.janitor_id::text,
                   cu.full_name AS customer_name,
                   cu.email    AS customer_email,
                   cu.phone    AS customer_phone,
                   jan.full_name AS janitor_name,
                   jan.email    AS janitor_email,
                   jan.phone    AS janitor_phone
            FROM jobs j
            JOIN profiles cu ON cu.id = j.user_id
            LEFT JOIN profiles jan ON jan.id = j.janitor_id
            WHERE j.id = $1
            """,
            uuid.UUID(job_id),
        )

    if not row:
        raise HTTPException(status_code=404, detail="Job not found.")

    return dict(row)


@router.patch("/jobs/{job_id}")
async def update_job_status(
    job_id: str,
    payload: JobStatusPatch,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Update a job's status. Enforces valid transition rules."""
    _require_admin(role_info)
    updated = await job_repo.update_status(job_id, payload.status)
    return {"message": f"Job status updated to '{payload.status}'.", "job_id": job_id}


@router.patch("/jobs/{job_id}/pay")
async def update_job_payment(
    job_id: str,
    payload: JobPaymentPatch,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Update a job's payment status (e.g. mark as paid)."""
    _require_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE jobs SET payment_status = $2 WHERE id = $1 RETURNING id::text, payment_status",
            uuid.UUID(job_id),
            payload.payment_status,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Job not found.")

    return {"job_id": row["id"], "payment_status": row["payment_status"]}


@router.get("/users")
async def list_users(
    search: str = Query(None, description="ILIKE search on name or email"),
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return paginated customer list with booking counts."""
    _require_admin(role_info)
    pool = get_pool()
    offset = (page - 1) * limit

    async with pool.acquire() as conn:
        if search:
            pattern = f"%{search}%"
            rows = await conn.fetch(
                """
                SELECT p.id::text, p.full_name, p.email, p.phone, p.created_at,
                       COUNT(j.id) AS booking_count,
                       COUNT(*) OVER() AS total_count
                FROM profiles p
                LEFT JOIN jobs j ON j.user_id = p.id
                WHERE p.role = 'customer'
                  AND (p.full_name ILIKE $1 OR p.email ILIKE $1)
                GROUP BY p.id, p.full_name, p.email, p.phone, p.created_at
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
                """,
                pattern, limit, offset,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT p.id::text, p.full_name, p.email, p.phone, p.created_at,
                       COUNT(j.id) AS booking_count,
                       COUNT(*) OVER() AS total_count
                FROM profiles p
                LEFT JOIN jobs j ON j.user_id = p.id
                WHERE p.role = 'customer'
                GROUP BY p.id, p.full_name, p.email, p.phone, p.created_at
                ORDER BY p.created_at DESC
                LIMIT $1 OFFSET $2
                """,
                limit, offset,
            )

    users = [dict(r) for r in rows]
    total = int(users[0]["total_count"]) if users else 0
    for u in users:
        u.pop("total_count", None)

    return {"users": users, "count": total, "page": page, "limit": limit}


@router.get("/janitors/active")
async def list_active_janitors(
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return all approved + verified janitors with trust scores and job counts."""
    _require_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT j.id::text, p.full_name, p.email, p.phone, p.avatar_url,
                   j.service_types, j.trust_score, j.trust_tier, j.availability,
                   j.verified_at, j.created_at,
                   (SELECT COUNT(*) FROM jobs
                    WHERE janitor_id = j.id AND status = 'completed')   AS completed_jobs,
                   (SELECT COUNT(*) FROM jobs
                    WHERE janitor_id = j.id AND status = 'in_progress') AS active_jobs
            FROM janitors j
            JOIN profiles p ON p.id = j.id
            WHERE j.approval_status = 'approved' AND j.is_verified = true
            ORDER BY j.trust_score DESC NULLS LAST
            """
        )

    janitors = []
    for r in rows:
        d = dict(r)
        d["completed_jobs"] = int(d["completed_jobs"])
        d["active_jobs"] = int(d["active_jobs"])
        janitors.append(d)

    return {"janitors": janitors, "count": len(janitors)}


@router.get("/ratings")
async def list_ratings(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return paginated ratings feed with janitor and customer names."""
    _require_admin(role_info)
    pool = get_pool()
    offset = (page - 1) * limit

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT r.id::text, r.score, r.comment, r.created_at,
                   r.job_id::text, r.janitor_id::text, r.user_id::text,
                   cu.full_name  AS customer_name,
                   jan.full_name AS janitor_name,
                   COUNT(*) OVER() AS total_count
            FROM ratings r
            JOIN profiles cu  ON cu.id  = r.user_id
            JOIN profiles jan ON jan.id = r.janitor_id
            ORDER BY r.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )

    ratings = [dict(r) for r in rows]
    total = int(ratings[0]["total_count"]) if ratings else 0
    for r in ratings:
        r.pop("total_count", None)

    return {"ratings": ratings, "count": total, "page": page, "limit": limit}


@router.get("/applications")
async def list_applications(
    status_filter: str = Query("all", description="Filter: all, pending, approved, rejected"),
    role_info: dict = Depends(get_current_user_with_role),
):
    """List all janitor applications with profile + metadata."""
    _require_admin(role_info)
    pool = get_pool()

    query = """
        SELECT j.id, j.phone, j.address, j.service_types, j.experience,
               j.bio, j.availability, j.is_verified, j.trust_score,
               j.trust_tier, j.approval_status, j.metadata, j.created_at,
               p.full_name, p.email, p.avatar_url
        FROM janitors j
        JOIN profiles p ON p.id = j.id
    """
    if status_filter != "all":
        query += " WHERE j.approval_status = $1 ORDER BY j.created_at DESC"
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, status_filter)
    else:
        query += " ORDER BY j.created_at DESC"
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)

    results = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        # Parse metadata JSONB
        import json
        if isinstance(d.get("metadata"), str):
            d["metadata"] = json.loads(d["metadata"])
        results.append(d)

    return {"applications": results, "count": len(results)}


@router.get("/applications/{janitor_id}")
async def get_application(
    janitor_id: str,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Get full details of a janitor application including guarantor info."""
    _require_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT j.*, p.full_name, p.email, p.avatar_url, p.phone AS profile_phone
            FROM janitors j
            JOIN profiles p ON p.id = j.id
            WHERE j.id = $1
            """,
            uuid.UUID(janitor_id),
        )

    if not row:
        raise HTTPException(status_code=404, detail="Application not found.")

    import json
    d = dict(row)
    d["id"] = str(d["id"])
    if isinstance(d.get("metadata"), str):
        d["metadata"] = json.loads(d["metadata"])

    return d


@router.patch("/applications/{janitor_id}")
async def review_application(
    janitor_id: str,
    payload: ApplicationReview,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Approve or reject a janitor application."""
    admin_id = _require_admin(role_info)

    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'.")

    pool = get_pool()
    async with pool.acquire() as conn:
        # Update approval status
        row = await conn.fetchrow(
            """
            UPDATE janitors
            SET approval_status = $2,
                is_verified = $3,
                verified_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE verified_at END
            WHERE id = $1
            RETURNING *
            """,
            uuid.UUID(janitor_id),
            payload.status,
            payload.status == "approved",
        )

        if not row:
            raise HTTPException(status_code=404, detail="Application not found.")

        # Store review notes in metadata
        if payload.notes:
            import json
            existing_meta = row["metadata"] or "{}"
            if isinstance(existing_meta, str):
                meta = json.loads(existing_meta)
            else:
                meta = dict(existing_meta)
            meta["review_notes"] = payload.notes
            meta["reviewed_by"] = admin_id
            await conn.execute(
                "UPDATE janitors SET metadata = $2 WHERE id = $1",
                uuid.UUID(janitor_id),
                json.dumps(meta),
            )

    status_label = "approved" if payload.status == "approved" else "rejected"
    return {
        "message": f"Application {status_label}.",
        "janitor_id": janitor_id,
        "approval_status": payload.status,
    }


@router.get("/pricing")
async def get_pricing_config(
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return all current pricing config values."""
    _require_admin(role_info)
    pool = get_pool()
    config = await load_config(pool)
    return {"config": config}


@router.patch("/pricing")
async def update_pricing_config(
    payload: PricingConfigUpdate,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Update one or more pricing config keys."""
    _require_admin(role_info)
    pool = get_pool()
    await update_config(pool, payload.updates)
    return {
        "message": "Pricing config updated.",
        "updated": list(payload.updates.keys()),
    }
