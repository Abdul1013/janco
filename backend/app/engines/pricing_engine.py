"""
Pricing Engine — Pure Computation Module.

Calculates cleaning-service prices using two modes:
  1. **Fixed** (tier-based): lookup by service type + room-count tier.
  2. **Dynamic** (unit-based): per-room, per-toilet, plus extras × surge.

Both modes enforce a floor of ₦5 000 and a ceiling of ₦200 000
to prevent algorithmic errors from producing absurd results.

This module has **no I/O**: it receives data and returns a result dict.
Every function is independently testable.

Ported from ``frontend/App/utils/pricing.js`` (271 lines) during Sprint 1.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional



class ServiceType(str, Enum):
    """Supported cleaning service categories."""
    HOUSE_CLEANING = "house_cleaning"
    DEEP_CLEANING = "deep_cleaning"
    LAUNDRY = "laundry"
    FUMIGATION = "fumigation"


class SurgePeriod(str, Enum):
    """Time-of-day / day-of-week surge classification."""
    NORMAL = "normal"      # weekday daytime
    PEAK = "peak"          # weekends, evenings
    HOLIDAY = "holiday"    # public holidays


SURGE_MULTIPLIERS: dict[SurgePeriod, float] = {
    SurgePeriod.NORMAL: 1.0,
    SurgePeriod.PEAK: 1.2,
    SurgePeriod.HOLIDAY: 1.5,
}

# Fixed-tier prices (₦)
FIXED_PRICES = {
    ServiceType.HOUSE_CLEANING: {
        "basic": 24_000,     # 1–2 rooms
        "standard": 35_000,  # 3–4 rooms
        "premium": 50_000,   # 5+ rooms
        "kitchen": 2_000,
        "living_room": 1_500,
        "window_cleaning": 1_000,
    },
    ServiceType.DEEP_CLEANING: {
        "basic": 40_000,
        "standard": 60_000,
        "premium": 85_000,
    },
    ServiceType.LAUNDRY: {
        "per_item": 300,
        "ironing_per_item": 500,
        "delicates_surcharge": 100,
    },
    ServiceType.FUMIGATION: {
        "flat_rate": 10_000,
    },
}

# Dynamic per-unit rates (₦) — used in unit-based mode
ROOM_RATE = 1_500
TOILET_RATE = 800
EXTRA_RATES = {
    "kitchen": 2_000,
    "living_room": 1_500,
    "window_cleaning": 1_000,
}

# Absolute bounds
PRICE_FLOOR = 5_000
PRICE_CEILING = 200_000



@dataclass
class PriceResult:
    """Immutable result of a pricing calculation.

    Attributes:
        total: Final price in Naira (after bounds enforcement).
        breakdown: Human-readable line items.
        mode: 'fixed' or 'dynamic'.
        surge_multiplier: Applied multiplier (1.0 if none).
        raw_total: Total before floor/ceiling clamp.
    """
    total: int
    breakdown: list[str]
    mode: str
    surge_multiplier: float = 1.0
    raw_total: int = 0



# Fixed (tier-based) pricing


def calculate_fixed_price(
    service_type: str,
    rooms: int = 1,
    toilets: int = 0,
    clothes_count: int = 0,
    extras: Optional[dict[str, bool]] = None,
    scan_modifier: Optional[float] = None,
) -> PriceResult:
    """Calculate price using fixed-tier lookup.

    Args:
        service_type: One of 'house_cleaning', 'deep_cleaning', 'laundry',
                      'fumigation'.
        rooms: Number of rooms (house/deep cleaning).
        toilets: Number of toilets (currently informational for fixed mode).
        clothes_count: Number of laundry items.
        extras: Boolean flags for add-ons — keys: kitchen, living_room,
                window_cleaning, ironing, delicates.

    Returns:
        PriceResult with total, breakdown, and mode='fixed'.

    Raises:
        ValueError: If service_type is not recognised.
    """
    extras = extras or {}
    breakdown: list[str] = []
    price = 0

    stype = ServiceType(service_type)

    if stype == ServiceType.HOUSE_CLEANING:
        tiers = FIXED_PRICES[stype]
        if rooms <= 2:
            price = tiers["basic"]
            breakdown.append(f"Basic House Cleaning (1-2 rooms): ₦{price:,}")
        elif rooms <= 4:
            price = tiers["standard"]
            breakdown.append(f"Standard House Cleaning (3-4 rooms): ₦{price:,}")
        else:
            price = tiers["premium"]
            breakdown.append(f"Premium House Cleaning (5+ rooms): ₦{price:,}")
        for key, label in [("kitchen", "Kitchen"), ("living_room", "Living Room"), ("window_cleaning", "Window Cleaning")]:
            if extras.get(key):
                extra_price = tiers[key]
                price += extra_price
                breakdown.append(f"+ {label}: ₦{extra_price:,}")

    elif stype == ServiceType.DEEP_CLEANING:
        tiers = FIXED_PRICES[stype]
        if rooms <= 2:
            price = tiers["basic"]
            breakdown.append(f"Basic Deep Cleaning (1-2 rooms): ₦{price:,}")
        elif rooms <= 4:
            price = tiers["standard"]
            breakdown.append(f"Standard Deep Cleaning (3-4 rooms): ₦{price:,}")
        else:
            price = tiers["premium"]
            breakdown.append(f"Premium Deep Cleaning (5+ rooms): ₦{price:,}")

    elif stype == ServiceType.LAUNDRY:
        rates = FIXED_PRICES[stype]
        price = clothes_count * rates["per_item"]
        breakdown.append(f"Laundry ({clothes_count} items × ₦{rates['per_item']}): ₦{price:,}")
        if extras.get("ironing"):
            ironing = clothes_count * rates["ironing_per_item"]
            price += ironing
            breakdown.append(f"+ Ironing: ₦{ironing:,}")
        if extras.get("delicates"):
            delicates = clothes_count * rates["delicates_surcharge"]
            price += delicates
            breakdown.append(f"+ Delicates Surcharge: ₦{delicates:,}")

    elif stype == ServiceType.FUMIGATION:
        price = FIXED_PRICES[stype]["flat_rate"]
        breakdown.append(f"Fumigation Service: ₦{price:,}")

    # Apply room-scan modifier if provided
    if scan_modifier is not None:
        raw_with_scan = int(price * scan_modifier)
        breakdown.append(f"Room scan modifier: x{scan_modifier}")
        price = raw_with_scan

    clamped = _clamp(price)
    return PriceResult(total=clamped, breakdown=breakdown, mode="fixed", raw_total=price)



def calculate_dynamic_price(
    service_type: str,
    rooms: int = 0,
    toilets: int = 0,
    clothes_count: int = 0,
    extras: Optional[dict[str, bool]] = None,
    surge: str = "normal",
    scan_modifier: Optional[float] = None,
) -> PriceResult:
    """Calculate price using per-unit rates with optional surge multiplier.

    The formula for house cleaning:
        P = (rooms × R_r + toilets × R_t + Σ extras) × M_s

    Args:
        service_type: Service category string.
        rooms: Number of rooms.
        toilets: Number of toilets.
        clothes_count: Number of laundry items.
        extras: Boolean flags for add-ons.
        surge: Surge period — 'normal', 'peak', or 'holiday'.

    Returns:
        PriceResult with total, breakdown, mode='dynamic', surge_multiplier.

    Raises:
        ValueError: If service_type or surge is not recognised.
    """
    extras = extras or {}
    breakdown: list[str] = []
    subtotal = 0
    multiplier = SURGE_MULTIPLIERS[SurgePeriod(surge)]

    stype = ServiceType(service_type)

    if stype == ServiceType.HOUSE_CLEANING:
        if rooms > 0:
            room_cost = rooms * ROOM_RATE
            subtotal += room_cost
            breakdown.append(f"{rooms} room(s) × ₦{ROOM_RATE:,}: ₦{room_cost:,}")
        if toilets > 0:
            toilet_cost = toilets * TOILET_RATE
            subtotal += toilet_cost
            breakdown.append(f"{toilets} toilet(s) × ₦{TOILET_RATE:,}: ₦{toilet_cost:,}")
        for key, label in [("kitchen", "Kitchen"), ("living_room", "Living Room"), ("window_cleaning", "Window Cleaning")]:
            if extras.get(key):
                cost = EXTRA_RATES[key]
                subtotal += cost
                breakdown.append(f"+ {label}: ₦{cost:,}")

    elif stype == ServiceType.LAUNDRY:
        rates = FIXED_PRICES[stype]
        if clothes_count > 0:
            base = clothes_count * rates["per_item"]
            subtotal += base
            breakdown.append(f"{clothes_count} item(s) × ₦{rates['per_item']}: ₦{base:,}")
        if extras.get("ironing"):
            ironing = clothes_count * rates["ironing_per_item"]
            subtotal += ironing
            breakdown.append(f"+ Ironing: ₦{ironing:,}")
        if extras.get("delicates"):
            delicates = clothes_count * rates["delicates_surcharge"]
            subtotal += delicates
            breakdown.append(f"+ Delicates: ₦{delicates:,}")

    elif stype == ServiceType.FUMIGATION:
        subtotal = FIXED_PRICES[stype]["flat_rate"]
        breakdown.append(f"Fumigation Service: ₦{subtotal:,}")

    elif stype == ServiceType.DEEP_CLEANING:
        # Deep cleaning in dynamic mode uses rooms × premium rate
        deep_rate = 3_000
        room_cost = rooms * deep_rate
        subtotal = room_cost
        breakdown.append(f"{rooms} room(s) × ₦{deep_rate:,}: ₦{room_cost:,}")

    total = int(subtotal * multiplier)
    if multiplier != 1.0:
        breakdown.append(f"Surge ({surge}): ×{multiplier}")

    # Apply room-scan modifier if provided
    if scan_modifier is not None:
        total = int(total * scan_modifier)
        breakdown.append(f"Room scan modifier: x{scan_modifier}")

    clamped = _clamp(total)
    return PriceResult(
        total=clamped,
        breakdown=breakdown,
        mode="dynamic",
        surge_multiplier=multiplier,
        raw_total=total,
    )



def _clamp(price: int) -> int:
    """Enforce floor/ceiling bounds.

    Args:
        price: Raw computed price.

    Returns:
        Price clamped to [PRICE_FLOOR, PRICE_CEILING].
    """
    if price <= 0:
        return 0  # free services (e.g. 0 laundry items) stay at 0
    return max(PRICE_FLOOR, min(price, PRICE_CEILING))
