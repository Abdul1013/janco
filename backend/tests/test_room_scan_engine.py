"""Unit tests for the room scan engine."""

import base64

import pytest
from app.engines.room_scan_engine import (
    CLUTTER_MODIFIERS,
    SIZE_MODIFIERS,
    ClutterLevel,
    RoomSize,
    ScanResult,
    analyse_room_image,
    analyse_room_with_dimensions,
    calculate_price_modifier,
    classify_clutter,
    classify_room_size,
)


class TestClassifyRoomSize:
    """Room size classification thresholds."""

    def test_small_room(self):
        assert classify_room_size(10) == RoomSize.SMALL
        assert classify_room_size(0.5) == RoomSize.SMALL
        assert classify_room_size(14.9) == RoomSize.SMALL

    def test_medium_room(self):
        assert classify_room_size(15) == RoomSize.MEDIUM
        assert classify_room_size(20) == RoomSize.MEDIUM
        assert classify_room_size(29.9) == RoomSize.MEDIUM

    def test_large_room(self):
        assert classify_room_size(30) == RoomSize.LARGE
        assert classify_room_size(40) == RoomSize.LARGE
        assert classify_room_size(49.9) == RoomSize.LARGE

    def test_extra_large_room(self):
        assert classify_room_size(50) == RoomSize.EXTRA_LARGE
        assert classify_room_size(100) == RoomSize.EXTRA_LARGE

    def test_boundary_values(self):
        """Exact boundary values land in the higher category."""
        assert classify_room_size(15) == RoomSize.MEDIUM
        assert classify_room_size(30) == RoomSize.LARGE
        assert classify_room_size(50) == RoomSize.EXTRA_LARGE


class TestClassifyClutter:
    """Clutter score classification thresholds."""

    def test_minimal(self):
        assert classify_clutter(0.0) == ClutterLevel.MINIMAL
        assert classify_clutter(0.24) == ClutterLevel.MINIMAL

    def test_moderate(self):
        assert classify_clutter(0.25) == ClutterLevel.MODERATE
        assert classify_clutter(0.49) == ClutterLevel.MODERATE

    def test_heavy(self):
        assert classify_clutter(0.50) == ClutterLevel.HEAVY
        assert classify_clutter(0.74) == ClutterLevel.HEAVY

    def test_extreme(self):
        assert classify_clutter(0.75) == ClutterLevel.EXTREME
        assert classify_clutter(1.0) == ClutterLevel.EXTREME


class TestPriceModifier:
    """Combined price modifier calculation."""

    def test_baseline_medium_minimal(self):
        """Medium room + minimal clutter = 1.0 × 1.0 = 1.0."""
        mod = calculate_price_modifier(RoomSize.MEDIUM, ClutterLevel.MINIMAL)
        assert mod == 1.0

    def test_small_minimal(self):
        mod = calculate_price_modifier(RoomSize.SMALL, ClutterLevel.MINIMAL)
        assert mod == 0.85

    def test_xl_extreme(self):
        """XL + extreme = 1.50 × 1.60 = 2.40 → clamped to 2.0."""
        mod = calculate_price_modifier(RoomSize.EXTRA_LARGE, ClutterLevel.EXTREME)
        assert mod == 2.0

    def test_clamp_floor(self):
        """Smallest combination still ≥ 0.7."""
        mod = calculate_price_modifier(RoomSize.SMALL, ClutterLevel.MINIMAL)
        assert mod >= 0.7

    def test_clamp_ceiling(self):
        """Largest combination ≤ 2.0."""
        mod = calculate_price_modifier(RoomSize.EXTRA_LARGE, ClutterLevel.EXTREME)
        assert mod <= 2.0

    def test_all_combinations_in_bounds(self):
        for size in RoomSize:
            for clutter in ClutterLevel:
                mod = calculate_price_modifier(size, clutter)
                assert 0.7 <= mod <= 2.0, f"Out of bounds: {size}, {clutter} -> {mod}"


class TestAnalyseRoomImage:
    """Heuristic image analysis."""

    @pytest.fixture
    def sample_image_b64(self):
        """A small sample image encoded as base64."""
        # Create a 100-byte fake "image" — enough for the heuristic
        raw = bytes(range(256)) * 4  # 1024 bytes
        return base64.b64encode(raw).decode()

    def test_returns_scan_result(self, sample_image_b64):
        result = analyse_room_image(sample_image_b64)
        assert isinstance(result, ScanResult)

    def test_area_in_range(self, sample_image_b64):
        result = analyse_room_image(sample_image_b64)
        assert 10 <= result.estimated_area <= 60

    def test_clutter_score_in_range(self, sample_image_b64):
        result = analyse_room_image(sample_image_b64)
        assert 0.0 <= result.clutter_score <= 1.0

    def test_confidence_in_range(self, sample_image_b64):
        result = analyse_room_image(sample_image_b64)
        assert 0.0 <= result.confidence <= 1.0

    def test_analysis_mode_is_heuristic(self, sample_image_b64):
        # The fixture contains raw bytes, not a valid JPEG/PNG, so Pillow
        # cannot decode it and the engine falls back to the pure-Python
        # heuristic path, which returns "heuristic_fallback".
        result = analyse_room_image(sample_image_b64)
        assert result.analysis_mode == "heuristic_fallback"

    def test_price_modifier_in_bounds(self, sample_image_b64):
        result = analyse_room_image(sample_image_b64)
        assert 0.7 <= result.price_modifier <= 2.0

    def test_details_not_empty(self, sample_image_b64):
        result = analyse_room_image(sample_image_b64)
        assert len(result.details) >= 3

    def test_deterministic_same_input(self, sample_image_b64):
        """Same image should produce the same result (deterministic hash)."""
        r1 = analyse_room_image(sample_image_b64)
        r2 = analyse_room_image(sample_image_b64)
        assert r1.estimated_area == r2.estimated_area
        assert r1.clutter_score == r2.clutter_score

    def test_width_hint_increases_confidence(self, sample_image_b64):
        without = analyse_room_image(sample_image_b64)
        with_hint = analyse_room_image(sample_image_b64, width_hint=1920)
        assert with_hint.confidence >= without.confidence

    def test_invalid_base64_handled(self):
        """Invalid base64 should not crash — falls back gracefully."""
        result = analyse_room_image("not-valid-base64!!!")
        assert isinstance(result, ScanResult)
        assert result.estimated_area >= 10


class TestAnalyseRoomWithDimensions:
    """Manual dimension-based analysis."""

    def test_basic_dimensions(self):
        result = analyse_room_with_dimensions(4.0, 5.0)
        assert result.estimated_area == 20.0
        assert result.room_size == RoomSize.MEDIUM

    def test_small_room_dims(self):
        result = analyse_room_with_dimensions(3.0, 4.0)
        assert result.estimated_area == 12.0
        assert result.room_size == RoomSize.SMALL

    def test_large_room_dims(self):
        result = analyse_room_with_dimensions(7.0, 6.0)
        assert result.estimated_area == 42.0
        assert result.room_size == RoomSize.LARGE

    def test_high_confidence(self):
        """Known dimensions should give high confidence."""
        result = analyse_room_with_dimensions(5.0, 5.0)
        assert result.confidence == 0.95

    def test_analysis_mode_dimensions(self):
        result = analyse_room_with_dimensions(5.0, 5.0)
        assert result.analysis_mode == "dimensions"

    def test_custom_clutter(self):
        result = analyse_room_with_dimensions(5.0, 5.0, clutter_score=0.8)
        assert result.clutter_level == ClutterLevel.EXTREME
        assert result.clutter_score == 0.8

    def test_default_clutter(self):
        result = analyse_room_with_dimensions(5.0, 5.0)
        assert result.clutter_score == 0.3
        assert result.clutter_level == ClutterLevel.MODERATE
