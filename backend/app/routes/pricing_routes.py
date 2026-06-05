"""
Pricing Routes.

Single endpoint to get a price estimate.  Protected so only
authenticated users can query prices.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.middleware.auth import get_current_user
from app.schema.job_schema import PriceEstimateRequest, PriceEstimateResponse
from app.services import pricing_service

router = APIRouter(prefix="/pricing", tags=["Pricing"])


@router.post("/estimate", response_model=PriceEstimateResponse)
async def estimate_price(
    payload: PriceEstimateRequest,
    _user_id: str = Depends(get_current_user),
):
    """Return a price estimate with itemised breakdown.

    Supports standard (per-room) and scan (per-m²) modes.
    Optionally includes transport surcharge when distance_km is provided.
    """
    return await pricing_service.estimate_price(
        req=payload,
        distance_km=payload.distance_km,
    )
