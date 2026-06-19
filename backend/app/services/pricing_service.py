"""
Pricing Service.

Orchestrates the pricing engine to produce price estimates.
Loads rates from the pricing_config DB table (cached) and injects them
into the engine so rates are dynamic without a redeploy.
"""

from __future__ import annotations

from typing import Optional

from app.db.pool import get_pool
from app.engines.pricing_engine import (
    PriceResult,
    calculate_scan_price,
    calculate_standard_price,
    calculate_transport_fee,
)
from app.repositories.pricing_config import load_config
from app.schema.job_schema import PriceEstimateRequest, PriceEstimateResponse


async def estimate_price(
    req: PriceEstimateRequest,
    scan_modifier: Optional[float] = None,
    distance_km: Optional[float] = None,
) -> PriceEstimateResponse:
    """Compute a price estimate from the request parameters.

    Args:
        req: Validated request with service_type, rooms, toilets, extras,
             use_scan flag, area_m2, and surge period.
        scan_modifier: Clutter modifier from the scan engine (default 1.0).
        distance_km: Janitor distance for transport surcharge calculation.

    Returns:
        PriceEstimateResponse with total, breakdown, transport_fee, and mode.
    """
    config = await load_config(get_pool())

    transport_fee = calculate_transport_fee(distance_km or 0.0, config)

    if req.use_scan and req.area_m2 and req.area_m2 > 0:
        result: PriceResult = calculate_scan_price(
            area_m2=req.area_m2,
            clutter_modifier=scan_modifier or 1.0,
            config=config,
            surge=req.surge,
            transport_fee=transport_fee,
        )
    else:
        result = calculate_standard_price(
            service_type=req.service_type,
            rooms=req.rooms,
            toilets=req.toilets,
            clothes_count=req.clothes_count,
            extras=req.extras,
            surge=req.surge,
            config=config,
            transport_fee=transport_fee,
        )

    return PriceEstimateResponse(
        total=result.total,
        breakdown=result.breakdown,
        mode=result.mode,
        surge_multiplier=result.surge_multiplier,
        transport_fee=result.transport_fee,
    )
