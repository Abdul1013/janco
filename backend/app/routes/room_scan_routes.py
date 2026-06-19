"""
Room Scan Routes.

Endpoints for AI-powered room analysis:
  - POST /v1/scan/image     — analyse a room photo
  - POST /v1/scan/dimensions — analyse from manual measurements
  - POST /v1/scan/estimate   — scan + price estimate combo
"""

from __future__ import annotations

from typing import Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.middleware.auth import get_current_user
from app.schema.scan_schema import (
    RoomDimensionsRequest,
    RoomScanRequest,
    RoomScanResponse,
    ScanPriceResponse,
)
from app.services import room_scan_service

router = APIRouter(prefix="/scan", tags=["Room Scan"])


@router.post("/image", response_model=RoomScanResponse)
async def scan_image(
    payload: RoomScanRequest,
    user_id: str = Depends(get_current_user),
):
    """Analyse a room image and return size/clutter estimates.

    Accepts a base64-encoded JPEG or PNG. Returns estimated area,
    room classification, clutter level, and price modifier.
    """
    return await room_scan_service.scan_room_image(payload, user_id)


@router.post("/dimensions", response_model=RoomScanResponse)
async def scan_dimensions(
    payload: RoomDimensionsRequest,
    user_id: str = Depends(get_current_user),
):
    """Analyse a room from manual width/length measurements.

    Used when the customer provides dimensions directly or when
    a future LiDAR/AR module supplies precise measurements.
    """
    return await room_scan_service.scan_room_dimensions(payload, user_id)


class ScanEstimateRequest(BaseModel):
    """Combined request: image scan + pricing parameters."""
    image_base64: str = Field(..., min_length=100)
    width_hint: Optional[int] = None
    height_hint: Optional[int] = None
    service_type: str = "house_cleaning"
    rooms: int = 1
    toilets: int = 0
    extras: Optional[Dict[str, bool]] = None
    use_fixed: bool = True
    surge: str = "normal"


@router.post("/estimate", response_model=ScanPriceResponse)
async def scan_and_estimate(
    payload: ScanEstimateRequest,
    user_id: str = Depends(get_current_user),
):
    """Scan a room image and return both analysis and adjusted price.

    Combines the scan engine's price modifier with the pricing engine
    so the customer gets a single call for scan + quote.
    """
    scan_req = RoomScanRequest(
        image_base64=payload.image_base64,
        width_hint=payload.width_hint,
        height_hint=payload.height_hint,
    )
    return await room_scan_service.scan_and_estimate_price(
        req=scan_req,
        user_id=user_id,
        service_type=payload.service_type,
        rooms=payload.rooms,
        toilets=payload.toilets,
        extras=payload.extras,
        use_fixed=payload.use_fixed,
        surge=payload.surge,
    )
