"""Unit tests for the pricing engine (linear per-unit model)."""

import pytest
from app.engines.pricing_engine import (
    PRICE_CEILING,
    PRICE_FLOOR,
    calculate_dynamic_price,
    calculate_fixed_price,
    calculate_scan_price,
    calculate_standard_price,
    calculate_transport_fee,
)
from app.repositories.pricing_config import DEFAULT_CONFIG


class TestStandardPricing:
    """Linear per-unit pricing tests."""

    def test_house_cleaning_linear(self):
        r = calculate_standard_price("house_cleaning", rooms=1, config=DEFAULT_CONFIG)
        # 1 × 1000 = 1000, floored to 5000
        assert r.total == PRICE_FLOOR
        assert r.mode == "standard"

    def test_house_cleaning_ten_rooms(self):
        r = calculate_standard_price("house_cleaning", rooms=10, config=DEFAULT_CONFIG)
        assert r.total == 10_000

    def test_house_cleaning_proportional(self):
        r5 = calculate_standard_price("house_cleaning", rooms=5, config=DEFAULT_CONFIG)
        r10 = calculate_standard_price("house_cleaning", rooms=10, config=DEFAULT_CONFIG)
        assert r10.total == 2 * r5.total

    def test_toilets_added(self):
        r = calculate_standard_price("house_cleaning", rooms=5, toilets=2, config=DEFAULT_CONFIG)
        assert r.total == 5 * 1000 + 2 * 500  # 6000 (above floor)

    def test_extras_added(self):
        r = calculate_standard_price(
            "house_cleaning", rooms=10, extras={"kitchen": True, "window_cleaning": True}, config=DEFAULT_CONFIG
        )
        assert r.total == 10_000 + 2_000 + 1_000

    def test_deep_cleaning_linear(self):
        r = calculate_standard_price("deep_cleaning", rooms=3, config=DEFAULT_CONFIG)
        assert r.total == 3 * 3_000  # 9000

    def test_laundry_per_item(self):
        r = calculate_standard_price("laundry", clothes_count=10, config=DEFAULT_CONFIG)
        assert r.total == max(PRICE_FLOOR, 10 * 300)

    def test_laundry_with_ironing(self):
        r = calculate_standard_price("laundry", clothes_count=10, extras={"ironing": True}, config=DEFAULT_CONFIG)
        assert r.total == max(PRICE_FLOOR, 10 * 300 + 10 * 500)

    def test_fumigation_flat(self):
        r = calculate_standard_price("fumigation", config=DEFAULT_CONFIG)
        assert r.total == 10_000

    def test_invalid_service_raises(self):
        with pytest.raises(ValueError):
            calculate_standard_price("nonexistent", config=DEFAULT_CONFIG)

    def test_breakdown_not_empty(self):
        r = calculate_standard_price("house_cleaning", rooms=10, config=DEFAULT_CONFIG)
        assert len(r.breakdown) >= 1

    def test_surge_peak(self):
        r = calculate_standard_price("house_cleaning", rooms=10, surge="peak", config=DEFAULT_CONFIG)
        assert r.surge_multiplier == 1.2
        assert r.total == int(10_000 * 1.2)

    def test_surge_holiday(self):
        r = calculate_standard_price("house_cleaning", rooms=10, surge="holiday", config=DEFAULT_CONFIG)
        assert r.surge_multiplier == 1.5
        assert r.total == int(10_000 * 1.5)


class TestTransportFee:
    """Transport surcharge calculation."""

    def test_no_fee_below_threshold(self):
        assert calculate_transport_fee(0, DEFAULT_CONFIG) == 0
        assert calculate_transport_fee(4.9, DEFAULT_CONFIG) == 0
        assert calculate_transport_fee(5.0, DEFAULT_CONFIG) == 0

    def test_one_band(self):
        assert calculate_transport_fee(6, DEFAULT_CONFIG) == 1_000
        assert calculate_transport_fee(9.9, DEFAULT_CONFIG) == 1_000

    def test_two_bands(self):
        assert calculate_transport_fee(10.1, DEFAULT_CONFIG) == 2_000
        assert calculate_transport_fee(14.9, DEFAULT_CONFIG) == 2_000

    def test_three_bands(self):
        assert calculate_transport_fee(15.1, DEFAULT_CONFIG) == 3_000

    def test_included_in_price(self):
        r = calculate_standard_price("house_cleaning", rooms=10, config=DEFAULT_CONFIG, transport_fee=1000)
        assert r.total == 11_000
        assert r.transport_fee == 1_000
        assert any("Transport" in line for line in r.breakdown)


class TestScanPricing:
    """Area-based scan pricing."""

    def test_area_times_rate(self):
        # 60 m² × ₦100/m² = ₦6,000 (above floor)
        r = calculate_scan_price(60.0, 1.0, DEFAULT_CONFIG)
        assert r.total == 6_000
        assert r.mode == "scan"

    def test_clutter_multiplier(self):
        r = calculate_scan_price(60.0, 1.15, DEFAULT_CONFIG)
        assert r.total == int(60 * 100 * 1.15)  # 6900

    def test_floor_applied(self):
        # 10 m² × ₦100 = ₦1,000 → floored to ₦5,000
        r = calculate_scan_price(10.0, 1.0, DEFAULT_CONFIG)
        assert r.total == PRICE_FLOOR

    def test_transport_in_scan(self):
        r = calculate_scan_price(60.0, 1.0, DEFAULT_CONFIG, transport_fee=1000)
        assert r.total == 7_000
        assert r.transport_fee == 1_000


class TestBounds:
    """Floor and ceiling enforcement."""

    def test_floor_enforcement(self):
        r = calculate_standard_price("house_cleaning", rooms=1, config=DEFAULT_CONFIG)
        assert r.total == PRICE_FLOOR

    def test_ceiling_enforcement(self):
        r = calculate_standard_price(
            "house_cleaning", rooms=300, toilets=100, config=DEFAULT_CONFIG
        )
        assert r.total == PRICE_CEILING


class TestBackwardCompatAliases:
    """calculate_fixed_price and calculate_dynamic_price still work."""

    def test_fixed_price_alias(self):
        r = calculate_fixed_price("house_cleaning", rooms=10, config=DEFAULT_CONFIG)
        assert r.total == 10_000

    def test_dynamic_price_alias(self):
        r = calculate_dynamic_price("house_cleaning", rooms=10, config=DEFAULT_CONFIG)
        assert r.total == 10_000
        assert r.mode == "dynamic"

    def test_dynamic_surge(self):
        r = calculate_dynamic_price("house_cleaning", rooms=10, surge="peak", config=DEFAULT_CONFIG)
        assert r.surge_multiplier == 1.2

    def test_zero_items_laundry(self):
        r = calculate_dynamic_price("laundry", clothes_count=0, config=DEFAULT_CONFIG)
        assert r.total == 0
