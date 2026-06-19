"""
Janitor Routes.

Nearby janitor search (using the dispatch engine), profile lookup,
and availability toggle.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.middleware.auth import get_current_user
from app.services import janitor_service

router = APIRouter(prefix="/janitors", tags=["Janitors"])


@router.get("/nearby")
async def get_nearby(
    lat: float = Query(..., description="Job latitude"),
    lng: float = Query(..., description="Job longitude"),
    service_type: str = Query(..., description="Requested service type"),
    _user_id: str = Depends(get_current_user),
):
    """Return ranked list of available janitors near the job location."""
    return await janitor_service.get_nearby_janitors(lat, lng, service_type)


@router.get("/{janitor_id}")
async def get_profile(
    janitor_id: str,
    _user_id: str = Depends(get_current_user),
):
    """Get a janitor's public profile."""
    return await janitor_service.get_janitor_profile(janitor_id)


@router.post("/register")
async def register_janitor(
    payload: dict,
    user_id: str = Depends(get_current_user),
):
    """Register the current user as a janitor (pending approval).

    Payload fields:
        phone, address, service_types (list of strings),
        experience (string), bio (string).
    """
    return await janitor_service.register_janitor(user_id, payload)


@router.patch("/me/availability")
async def toggle_availability(
    available: bool = Query(...),
    lat: float = Query(None, description="Janitor's current latitude"),
    lng: float = Query(None, description="Janitor's current longitude"),
    user_id: str = Depends(get_current_user),
):
    """Toggle the current janitor's availability status.

    When going online, optionally update the janitor's GPS location
    so the dispatch engine uses their current position.
    """
    return await janitor_service.update_availability(user_id, available, lat=lat, lng=lng)
