"""
Booking Routes — Thin HTTP Handlers.

All business logic is delegated to ``booking_service``.  Routes only
parse requests, call the service, and return formatted responses.
Every endpoint requires JWT authentication.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.middleware.auth import get_current_user
from app.schema.job_schema import JobCreate, JobStatusUpdate
from app.services import booking_service

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("")
async def create_booking(
    payload: JobCreate,
    user_id: str = Depends(get_current_user),
):
    """Create a new booking. Price is calculated server-side."""
    job = await booking_service.create_booking(user_id, payload)
    return {"message": "Booking created.", "job": job}


@router.get("")
async def get_my_bookings(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    """List the current user's bookings with pagination."""
    return await booking_service.get_user_bookings(user_id, status, page, limit)


@router.get("/assigned")
async def get_assigned_bookings(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    """List jobs assigned to the current janitor (filtered by janitor_id)."""
    return await booking_service.get_janitor_bookings(user_id, status, page, limit)


@router.get("/{job_id}")
async def get_booking(
    job_id: str,
    user_id: str = Depends(get_current_user),
):
    """Get a single booking by ID (must be owner or assigned janitor)."""
    return await booking_service.get_booking(user_id, job_id)


@router.patch("/{job_id}/status")
async def update_status(
    job_id: str,
    payload: JobStatusUpdate,
    user_id: str = Depends(get_current_user),
):
    """Update a booking's status (validates transition rules)."""
    job = await booking_service.update_booking_status(
        user_id, job_id, payload.new_status.value
    )
    return {"message": "Status updated.", "job": job}


@router.post("/{job_id}/cancel")
async def cancel_booking(
    job_id: str,
    user_id: str = Depends(get_current_user),
):
    """Cancel a pending or confirmed booking."""
    job = await booking_service.cancel_booking(user_id, job_id)
    return {"message": "Booking cancelled.", "job": job}


@router.post("/{job_id}/accept")
async def accept_job(
    job_id: str,
    user_id: str = Depends(get_current_user),
):
    """Janitor accepts a pending job assigned to them (→ confirmed)."""
    job = await booking_service.accept_job(user_id, job_id)
    return {"message": "Job accepted.", "job": job}


@router.post("/{job_id}/reject")
async def reject_job(
    job_id: str,
    user_id: str = Depends(get_current_user),
):
    """Janitor rejects a pending job; it is unassigned for re-matching."""
    job = await booking_service.reject_job(user_id, job_id)
    return {"message": "Job rejected.", "job": job}
