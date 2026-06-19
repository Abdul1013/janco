"""
Room Scan Service.

Orchestrates the room-scan engine and optionally combines scan results
with the pricing engine to produce a scan-aware price estimate.

This is the layer that routes call — it manages I/O (database persistence)
and delegates pure computation to the engines.
"""

from __future__ import annotations

import uuid
from typing import Optional

from app.db.pool import get_pool
from app.engines.pricing_engine import (
    calculate_dynamic_price,
    calculate_fixed_price,
    calculate_standard_price,
)
from app.engines.room_scan_engine import (
    ScanResult,
    analyse_room_image,
    analyse_room_with_dimensions,
)
from app.schema.scan_schema import (
    RoomDimensionsRequest,
    RoomScanRequest,
    RoomScanResponse,
    ScanPriceResponse,
)


def _scan_to_response(result: ScanResult) -> RoomScanResponse:
    """Convert an engine ScanResult to a Pydantic response."""
    return RoomScanResponse(
        estimated_area=result.estimated_area,
        room_size=result.room_size.value,
        clutter_level=result.clutter_level.value,
        clutter_score=result.clutter_score,
        price_modifier=result.price_modifier,
        confidence=result.confidence,
        analysis_mode=result.analysis_mode,
        details=result.details,
    )


async def scan_room_image(
    req: RoomScanRequest,
    user_id: str,
) -> RoomScanResponse:
    """Analyse a room image and persist the scan result.

    Args:
        req: Validated scan request with base64 image data.
        user_id: Authenticated user's UUID (from JWT).

    Returns:
        RoomScanResponse with analysis results.
    """
    result = analyse_room_image(
        image_base64=req.image_base64,
        width_hint=req.width_hint,
        height_hint=req.height_hint,
    )

    # Persist scan asynchronously
    await _persist_scan(user_id, result)

    return _scan_to_response(result)


async def scan_room_dimensions(
    req: RoomDimensionsRequest,
    user_id: str,
) -> RoomScanResponse:
    """Analyse a room from manual dimensions and persist result.

    Args:
        req: Validated request with width, length, clutter.
        user_id: Authenticated user's UUID.

    Returns:
        RoomScanResponse with analysis results.
    """
    result = analyse_room_with_dimensions(
        width_m=req.width_m,
        length_m=req.length_m,
        clutter_score=req.clutter_score,
    )

    await _persist_scan(user_id, result)

    return _scan_to_response(result)


async def scan_and_estimate_price(
    req: RoomScanRequest,
    user_id: str,
    service_type: str = "house_cleaning",
    rooms: int = 1,
    toilets: int = 0,
    extras: Optional[dict] = None,
    use_fixed: bool = True,
    surge: str = "normal",
) -> ScanPriceResponse:
    """Scan a room image, then produce a scan-adjusted price estimate.

    Combines the room-scan engine's price_modifier with the pricing
    engine to give the customer an accurate quote before booking.

    Args:
        req: Scan request with image data.
        user_id: Authenticated user UUID.
        service_type: Cleaning service category.
        rooms: Number of rooms.
        toilets: Number of toilets.
        extras: Add-on flags.
        use_fixed: Use fixed-tier pricing if True, dynamic otherwise.
        surge: Surge period.

    Returns:
        ScanPriceResponse with scan result and adjusted price.
    """
    scan_result = analyse_room_image(
        image_base64=req.image_base64,
        width_hint=req.width_hint,
        height_hint=req.height_hint,
    )

    await _persist_scan(user_id, scan_result)

    # Get base price estimate
    if use_fixed:
        price_result = calculate_fixed_price(
            service_type=service_type,
            rooms=rooms,
            toilets=toilets,
            extras=extras,
        )
    else:
        price_result = calculate_dynamic_price(
            service_type=service_type,
            rooms=rooms,
            toilets=toilets,
            extras=extras,
            surge=surge,
        )

    # Apply scan modifier to the price
    adjusted_total = int(price_result.total * scan_result.price_modifier)
    adjusted_total = max(5_000, min(adjusted_total, 200_000))

    price_dict = {
        "total": adjusted_total,
        "base_total": price_result.total,
        "scan_modifier": scan_result.price_modifier,
        "breakdown": price_result.breakdown + [
            f"Room scan modifier: x{scan_result.price_modifier}"
        ],
        "mode": price_result.mode,
        "surge_multiplier": price_result.surge_multiplier,
    }

    return ScanPriceResponse(
        scan=_scan_to_response(scan_result),
        price_estimate=price_dict,
    )


async def _persist_scan(user_id: str, result: ScanResult) -> None:
    """Save a scan result to the room_scans table.

    Fails silently — scan persistence is non-critical and should
    never block the user-facing response.
    """
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO room_scans (id, user_id, estimated_area, room_size,
                    clutter_level, clutter_score, price_modifier, confidence,
                    analysis_mode)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                uuid.uuid4(),
                uuid.UUID(user_id),
                result.estimated_area,
                result.room_size.value,
                result.clutter_level.value,
                result.clutter_score,
                result.price_modifier,
                result.confidence,
                result.analysis_mode,
            )
    except Exception:
        # Log in production; for beta, silently skip persistence failures
        pass
