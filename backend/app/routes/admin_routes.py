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

import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator, model_validator

from typing import Optional

from app.db.pool import get_pool
from app.db.redis import get_redis
from app.middleware.auth import get_current_user_with_role
from app.repositories import job_repo, user_repo
from app.repositories import janitor_repo
from app.repositories.pricing_config import KNOWN_KEYS, load_config, update_config
from app.services import email_service, notification_service
from app.utils.security import hash_password

_STATS_CACHE_KEY = "janco:admin_stats"
_STATS_CACHE_TTL = 60  # seconds

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
        # Commission is a fraction — must stay within 0..1.
        if "platform_commission_rate" in v and not (0 <= v["platform_commission_rate"] <= 1):
            raise ValueError("platform_commission_rate must be between 0 and 1.")
        return v


class UserProfilePatch(BaseModel):
    """Payload for updating a user's profile fields from the admin panel."""
    full_name: Optional[str] = None
    phone: Optional[str] = None


class SuspendAction(BaseModel):
    """Payload for suspending or reactivating a user account."""
    is_active: bool  # False = suspend, True = reactivate


_ADMIN_LEVELS = {"super_admin", "admin", "viewer"}


class AdminCreate(BaseModel):
    """Payload for creating a new admin account."""
    email: str
    password: str
    full_name: str
    level: str = "admin"  # super_admin | admin | viewer

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        from app.schema.user_schema import _validate_password_strength
        return _validate_password_strength(v)

    @field_validator("level")
    @classmethod
    def validate_level(cls, v: str) -> str:
        if v not in _ADMIN_LEVELS:
            raise ValueError(f"level must be one of {sorted(_ADMIN_LEVELS)}")
        return v


class AdminLevelPatch(BaseModel):
    """Payload for changing an existing admin's authorization tier."""
    level: str

    @field_validator("level")
    @classmethod
    def validate_level(cls, v: str) -> str:
        if v not in _ADMIN_LEVELS:
            raise ValueError(f"level must be one of {sorted(_ADMIN_LEVELS)}")
        return v


_BROADCAST_CHANNELS = {"email", "push", "both"}
_BROADCAST_AUDIENCES = {"all_customers", "all_janitors", "all_users", "specific_user"}


class BroadcastCreate(BaseModel):
    """Payload for sending a broadcast email and/or push notification."""
    channel: str          # email | push | both
    audience: str         # all_customers | all_janitors | all_users | specific_user
    target_id: Optional[str] = None   # required when audience == specific_user
    subject: Optional[str] = None     # required when channel includes email
    body: str

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        if v not in _BROADCAST_CHANNELS:
            raise ValueError(f"channel must be one of {sorted(_BROADCAST_CHANNELS)}")
        return v

    @field_validator("audience")
    @classmethod
    def validate_audience(cls, v: str) -> str:
        if v not in _BROADCAST_AUDIENCES:
            raise ValueError(f"audience must be one of {sorted(_BROADCAST_AUDIENCES)}")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("body must not be empty.")
        return v

    @model_validator(mode="after")
    def check_conditional_fields(self):
        if self.audience == "specific_user" and not self.target_id:
            raise ValueError("target_id is required when audience is 'specific_user'.")
        if self.channel in ("email", "both") and not (self.subject and self.subject.strip()):
            raise ValueError("subject is required for email broadcasts.")
        return self


_EXPENSE_CATEGORIES = {"marketing", "salary", "operations", "refund", "other"}


class ExpenseCreate(BaseModel):
    """Payload for recording a manual expense in the financial ledger."""
    category: str
    description: str
    amount: int           # Naira, same unit as jobs.price
    incurred_on: Optional[str] = None   # ISO date 'YYYY-MM-DD'; defaults to today

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in _EXPENSE_CATEGORIES:
            raise ValueError(f"category must be one of {sorted(_EXPENSE_CATEGORIES)}")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("amount must be a positive integer.")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("description must not be empty.")
        return v


class JanitorCreate(BaseModel):
    """Payload for admin-side janitor account creation (auto-approved)."""
    email: str
    password: str
    full_name: str
    phone: str
    address: str
    service_types: list[str]
    experience: str = ""
    bio: str = ""

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        from app.schema.user_schema import _validate_password_strength
        return _validate_password_strength(v)


def _require_admin(role_info: dict):
    """Ensure the caller is an admin (any tier — used by read-only endpoints)."""
    if role_info.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")
    return role_info["user_id"]


def _require_write_admin(role_info: dict):
    """Ensure the caller can mutate data. Allows super_admin + admin, blocks viewer."""
    _require_admin(role_info)
    if role_info.get("admin_level") == "viewer":
        raise HTTPException(
            status_code=403,
            detail="Read-only access — write actions require an admin or super_admin role.",
        )
    return role_info["user_id"]


def _require_super_admin(role_info: dict):
    """Ensure the caller is a super_admin (financials, admin management, pricing)."""
    _require_admin(role_info)
    if role_info.get("admin_level") != "super_admin":
        raise HTTPException(status_code=403, detail="Super-admin access required.")
    return role_info["user_id"]


@router.get("/stats")
async def get_stats(
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return extended aggregate KPI stats including weekly and monthly breakdowns.

    Result is cached in Redis for 60 seconds to avoid running 17 sub-queries
    on every admin dashboard tab switch.  Cache is invalidated automatically
    after TTL expiry — or immediately when job/payment status changes.
    """
    _require_admin(role_info)

    # ── Redis cache hit ───────────────────────────────────────────────────────
    r = get_redis()
    if r is not None:
        try:
            cached = await r.get(_STATS_CACHE_KEY)
            if cached:
                return json.loads(cached)
        except Exception:
            pass  # Redis failure → fall through to DB

    # ── DB query ──────────────────────────────────────────────────────────────
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

    # ── Cache result ──────────────────────────────────────────────────────────
    if r is not None:
        try:
            await r.setex(_STATS_CACHE_KEY, _STATS_CACHE_TTL, json.dumps(d))
        except Exception:
            pass  # Cache write failure is non-fatal

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


_GROWTH_CACHE_KEY = "janco:admin_growth_metrics"
_GROWTH_CACHE_TTL = 120  # seconds


@router.get("/growth-metrics")
async def get_growth_metrics(
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return derived growth-engine metrics for the analytics dashboard.

    Metrics:
      - completion_rate: completed / (completed + cancelled)
      - cancellation_rate: cancelled / (completed + cancelled)
      - payment_collection_rate: paid / completed
      - repeat_customer_rate: customers with ≥2 bookings / total customers
      - avg_jobs_per_active_janitor_week: avg weekly throughput per active janitor
      - median_booking_lead_time_hours: median hours between booking and scheduled start
      - rating_distribution: count of each star score (1–5)

    Cached in Redis for 120 seconds.
    """
    _require_admin(role_info)

    r = get_redis()
    if r is not None:
        try:
            cached = await r.get(_GROWTH_CACHE_KEY)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    pool = get_pool()
    async with pool.acquire() as conn:
        terminal_row = await conn.fetchrow(
            """
            SELECT
              COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
              COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled
            FROM jobs
            WHERE status IN ('completed', 'cancelled')
            """
        )

        payment_row = await conn.fetchrow(
            """
            SELECT
              COUNT(*) FILTER (WHERE payment_status = 'paid')  AS paid_count,
              COUNT(*)                                           AS completed_count
            FROM jobs
            WHERE status = 'completed'
            """
        )

        repeat_row = await conn.fetchrow(
            """
            SELECT
              COUNT(*) FILTER (WHERE booking_count >= 2) AS repeat_customers,
              COUNT(*)                                     AS total_customers
            FROM (
              SELECT user_id, COUNT(*) AS booking_count
              FROM jobs
              WHERE status = 'completed'
              GROUP BY user_id
            ) sub
            """
        )

        utilisation_row = await conn.fetchrow(
            """
            SELECT COALESCE(AVG(weekly_jobs), 0) AS avg_jobs_per_janitor_week
            FROM (
              SELECT janitor_id, COUNT(*) / GREATEST(
                EXTRACT(DAY FROM (NOW() - MIN(created_at))) / 7.0, 1
              ) AS weekly_jobs
              FROM jobs
              WHERE status = 'completed' AND janitor_id IS NOT NULL
              GROUP BY janitor_id
            ) sub
            """
        )

        lead_time_row = await conn.fetchrow(
            """
            SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (
                (scheduled_date || ' ' || COALESCE(scheduled_time, '09:00'))::timestamptz - created_at
              )) / 3600
            ) AS median_lead_time_hours
            FROM jobs
            WHERE scheduled_date IS NOT NULL
              AND created_at IS NOT NULL
              AND status != 'cancelled'
            """
        )

        rating_rows = await conn.fetch(
            """
            SELECT score, COUNT(*) AS cnt
            FROM ratings
            GROUP BY score
            ORDER BY score
            """
        )

    completed = int(terminal_row["completed"] or 0)
    cancelled = int(terminal_row["cancelled"] or 0)
    terminal_total = completed + cancelled

    paid_count = int(payment_row["paid_count"] or 0)
    completed_count = int(payment_row["completed_count"] or 0)

    repeat_customers = int(repeat_row["repeat_customers"] or 0)
    total_customers = int(repeat_row["total_customers"] or 0)

    rating_dist = {str(i): 0 for i in range(1, 6)}
    for r_row in rating_rows:
        rating_dist[str(r_row["score"])] = int(r_row["cnt"])

    result = {
        "completion_rate": round(completed / terminal_total, 4) if terminal_total else 0,
        "cancellation_rate": round(cancelled / terminal_total, 4) if terminal_total else 0,
        "payment_collection_rate": round(paid_count / completed_count, 4) if completed_count else 0,
        "repeat_customer_rate": round(repeat_customers / total_customers, 4) if total_customers else 0,
        "avg_jobs_per_active_janitor_week": round(float(utilisation_row["avg_jobs_per_janitor_week"] or 0), 2),
        "median_booking_lead_time_hours": round(float(lead_time_row["median_lead_time_hours"] or 0), 1),
        "rating_distribution": rating_dist,
    }

    if r is not None:
        try:
            await r.setex(_GROWTH_CACHE_KEY, _GROWTH_CACHE_TTL, json.dumps(result))
        except Exception:
            pass

    return result


@router.get("/alerts")
async def get_alert_jobs(
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return full stale and overdue job rows for the alerts dashboard.

    Stale jobs: pending, no janitor assigned, created >24 hours ago.
    Overdue jobs: active/pending but scheduled_date is in the past.

    Unlike /analytics which returns only counts, this returns the full
    job rows so the dashboard can display them in detail tables.
    """
    _require_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        stale_rows = await conn.fetch(
            """
            SELECT j.id::text, j.service_type, j.status, j.price,
                   j.scheduled_date, j.scheduled_time, j.address, j.created_at,
                   p.full_name AS customer_name, p.email AS customer_email
            FROM jobs j
            JOIN profiles p ON p.id = j.user_id
            WHERE j.status = 'pending'
              AND j.janitor_id IS NULL
              AND j.created_at < NOW() - INTERVAL '24 hours'
            ORDER BY j.created_at ASC
            LIMIT 50
            """,
        )

        overdue_rows = await conn.fetch(
            """
            SELECT j.id::text, j.service_type, j.status, j.price,
                   j.scheduled_date, j.scheduled_time, j.address, j.created_at,
                   p.full_name AS customer_name,
                   COALESCE(jan_p.full_name, 'Unassigned') AS janitor_name
            FROM jobs j
            JOIN profiles p ON p.id = j.user_id
            LEFT JOIN janitors jan ON jan.id = j.janitor_id
            LEFT JOIN profiles jan_p ON jan_p.id = jan.id
            WHERE j.status IN ('pending', 'confirmed', 'in_progress')
              AND j.scheduled_date IS NOT NULL
              AND j.scheduled_date::date < CURRENT_DATE
            ORDER BY j.scheduled_date ASC
            LIMIT 50
            """,
        )

    def fmt(rows):
        result = []
        for row in rows:
            d = dict(row)
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            if d.get("price"):
                d["price"] = int(d["price"])
            result.append(d)
        return result

    return {
        "stale_jobs": fmt(stale_rows),
        "overdue_jobs": fmt(overdue_rows),
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
    _require_write_admin(role_info)
    updated = await job_repo.update_status(job_id, payload.status)
    return {"message": f"Job status updated to '{payload.status}'.", "job_id": job_id}


@router.patch("/jobs/{job_id}/pay")
async def update_job_payment(
    job_id: str,
    payload: JobPaymentPatch,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Update a job's payment status (e.g. mark as paid)."""
    _require_write_admin(role_info)
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
                       p.is_active,
                       COUNT(j.id) AS booking_count,
                       COUNT(*) OVER() AS total_count
                FROM profiles p
                LEFT JOIN jobs j ON j.user_id = p.id
                WHERE p.role = 'customer'
                  AND (p.full_name ILIKE $1 OR p.email ILIKE $1)
                GROUP BY p.id, p.full_name, p.email, p.phone, p.created_at, p.is_active
                ORDER BY p.created_at DESC
                LIMIT $2 OFFSET $3
                """,
                pattern, limit, offset,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT p.id::text, p.full_name, p.email, p.phone, p.created_at,
                       p.is_active,
                       COUNT(j.id) AS booking_count,
                       COUNT(*) OVER() AS total_count
                FROM profiles p
                LEFT JOIN jobs j ON j.user_id = p.id
                WHERE p.role = 'customer'
                GROUP BY p.id, p.full_name, p.email, p.phone, p.created_at, p.is_active
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
    admin_id = _require_write_admin(role_info)

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
    _require_super_admin(role_info)
    pool = get_pool()
    await update_config(pool, payload.updates)
    return {
        "message": "Pricing config updated.",
        "updated": list(payload.updates.keys()),
    }


# ── User Account Management ───────────────────────────────────────────────────


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return full profile + booking stats for any user."""
    _require_admin(role_info)
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format.")

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT p.id::text, p.email, p.full_name, p.phone, p.role,
                   p.is_active, p.created_at,
                   COUNT(j.id) AS booking_count,
                   COALESCE(SUM(j.price) FILTER (WHERE j.status = 'completed'), 0) AS total_spend
            FROM profiles p
            LEFT JOIN jobs j ON j.user_id = p.id
            WHERE p.id = $1
            GROUP BY p.id, p.email, p.full_name, p.phone, p.role, p.is_active, p.created_at
            """,
            uid,
        )

    if not row:
        raise HTTPException(status_code=404, detail="User not found.")

    d = dict(row)
    d["booking_count"] = int(d["booking_count"])
    d["total_spend"] = float(d["total_spend"])
    return d


@router.patch("/users/{user_id}")
async def edit_user_profile(
    user_id: str,
    payload: UserProfilePatch,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Update a user's full_name or phone."""
    _require_write_admin(role_info)
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format.")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        return {"message": "No fields to update.", "user_id": user_id}

    pool = get_pool()
    result = await user_repo.update_profile(user_id, updates)
    if result is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"message": "Profile updated.", "user_id": user_id}


@router.patch("/users/{user_id}/status")
async def set_user_status(
    user_id: str,
    payload: SuspendAction,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Suspend (is_active=false) or reactivate (is_active=true) a user account."""
    admin_id = _require_write_admin(role_info)

    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format.")

    if str(uid) == str(admin_id):
        raise HTTPException(status_code=400, detail="Cannot change your own account status.")

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "UPDATE profiles SET is_active = $2 WHERE id = $1 RETURNING id::text, role, is_active",
                uid,
                payload.is_active,
            )
            if not row:
                raise HTTPException(status_code=404, detail="User not found.")

            # If suspending a janitor, also remove their availability
            if row["role"] == "janitor" and not payload.is_active:
                await conn.execute(
                    "UPDATE janitors SET availability = FALSE WHERE id = $1",
                    uid,
                )

    action = "reactivated" if payload.is_active else "suspended"
    return {"message": f"Account {action}.", "user_id": user_id, "is_active": payload.is_active}


# ── Admin Management ──────────────────────────────────────────────────────────


@router.get("/admins")
async def list_admins(
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return all admin accounts. Any admin tier may view the roster."""
    _require_admin(role_info)
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text, email, full_name, phone, is_active, admin_level, created_at
            FROM profiles
            WHERE role = 'admin'
            ORDER BY created_at ASC
            """
        )
    return {"admins": [dict(r) for r in rows], "count": len(rows)}


@router.post("/admins", status_code=201)
async def create_admin(
    payload: AdminCreate,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Create a new admin account at the given tier (super_admin only)."""
    _require_super_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        existing = await conn.fetchval(
            "SELECT id FROM profiles WHERE email = $1", payload.email.lower()
        )
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")

    new_id = str(uuid.uuid4())
    pw_hash = hash_password(payload.password)
    await user_repo.create_profile(new_id, {
        "email": payload.email.lower(),
        "full_name": payload.full_name,
        "password_hash": pw_hash,
        "role": "admin",
        "admin_level": payload.level,
    })
    return {
        "message": "Admin account created.",
        "user_id": new_id,
        "email": payload.email.lower(),
        "admin_level": payload.level,
    }


@router.patch("/admins/{target_id}/level")
async def set_admin_level(
    target_id: str,
    payload: AdminLevelPatch,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Change an existing admin's authorization tier (super_admin only)."""
    admin_id = _require_super_admin(role_info)

    try:
        tid = uuid.UUID(target_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format.")

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            current = await conn.fetchrow(
                "SELECT admin_level FROM profiles WHERE id = $1 AND role = 'admin'",
                tid,
            )
            if not current:
                raise HTTPException(status_code=404, detail="Admin not found.")

            # Guard: don't strip the last super_admin of their tier (lockout protection).
            if current["admin_level"] == "super_admin" and payload.level != "super_admin":
                super_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM profiles WHERE role = 'admin' AND admin_level = 'super_admin'"
                )
                if int(super_count) <= 1:
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot demote the last super_admin. Promote another first.",
                    )

            await conn.execute(
                "UPDATE profiles SET admin_level = $2 WHERE id = $1",
                tid,
                payload.level,
            )

    return {"message": "Admin level updated.", "user_id": target_id, "admin_level": payload.level}


@router.delete("/admins/{target_id}")
async def revoke_admin(
    target_id: str,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Revoke admin role — demotes the account to 'customer' (super_admin only)."""
    admin_id = _require_super_admin(role_info)

    try:
        tid = uuid.UUID(target_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id format.")

    if str(tid) == str(admin_id):
        raise HTTPException(status_code=400, detail="Cannot revoke your own admin role.")

    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            target = await conn.fetchrow(
                "SELECT admin_level FROM profiles WHERE id = $1 AND role = 'admin'",
                tid,
            )
            if not target:
                raise HTTPException(status_code=404, detail="Admin not found.")

            admin_count = await conn.fetchval(
                "SELECT COUNT(*) FROM profiles WHERE role = 'admin'"
            )
            if int(admin_count) <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot revoke the last admin account. Create another admin first.",
                )

            # Guard: don't revoke the last super_admin.
            if target["admin_level"] == "super_admin":
                super_count = await conn.fetchval(
                    "SELECT COUNT(*) FROM profiles WHERE role = 'admin' AND admin_level = 'super_admin'"
                )
                if int(super_count) <= 1:
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot revoke the last super_admin. Promote another first.",
                    )

            await conn.execute(
                "UPDATE profiles SET role = 'customer', admin_level = NULL WHERE id = $1",
                tid,
            )

    return {
        "message": "Admin role revoked. Account downgraded to customer.",
        "user_id": target_id,
    }


# ── Admin-side Janitor Management ─────────────────────────────────────────────


@router.get("/janitors/{janitor_id}")
async def get_janitor_detail(
    janitor_id: str,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return full janitor profile with joined profile data."""
    _require_admin(role_info)
    try:
        uuid.UUID(janitor_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid janitor_id format.")

    janitor = await janitor_repo.get_by_id(janitor_id)
    if not janitor:
        raise HTTPException(status_code=404, detail="Janitor not found.")

    d = dict(janitor)
    # Ensure id is a string
    if "id" in d:
        d["id"] = str(d["id"])
    return d


@router.post("/janitors", status_code=201)
async def create_janitor(
    payload: JanitorCreate,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Create a janitor account directly from the admin panel (auto-approved, auto-verified)."""
    _require_write_admin(role_info)
    pool = get_pool()

    async with pool.acquire() as conn:
        existing = await conn.fetchval(
            "SELECT id FROM profiles WHERE email = $1", payload.email.lower()
        )
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email already exists.")

    new_id = str(uuid.uuid4())
    pw_hash = hash_password(payload.password)

    async with pool.acquire() as conn:
        async with conn.transaction():
            # 1. Create profile with role='janitor'
            await conn.execute(
                """
                INSERT INTO profiles (id, email, password_hash, full_name, phone, role, is_registered)
                VALUES ($1, $2, $3, $4, $5, 'janitor', TRUE)
                """,
                uuid.UUID(new_id),
                payload.email.lower(),
                pw_hash,
                payload.full_name,
                payload.phone,
            )

            # 2. Create janitor record — auto-approved and verified since admin is creating it
            await conn.execute(
                """
                INSERT INTO janitors
                    (id, phone, address, service_types, experience, bio,
                     availability, is_verified, verified_at, approval_status, trust_tier)
                VALUES ($1, $2, $3, $4, $5, $6, FALSE, TRUE, NOW(), 'approved', 'Pending')
                """,
                uuid.UUID(new_id),
                payload.phone,
                payload.address,
                payload.service_types,
                payload.experience,
                payload.bio,
            )

    return {
        "message": "Janitor account created and approved.",
        "user_id": new_id,
        "email": payload.email.lower(),
        "approval_status": "approved",
    }


# ── Broadcast Messaging ───────────────────────────────────────────────────────


async def _deliver_broadcast(
    channel: str,
    recipients: list[dict],
    subject: str | None,
    body: str,
) -> None:
    """Background fan-out for a broadcast across the requested channel(s)."""
    tasks = []
    if channel in ("email", "both"):
        tasks.append(email_service.send_broadcast(recipients, subject or "JANCO", body))
    if channel in ("push", "both"):
        # Push title falls back to a generic label when no subject was given.
        tasks.append(notification_service.send_broadcast_push(
            recipients, subject or "JANCO", body, data={"type": "broadcast"},
        ))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


@router.post("/broadcast", status_code=201)
async def send_broadcast(
    payload: BroadcastCreate,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Send a broadcast email and/or push to a chosen audience (admin + super_admin)."""
    admin_id = _require_write_admin(role_info)

    # Resolve recipients.
    if payload.audience == "specific_user":
        recipient = await user_repo.get_recipient(payload.target_id)
        recipients = [recipient] if recipient else []
        if not recipients:
            raise HTTPException(status_code=404, detail="Target user not found or inactive.")
    else:
        recipients = await user_repo.get_recipients(payload.audience)

    recipients_count = len(recipients)

    # Fire-and-forget the actual delivery so the request returns promptly.
    asyncio.create_task(
        _deliver_broadcast(payload.channel, recipients, payload.subject, payload.body)
    )

    # Log the broadcast for audit/history.
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO broadcasts (channel, audience, target_id, subject, body, sent_count, sent_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id::text
            """,
            payload.channel,
            payload.audience,
            uuid.UUID(payload.target_id) if payload.target_id else None,
            payload.subject,
            payload.body,
            recipients_count,
            uuid.UUID(str(admin_id)),
        )

    return {
        "message": "Broadcast queued.",
        "broadcast_id": row["id"],
        "recipients_count": recipients_count,
    }


@router.get("/broadcast/history")
async def broadcast_history(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    role_info: dict = Depends(get_current_user_with_role),
):
    """Return a paginated history of past broadcasts (any admin tier may view)."""
    _require_admin(role_info)
    pool = get_pool()
    offset = (page - 1) * limit

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT b.id::text, b.channel, b.audience, b.target_id::text,
                   b.subject, b.body, b.sent_count, b.created_at,
                   p.full_name AS sent_by_name,
                   COUNT(*) OVER() AS total_count
            FROM broadcasts b
            JOIN profiles p ON p.id = b.sent_by
            ORDER BY b.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )

    items = [dict(r) for r in rows]
    total = int(items[0]["total_count"]) if items else 0
    for it in items:
        it.pop("total_count", None)

    return {"broadcasts": items, "count": total, "page": page, "limit": limit}


# ── Financial Dashboard (super_admin only) ────────────────────────────────────


async def _commission_rate(pool) -> float:
    """Current platform commission rate (fraction 0..1) from pricing config."""
    config = await load_config(pool)
    return float(config.get("platform_commission_rate", 0.20))


@router.get("/finance/summary")
async def finance_summary(
    days: int = Query(30, ge=1, le=365),
    role_info: dict = Depends(get_current_user_with_role),
):
    """Incoming funds vs outgoing (auto payouts + manual expenses) for the window.

    'Realized' revenue = jobs that are both completed and paid. Janitor payouts
    and platform commission are derived from that realized revenue via the
    configurable commission rate. Manual expenses come from the ledger.
    """
    _require_super_admin(role_info)
    pool = get_pool()
    rate = await _commission_rate(pool)

    async with pool.acquire() as conn:
        realized = await conn.fetchrow(
            """
            SELECT COALESCE(SUM(price), 0) AS gross, COUNT(*) AS jobs
            FROM jobs
            WHERE status = 'completed' AND payment_status = 'paid'
              AND created_at >= CURRENT_DATE - $1::int
            """,
            days,
        )
        outstanding = await conn.fetchrow(
            """
            SELECT COALESCE(SUM(price), 0) AS value, COUNT(*) AS count
            FROM jobs
            WHERE status = 'completed' AND payment_status IN ('unpaid','pending')
              AND created_at >= CURRENT_DATE - $1::int
            """,
            days,
        )
        manual = await conn.fetchval(
            """
            SELECT COALESCE(SUM(amount), 0) FROM expenses
            WHERE incurred_on >= CURRENT_DATE - $1::int
            """,
            days,
        )
        daily_rows = await conn.fetch(
            """
            SELECT DATE(created_at) AS day,
                   COALESCE(SUM(price), 0) AS revenue,
                   COUNT(*) AS job_count
            FROM jobs
            WHERE status = 'completed' AND payment_status = 'paid'
              AND created_at >= CURRENT_DATE - $1::int
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            """,
            days,
        )

    gross = float(realized["gross"])
    janitor_payouts = round(gross * (1 - rate), 2)
    platform_commission = round(gross * rate, 2)
    manual_expenses = float(manual)
    net_profit = round(platform_commission - manual_expenses, 2)

    daily = [
        {
            "date": r["day"].isoformat(),
            "revenue": float(r["revenue"]),
            "payout": round(float(r["revenue"]) * (1 - rate), 2),
            "job_count": int(r["job_count"]),
        }
        for r in daily_rows
    ]

    return {
        "days": days,
        "commission_rate": rate,
        "gross_revenue": gross,
        "realized_jobs": int(realized["jobs"]),
        "janitor_payouts": janitor_payouts,
        "platform_commission": platform_commission,
        "manual_expenses": manual_expenses,
        "net_profit": net_profit,
        "outstanding_value": float(outstanding["value"]),
        "outstanding_count": int(outstanding["count"]),
        "daily": daily,
    }


@router.get("/finance/payouts")
async def finance_payouts(
    days: int = Query(30, ge=1, le=365),
    role_info: dict = Depends(get_current_user_with_role),
):
    """Per-janitor computed payouts over realized (completed+paid) jobs."""
    _require_super_admin(role_info)
    pool = get_pool()
    rate = await _commission_rate(pool)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT jan.id::text, p.full_name,
                   COUNT(j.id) AS job_count,
                   COALESCE(SUM(j.price), 0) AS gross
            FROM janitors jan
            JOIN profiles p ON p.id = jan.id
            JOIN jobs j ON j.janitor_id = jan.id
                       AND j.status = 'completed' AND j.payment_status = 'paid'
                       AND j.created_at >= CURRENT_DATE - $1::int
            GROUP BY jan.id, p.full_name
            ORDER BY gross DESC
            LIMIT 50
            """,
            days,
        )

    payouts = [
        {
            "janitor_id": r["id"],
            "full_name": r["full_name"],
            "job_count": int(r["job_count"]),
            "gross": float(r["gross"]),
            "payout": round(float(r["gross"]) * (1 - rate), 2),
        }
        for r in rows
    ]
    return {"payouts": payouts, "count": len(payouts), "commission_rate": rate, "days": days}


@router.get("/finance/expenses")
async def list_expenses(
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=100),
    role_info: dict = Depends(get_current_user_with_role),
):
    """Paginated manual expense ledger."""
    _require_super_admin(role_info)
    pool = get_pool()
    offset = (page - 1) * limit

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT e.id::text, e.category, e.description, e.amount,
                   e.incurred_on, e.created_at,
                   p.full_name AS recorded_by_name,
                   COUNT(*) OVER() AS total_count
            FROM expenses e
            JOIN profiles p ON p.id = e.recorded_by
            ORDER BY e.incurred_on DESC, e.created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )

    items = [dict(r) for r in rows]
    total = int(items[0]["total_count"]) if items else 0
    for it in items:
        it.pop("total_count", None)
        it["amount"] = int(it["amount"])
        it["incurred_on"] = it["incurred_on"].isoformat()

    return {"expenses": items, "count": total, "page": page, "limit": limit}


@router.post("/finance/expenses", status_code=201)
async def add_expense(
    payload: ExpenseCreate,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Record a manual expense (super_admin only)."""
    admin_id = _require_super_admin(role_info)
    pool = get_pool()

    incurred = payload.incurred_on  # asyncpg accepts ISO date string for a DATE column via cast
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO expenses (category, description, amount, incurred_on, recorded_by)
            VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5)
            RETURNING id::text
            """,
            payload.category,
            payload.description,
            payload.amount,
            incurred,
            uuid.UUID(str(admin_id)),
        )

    return {"message": "Expense recorded.", "expense_id": row["id"]}


@router.delete("/finance/expenses/{expense_id}")
async def delete_expense(
    expense_id: str,
    role_info: dict = Depends(get_current_user_with_role),
):
    """Delete a manual expense (super_admin only)."""
    _require_super_admin(role_info)
    try:
        eid = uuid.UUID(expense_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid expense_id format.")

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "DELETE FROM expenses WHERE id = $1 RETURNING id::text", eid
        )
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found.")
    return {"message": "Expense deleted.", "expense_id": expense_id}
