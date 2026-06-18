"""
Pricing Engine — Pure Computation Module.

Calculates cleaning-service prices using two modes:
  1. **Standard** (linear per-unit): rooms × rate + toilets × rate + extras + transport.
  2. **Scan** (area-based): area_m2 × scan_rate × clutter_modifier + transport.

All rates are read from a config dict supplied by the caller (loaded from
the pricing_config DB table). A DEFAULT_CONFIG fallback is built into the
config repository so this module never sees empty values.

Both modes enforce a configurable floor and ceiling to prevent absurd results.

This module has **no I/O**: it receives data and returns a result.
Every function is independently testable.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ServiceType(str, Enum):
    HOUSE_CLEANING = "house_cleaning"
    DEEP_CLEANING = "deep_cleaning"
    LAUNDRY = "laundry"
    FUMIGATION = "fumigation"


class SurgePeriod(str, Enum):
    NORMAL = "normal"
    PEAK = "peak"
    HOLIDAY = "holiday"


@dataclass
class PriceResult:
    """Immutable result of a pricing calculation."""
    total: int
    breakdown: list[str]
    mode: str
    surge_multiplier: float = 1.0
    transport_fee: int = 0
    raw_total: int = 0


# Module-level constants for backward compatibility with existing imports.
# Authoritative values live in pricing_config DEFAULT_CONFIG.
PRICE_FLOOR = 5_000
PRICE_CEILING = 200_000


def _surge_multiplier(surge: str, config: dict) -> float:
    period = SurgePeriod(surge)
    if period == SurgePeriod.PEAK:
        return float(config.get("surge_peak", 1.2))
    if period == SurgePeriod.HOLIDAY:
        return float(config.get("surge_holiday", 1.5))
    return 1.0


def calculate_transport_fee(distance_km: float, config: dict) -> int:
    """Return the transport surcharge for a given janitor distance.

    Bands: 0 fee up to threshold_km, then +band_fee per band_km beyond.
    Example with threshold=5, band=5, fee=1000:
        6 km  → 1 band  → ₦1,000
        11 km → 2 bands → ₦2,000
    """
    threshold = float(config.get("transport_threshold_km", 5))
    band_km = float(config.get("transport_band_km", 5))
    band_fee = int(config.get("transport_band_fee", 1000))

    if distance_km <= threshold or band_km <= 0:
        return 0

    bands = math.floor((distance_km - threshold) / band_km) + 1
    return bands * band_fee


def calculate_standard_price(
    service_type: str,
    rooms: int = 1,
    toilets: int = 0,
    clothes_count: int = 0,
    extras: Optional[dict[str, bool]] = None,
    surge: str = "normal",
    config: Optional[dict] = None,
    transport_fee: int = 0,
) -> PriceResult:
    """Calculate price using linear per-unit rates.

    Formula for house cleaning:
        subtotal = rooms × room_rate + toilets × toilet_rate + Σ extras
        total = subtotal × surge_multiplier + transport_fee

    Args:
        service_type: One of ServiceType values.
        rooms: Number of rooms.
        toilets: Number of toilets.
        clothes_count: Number of laundry items.
        extras: Boolean flags — kitchen, living_room, window_cleaning, ironing, delicates.
        surge: 'normal', 'peak', or 'holiday'.
        config: Pricing config dict from the DB repository.
        transport_fee: Pre-calculated transport surcharge in ₦.

    Returns:
        PriceResult with total, breakdown, transport_fee, mode='standard'.
    """
    if config is None:
        from app.repositories.pricing_config import DEFAULT_CONFIG
        config = DEFAULT_CONFIG

    extras = extras or {}
    breakdown: list[str] = []
    subtotal = 0

    stype = ServiceType(service_type)
    multiplier = _surge_multiplier(surge, config)

    if stype == ServiceType.HOUSE_CLEANING:
        room_rate = int(config.get("room_rate", 1000))
        toilet_rate = int(config.get("toilet_rate", 500))
        if rooms > 0:
            room_cost = rooms * room_rate
            subtotal += room_cost
            breakdown.append(f"{rooms} room(s) × ₦{room_rate:,}: ₦{room_cost:,}")
        if toilets > 0:
            toilet_cost = toilets * toilet_rate
            subtotal += toilet_cost
            breakdown.append(f"{toilets} toilet(s) × ₦{toilet_rate:,}: ₦{toilet_cost:,}")
        for key, label, cfg_key in [
            ("kitchen", "Kitchen", "kitchen_extra"),
            ("living_room", "Living Room", "living_room_extra"),
            ("window_cleaning", "Window Cleaning", "window_cleaning_extra"),
        ]:
            if extras.get(key):
                rate = int(config.get(cfg_key, 0))
                subtotal += rate
                breakdown.append(f"+ {label}: ₦{rate:,}")

    elif stype == ServiceType.DEEP_CLEANING:
        deep_rate = int(config.get("deep_cleaning_room_rate", 3000))
        room_cost = rooms * deep_rate
        subtotal = room_cost
        breakdown.append(f"{rooms} room(s) × ₦{deep_rate:,} (deep): ₦{room_cost:,}")

    elif stype == ServiceType.LAUNDRY:
        per_item = int(config.get("laundry_per_item", 300))
        if clothes_count > 0:
            base = clothes_count * per_item
            subtotal += base
            breakdown.append(f"{clothes_count} item(s) × ₦{per_item:,}: ₦{base:,}")
        if extras.get("ironing"):
            rate = int(config.get("laundry_ironing", 500))
            cost = clothes_count * rate
            subtotal += cost
            breakdown.append(f"+ Ironing: ₦{cost:,}")
        if extras.get("delicates"):
            rate = int(config.get("laundry_delicates", 100))
            cost = clothes_count * rate
            subtotal += cost
            breakdown.append(f"+ Delicates Surcharge: ₦{cost:,}")

    elif stype == ServiceType.FUMIGATION:
        flat = int(config.get("fumigation_flat", 10000))
        subtotal = flat
        breakdown.append(f"Fumigation Service: ₦{flat:,}")

    total = int(subtotal * multiplier)
    if multiplier != 1.0:
        breakdown.append(f"Surge ({surge}): ×{multiplier}")

    if transport_fee > 0:
        total += transport_fee
        breakdown.append(f"Transport fee: ₦{transport_fee:,}")

    clamped = _clamp(total, config)
    return PriceResult(
        total=clamped,
        breakdown=breakdown,
        mode="standard",
        surge_multiplier=multiplier,
        transport_fee=transport_fee,
        raw_total=total,
    )


def calculate_scan_price(
    area_m2: float,
    clutter_modifier: float,
    config: Optional[dict] = None,
    surge: str = "normal",
    transport_fee: int = 0,
) -> PriceResult:
    """Calculate price from scanned room area.

    Formula:
        subtotal = area_m2 × scan_rate_per_sqm × clutter_modifier
        total = subtotal × surge_multiplier + transport_fee

    Args:
        area_m2: Estimated room area from the scan engine.
        clutter_modifier: Clutter multiplier (1.0 = baseline, up to 1.6).
        config: Pricing config dict.
        surge: Surge period.
        transport_fee: Pre-calculated transport surcharge.

    Returns:
        PriceResult with mode='scan'.
    """
    if config is None:
        from app.repositories.pricing_config import DEFAULT_CONFIG
        config = DEFAULT_CONFIG

    scan_rate = float(config.get("scan_rate_per_sqm", 100))
    multiplier = _surge_multiplier(surge, config)
    breakdown: list[str] = []

    subtotal = area_m2 * scan_rate * clutter_modifier
    breakdown.append(f"{area_m2:.1f} m² × ₦{scan_rate:,.0f}/m²: ₦{area_m2 * scan_rate:,.0f}")
    if clutter_modifier != 1.0:
        breakdown.append(f"Clutter adjustment: ×{clutter_modifier:.2f}")

    total = int(subtotal * multiplier)
    if multiplier != 1.0:
        breakdown.append(f"Surge ({surge}): ×{multiplier}")

    if transport_fee > 0:
        total += transport_fee
        breakdown.append(f"Transport fee: ₦{transport_fee:,}")

    clamped = _clamp(total, config)
    return PriceResult(
        total=clamped,
        breakdown=breakdown,
        mode="scan",
        surge_multiplier=multiplier,
        transport_fee=transport_fee,
        raw_total=total,
    )


def _clamp(price: int, config: Optional[dict] = None) -> int:
    if price <= 0:
        return 0
    if config is None:
        return max(5000, min(price, 200000))
    floor = int(config.get("price_floor", 5000))
    ceiling = int(config.get("price_ceiling", 200000))
    if floor == 0:
        return min(price, ceiling)
    return max(floor, min(price, ceiling))


# ── Backward-compat aliases ──────────────────────────────────────────────────

def calculate_fixed_price(
    service_type: str,
    rooms: int = 1,
    toilets: int = 0,
    clothes_count: int = 0,
    extras: Optional[dict] = None,
    scan_modifier: Optional[float] = None,
    config: Optional[dict] = None,
) -> PriceResult:
    """Alias for calculate_standard_price, kept for backward compatibility.

    scan_modifier is applied as a multiplier to the final total when provided.
    """
    result = calculate_standard_price(
        service_type=service_type,
        rooms=rooms,
        toilets=toilets,
        clothes_count=clothes_count,
        extras=extras,
        surge="normal",
        config=config,
    )
    if scan_modifier is not None and scan_modifier != 1.0:
        adjusted = int(result.total * scan_modifier)
        if config is None:
            from app.repositories.pricing_config import DEFAULT_CONFIG
            config = DEFAULT_CONFIG
        clamped = _clamp(adjusted, config)
        return PriceResult(
            total=clamped,
            breakdown=result.breakdown + [f"Room scan modifier: x{scan_modifier}"],
            mode="standard",
            surge_multiplier=result.surge_multiplier,
            transport_fee=0,
            raw_total=adjusted,
        )
    return result


def calculate_dynamic_price(
    service_type: str,
    rooms: int = 0,
    toilets: int = 0,
    clothes_count: int = 0,
    extras: Optional[dict] = None,
    surge: str = "normal",
    scan_modifier: Optional[float] = None,
    config: Optional[dict] = None,
) -> PriceResult:
    """Alias for calculate_standard_price, kept for backward compatibility."""
    result = calculate_standard_price(
        service_type=service_type,
        rooms=rooms,
        toilets=toilets,
        clothes_count=clothes_count,
        extras=extras,
        surge=surge,
        config=config,
    )
    if scan_modifier is not None and scan_modifier != 1.0:
        if config is None:
            from app.repositories.pricing_config import DEFAULT_CONFIG
            config = DEFAULT_CONFIG
        adjusted = _clamp(int(result.total * scan_modifier), config)
        return PriceResult(
            total=adjusted,
            breakdown=result.breakdown + [f"Room scan modifier: x{scan_modifier}"],
            mode="dynamic",
            surge_multiplier=result.surge_multiplier,
            transport_fee=0,
            raw_total=adjusted,
        )
    return PriceResult(
        total=result.total,
        breakdown=result.breakdown,
        mode="dynamic",
        surge_multiplier=result.surge_multiplier,
        transport_fee=result.transport_fee,
        raw_total=result.raw_total,
    )
