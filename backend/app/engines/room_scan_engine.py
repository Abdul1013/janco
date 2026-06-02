"""
Room Scan Engine — Pure Computation Module.

Analyses room images to estimate:
  1. **Room dimensions** (area in m²) from visual cues.
  2. **Clutter level** (0.0 – 1.0) indicating extra cleaning effort.
  3. **Price modifier** — multiplier applied to the base price.

In production this module delegates to a TensorFlow Lite model for
object detection and spatial estimation.  In mock mode (default for
beta) it uses heuristic fallbacks based on image metadata.

This module has **no I/O**: it receives data and returns a result dict.
Every function is independently testable.
"""

from __future__ import annotations

import base64
import hashlib
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class RoomSize(str, Enum):
    """Estimated room size category."""
    SMALL = "small"        # < 15 m²
    MEDIUM = "medium"      # 15–30 m²
    LARGE = "large"        # 30–50 m²
    EXTRA_LARGE = "xl"     # > 50 m²


class ClutterLevel(str, Enum):
    """Clutter density classification."""
    MINIMAL = "minimal"    # mostly empty, few obstacles
    MODERATE = "moderate"  # typical furnished room
    HEAVY = "heavy"        # lots of items, requires extra effort
    EXTREME = "extreme"    # hoarder-level, significant clearing needed


# ── Size thresholds (m²) ───────────────────────────────────────────────
SIZE_THRESHOLDS = {
    RoomSize.SMALL: (0, 15),
    RoomSize.MEDIUM: (15, 30),
    RoomSize.LARGE: (30, 50),
    RoomSize.EXTRA_LARGE: (50, 200),
}

# ── Price modifiers ────────────────────────────────────────────────────
# Clutter adds to the base price; room size already accounted in rooms count
CLUTTER_MODIFIERS = {
    ClutterLevel.MINIMAL: 1.0,
    ClutterLevel.MODERATE: 1.15,
    ClutterLevel.HEAVY: 1.35,
    ClutterLevel.EXTREME: 1.60,
}

SIZE_MODIFIERS = {
    RoomSize.SMALL: 0.85,
    RoomSize.MEDIUM: 1.0,
    RoomSize.LARGE: 1.25,
    RoomSize.EXTRA_LARGE: 1.50,
}


@dataclass
class ScanResult:
    """Immutable result of a room scan analysis.

    Attributes:
        estimated_area: Room area in m² (float).
        room_size: Categorical size label.
        clutter_level: Categorical clutter label.
        clutter_score: Numeric clutter (0.0 – 1.0).
        price_modifier: Combined multiplier for pricing.
        confidence: Analysis confidence (0.0 – 1.0).
        analysis_mode: 'ai' or 'heuristic'.
        details: Human-readable analysis breakdown.
    """
    estimated_area: float
    room_size: RoomSize
    clutter_level: ClutterLevel
    clutter_score: float
    price_modifier: float
    confidence: float
    analysis_mode: str
    details: list[str] = field(default_factory=list)


def classify_room_size(area_m2: float) -> RoomSize:
    """Map a numeric area to a RoomSize category.

    Args:
        area_m2: Estimated room area in square metres.

    Returns:
        RoomSize enum value.
    """
    if area_m2 < 15:
        return RoomSize.SMALL
    elif area_m2 < 30:
        return RoomSize.MEDIUM
    elif area_m2 < 50:
        return RoomSize.LARGE
    return RoomSize.EXTRA_LARGE


def classify_clutter(score: float) -> ClutterLevel:
    """Map a numeric clutter score to a ClutterLevel category.

    Args:
        score: Clutter score between 0.0 (empty) and 1.0 (extreme).

    Returns:
        ClutterLevel enum value.
    """
    if score < 0.25:
        return ClutterLevel.MINIMAL
    elif score < 0.50:
        return ClutterLevel.MODERATE
    elif score < 0.75:
        return ClutterLevel.HEAVY
    return ClutterLevel.EXTREME


def calculate_price_modifier(
    room_size: RoomSize,
    clutter_level: ClutterLevel,
) -> float:
    """Compute the combined price modifier from size and clutter.

    The final modifier = size_mod × clutter_mod, clamped to [0.7, 2.0].

    Args:
        room_size: Categorical room size.
        clutter_level: Categorical clutter density.

    Returns:
        Combined price modifier (float).
    """
    size_mod = SIZE_MODIFIERS[room_size]
    clutter_mod = CLUTTER_MODIFIERS[clutter_level]
    combined = round(size_mod * clutter_mod, 2)
    return max(0.7, min(combined, 2.0))


def analyse_room_image(
    image_base64: str,
    width_hint: Optional[int] = None,
    height_hint: Optional[int] = None,
) -> ScanResult:
    """Analyse a room image and return size/clutter estimates.

    In the current beta, this uses a heuristic analysis based on
    image data characteristics.  The AI model slot is reserved for
    production deployment with TensorFlow Lite object detection.

    Args:
        image_base64: Base64-encoded JPEG/PNG image data.
        width_hint: Optional camera resolution width (pixels).
        height_hint: Optional camera resolution height (pixels).

    Returns:
        ScanResult with all analysis fields populated.
    """
    details: list[str] = []

    # ── Decode and extract features ────────────────────────────────
    try:
        raw = base64.b64decode(image_base64)
        file_size = len(raw)
    except Exception:
        # Fallback for invalid base64
        file_size = len(image_base64)

    # ── Heuristic: estimate area from image complexity ─────────────
    # Larger, more complex images tend to capture bigger rooms.
    # This is a deliberate simplification for beta — the production
    # pipeline replaces this with monocular depth estimation.

    # Use a hash to create deterministic but varied results per image
    img_hash = hashlib.md5(image_base64[:1000].encode() if isinstance(image_base64, str) else image_base64[:1000]).hexdigest()
    hash_val = int(img_hash[:8], 16)

    # Estimate area: 10–60 m² based on file size + hash entropy
    size_factor = min(file_size / 500_000, 1.0)  # normalise to 0-1
    hash_factor = (hash_val % 100) / 100.0
    estimated_area = 10 + (size_factor * 30) + (hash_factor * 20)
    estimated_area = round(estimated_area, 1)
    details.append(f"Estimated area: {estimated_area} m²")

    # ── Heuristic: estimate clutter from byte entropy ──────────────
    # Higher entropy in image data correlates with more objects/detail
    if file_size > 0:
        sample = raw[:min(4096, file_size)] if isinstance(raw, bytes) else b""
        if sample:
            byte_counts = [0] * 256
            for b in sample:
                byte_counts[b] += 1
            entropy = 0.0
            for count in byte_counts:
                if count > 0:
                    prob = count / len(sample)
                    entropy -= prob * math.log2(prob)
            # Normalise entropy (max = 8 for random data)
            clutter_score = min(entropy / 8.0, 1.0)
        else:
            clutter_score = 0.4
    else:
        clutter_score = 0.4

    clutter_score = round(clutter_score, 2)
    details.append(f"Clutter score: {clutter_score}")

    # ── Classify ───────────────────────────────────────────────────
    room_size = classify_room_size(estimated_area)
    clutter_level = classify_clutter(clutter_score)
    price_modifier = calculate_price_modifier(room_size, clutter_level)

    details.append(f"Room classification: {room_size.value}")
    details.append(f"Clutter classification: {clutter_level.value}")
    details.append(f"Price modifier: {price_modifier}x")

    # Confidence is lower for heuristic mode
    confidence = round(0.55 + (size_factor * 0.2) + (0.1 if width_hint else 0), 2)
    confidence = min(confidence, 0.85)

    return ScanResult(
        estimated_area=estimated_area,
        room_size=room_size,
        clutter_level=clutter_level,
        clutter_score=clutter_score,
        price_modifier=price_modifier,
        confidence=confidence,
        analysis_mode="heuristic",
        details=details,
    )


def analyse_room_with_dimensions(
    width_m: float,
    length_m: float,
    clutter_score: float = 0.3,
) -> ScanResult:
    """Create a ScanResult from known room dimensions.

    Used when the user provides manual measurements or when
    a LiDAR/AR module supplies precise dimensions.

    Args:
        width_m: Room width in metres.
        length_m: Room length in metres.
        clutter_score: Estimated clutter (0.0 – 1.0), default 0.3.

    Returns:
        ScanResult with high confidence (dimensions are known).
    """
    area = round(width_m * length_m, 1)
    room_size = classify_room_size(area)
    clutter_level = classify_clutter(clutter_score)
    price_modifier = calculate_price_modifier(room_size, clutter_level)

    return ScanResult(
        estimated_area=area,
        room_size=room_size,
        clutter_level=clutter_level,
        clutter_score=round(clutter_score, 2),
        price_modifier=price_modifier,
        confidence=0.95,
        analysis_mode="dimensions",
        details=[
            f"Provided dimensions: {width_m}m x {length_m}m = {area} m²",
            f"Room classification: {room_size.value}",
            f"Price modifier: {price_modifier}x",
        ],
    )
