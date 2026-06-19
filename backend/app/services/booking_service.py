"""
Booking Service.

Business logic for creating, retrieving, updating, and cancelling
bookings.  Orchestrates repositories, the pricing engine, and
(eventually) the notification service.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.db.pool import get_pool
from app.engines.pricing_engine import (
    calculate_scan_price,
    calculate_standard_price,
    calculate_transport_fee,
)
from app.repositories import job_repo
from app.repositories.pricing_config import load_config
from app.schema.job_schema import JobCreate, JobStatus, PriceEstimateRequest
from app.services import notification_service


async def create_booking(user_id: str, data: JobCreate) -> dict:
    """Create a new booking with an auto-calculated price.

    Price is calculated server-side using DB config rates.
    Transport fee is included when distance_km is provided.

    Args:
        user_id: Authenticated customer ID.
        data: Booking details from the request body.

    Returns:
        The created job dict including calculated price.
    """
    config = await load_config(get_pool())
    transport_fee = calculate_transport_fee(getattr(data, "distance_km", None) or 0.0, config)

    if getattr(data, "use_scan", False) and getattr(data, "area_m2", None):
        price_result = calculate_scan_price(
            area_m2=data.area_m2,
            clutter_modifier=1.0,
            config=config,
            transport_fee=transport_fee,
        )
    else:
        price_result = calculate_standard_price(
            service_type=data.service_type,
            rooms=data.rooms,
            toilets=data.toilets,
            extras=data.extras or {},
            config=config,
            transport_fee=transport_fee,
        )

    job_data: dict[str, Any] = {
        "user_id": user_id,
        "service_type": data.service_type,
        "scheduled_date": data.scheduled_date,
        "scheduled_time": data.scheduled_time,
        "address": data.address,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "rooms": data.rooms,
        "toilets": data.toilets,
        "notes": data.notes,
        "price": price_result.total,
        "transport_fee": price_result.transport_fee,
    }

    if data.janitor_id:
        job_data["janitor_id"] = data.janitor_id

    created_job = await job_repo.create_job(job_data)

    # Notify janitor if directly assigned
    if data.janitor_id:
        await notification_service.notify_new_booking_assigned(
            janitor_id=data.janitor_id,
            job_id=created_job.get("id", ""),
            service_type=data.service_type,
        )

    return created_job


async def get_booking(user_id: str, job_id: str) -> dict:
    """Fetch a single booking, ensuring the user owns it.

    Args:
        user_id: Authenticated user ID.
        job_id: The job to retrieve.

    Returns:
        Job dict.

    Raises:
        HTTPException 404: If not found.
        HTTPException 403: If user doesn't own the job.
    """
    job = await job_repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Booking not found.")

    if str(job["user_id"]) != str(user_id) and str(job.get("janitor_id") or "") != str(user_id):
        raise HTTPException(status_code=403, detail="Not authorised.")

    return job


async def get_user_bookings(
    user_id: str,
    status_filter: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    """Fetch paginated bookings for the current user.

    Args:
        user_id: Authenticated user ID.
        status_filter: Optional status filter.
        page: Page number.
        limit: Page size.

    Returns:
        Paginated result dict.
    """
    return await job_repo.get_user_jobs(user_id, status_filter, page, limit)


async def get_janitor_bookings(
    janitor_id: str,
    status_filter: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> dict:
    """Fetch jobs assigned to the authenticated janitor."""
    return await job_repo.get_janitor_jobs(janitor_id, status_filter, page, limit)


async def update_booking_status(user_id: str, job_id: str, new_status: str) -> dict:
    """Update a booking's status with ownership check.

    Args:
        user_id: Authenticated user ID.
        job_id: Target job.
        new_status: Target status.

    Returns:
        Updated job dict.
    """
    # Verify ownership
    await get_booking(user_id, job_id)

    # Delegate transition validation to the repo
    updated_job = await job_repo.update_status(job_id, new_status)

    # Fire push notifications for status change
    await notification_service.notify_job_status_change(updated_job, new_status)

    return updated_job


async def accept_job(janitor_id: str, job_id: str) -> dict:
    """Janitor accepts a pending job assigned to them (→ confirmed).

    Args:
        janitor_id: Authenticated janitor's user ID.
        job_id: Target job.

    Returns:
        Updated job dict.

    Raises:
        HTTPException 404: Job not found.
        HTTPException 403: Job not assigned to this janitor.
        HTTPException 400: Job is not in a pending state.
    """
    job = await job_repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if str(job.get("janitor_id") or "") != str(janitor_id):
        raise HTTPException(status_code=403, detail="This job is not assigned to you.")
    if job["status"] != JobStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Only pending jobs can be accepted.")

    # pending → confirmed (the DB one-active-job index guards double-booking)
    updated_job = await job_repo.update_status(job_id, JobStatus.CONFIRMED.value)

    # Notify the customer their booking is confirmed
    await notification_service.notify_job_status_change(updated_job, JobStatus.CONFIRMED.value)

    return updated_job


async def reject_job(janitor_id: str, job_id: str) -> dict:
    """Janitor rejects a pending job assigned to them.

    The job is unassigned (janitor_id → NULL) and left pending so it can be
    re-matched; the customer is notified that we're finding another janitor.

    Args:
        janitor_id: Authenticated janitor's user ID.
        job_id: Target job.

    Returns:
        Updated (unassigned) job dict.

    Raises:
        HTTPException 404: Job not found.
        HTTPException 403: Job not assigned to this janitor.
        HTTPException 400: Job is not in a pending state.
    """
    job = await job_repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if str(job.get("janitor_id") or "") != str(janitor_id):
        raise HTTPException(status_code=403, detail="This job is not assigned to you.")
    if job["status"] != JobStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Only pending jobs can be rejected.")

    updated_job = await job_repo.unassign_janitor(job_id)

    # Notify the customer we're re-matching them
    await notification_service.notify_job_rejected(updated_job)

    return updated_job


async def cancel_booking(user_id: str, job_id: str) -> dict:
    """Cancel a booking (shorthand for setting status to cancelled).

    Args:
        user_id: Authenticated user ID.
        job_id: Target job.

    Returns:
        Updated job dict.
    """
    return await update_booking_status(user_id, job_id, JobStatus.CANCELLED.value)
