"""
Room Scan Engine — Pure Computation Module.

Analyses room images to estimate:
  1. **Room dimensions** (area in m²) from visual cues.
  2. **Clutter level** (0.0 – 1.0) indicating extra cleaning effort.
  3. **Price modifier** — multiplier applied to the base price.

Photo analysis uses Pillow for edge detection and brightness distribution
when available, falling back to a pure-Python heuristic otherwise.
Manual dimension entry (analyse_room_with_dimensions) is the most accurate
path and is always available.

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

    Uses Pillow (when available) for edge-density area estimation and
    brightness-based clutter detection.  Falls back to a pure-Python
    heuristic if Pillow is not installed or the image cannot be decoded.

    Camera-based estimates carry honest low confidence (~0.45).
    Use analyse_room_with_dimensions() for high-confidence results.

    Args:
        image_base64: Base64-encoded JPEG/PNG image data.
        width_hint: Camera resolution width in pixels (from expo-camera).
        height_hint: Camera resolution height in pixels (from expo-camera).

    Returns:
        ScanResult with all analysis fields populated.
    """
    try:
        raw = base64.b64decode(image_base64)
    except Exception:
        raw = b""

    # ── Attempt Pillow-based analysis ─────────────────────────────
    try:
        from PIL import Image as PILImage
        import io

        img = PILImage.open(io.BytesIO(raw)).convert("L")  # grayscale
        img_w, img_h = img.size

        # Use actual pixel dimensions (reliable — from camera sensor)
        px_w = img_w
        px_h = img_h

        estimated_area, clutter_score, details = _pillow_analyse(img, px_w, px_h)
        analysis_mode = "photo_estimate"
        # Confidence: honest low value for single-image estimation
        confidence = round(0.40 + (0.05 if width_hint else 0), 2)
        confidence = min(confidence, 0.50)

    except Exception:
        # Pillow unavailable or image decode failed — use improved heuristic
        estimated_area, clutter_score, details, analysis_mode = _fallback_heuristic(
            raw, width_hint, height_hint
        )
        confidence = 0.30

    clutter_score = round(clutter_score, 2)
    room_size = classify_room_size(estimated_area)
    clutter_level = classify_clutter(clutter_score)
    price_modifier = calculate_price_modifier(room_size, clutter_level)

    details.append(f"Room classification: {room_size.value}")
    details.append(f"Clutter classification: {clutter_level.value}")
    details.append(f"Price modifier: {price_modifier}x")
    details.append("Estimate only — tap 'Adjust' if size looks wrong.")

    return ScanResult(
        estimated_area=estimated_area,
        room_size=room_size,
        clutter_level=clutter_level,
        clutter_score=clutter_score,
        price_modifier=price_modifier,
        confidence=confidence,
        analysis_mode=analysis_mode,
        details=details,
    )


def _pillow_analyse(img: "PILImage.Image", px_w: int, px_h: int) -> tuple[float, float, list[str]]:
    """Estimate room area and clutter from a grayscale Pillow image.

    Area estimation:
    - Most phone cameras have a horizontal FoV of ~65°.
    - At a wall distance d (metres), visible width = 2 × d × tan(32.5°) ≈ 1.274d.
    - We assume a reference wall height of 2.7m and estimate the fraction
      of the frame occupied by the opposite wall using row-brightness variance.
    - Aspect ratio from edge density refines the depth/width ratio.

    Clutter estimation:
    - Variance in the lower-third of the image (floor area) indicates objects.
    """
    details: list[str] = []

    # ── Image geometry ─────────────────────────────────────────────
    aspect_ratio = px_w / max(px_h, 1)

    # Downsample to at most 200 columns for speed
    scale = min(1.0, 200 / px_w)
    small_w = max(1, int(px_w * scale))
    small_h = max(1, int(px_h * scale))
    small = img.resize((small_w, small_h))
    pixels = list(small.getdata())

    rows = [pixels[i * small_w:(i + 1) * small_w] for i in range(small_h)]

    # ── Horizontal edge density (row-to-row variance) ──────────────
    # Walls produce strong horizontal edges; more edges → narrower/deeper room
    h_edges = 0.0
    for i in range(1, small_h):
        row_diff = sum(abs(rows[i][j] - rows[i - 1][j]) for j in range(small_w))
        h_edges += row_diff / small_w
    h_edge_density = h_edges / max(small_h - 1, 1)

    # ── Estimate room depth from wall coverage fraction ────────────
    # Rows in the upper 50% with high brightness variance indicate walls
    upper_half = rows[:small_h // 2]
    row_variances = []
    for row in upper_half:
        mean = sum(row) / len(row)
        var = sum((v - mean) ** 2 for v in row) / len(row)
        row_variances.append(var)
    mean_upper_var = sum(row_variances) / max(len(row_variances), 1)

    # Normalise: typical room interior variance 200–2000
    wall_fraction = min(mean_upper_var / 1500.0, 1.0)

    # Perspective model: wall_fraction drives estimated depth
    # wall_fraction ~0 → small/close room, ~1 → large/spacious
    ref_wall_height = 2.7  # metres (standard Nigerian room)
    tan_half_vfov = math.tan(math.radians(24.5))  # ~49° vertical FoV
    depth_m = ref_wall_height / (2 * max(tan_half_vfov * (0.3 + wall_fraction * 0.7), 0.1))
    depth_m = max(2.5, min(depth_m, 8.0))

    tan_half_hfov = math.tan(math.radians(32.5))  # 65° horizontal FoV
    width_m = 2 * depth_m * tan_half_hfov

    # Aspect ratio from edge density: high h_edge_density → more depth variation
    room_aspect = max(0.6, min(aspect_ratio * (1 + h_edge_density / 200), 1.8))
    estimated_area = round(width_m * (width_m / room_aspect), 1)
    estimated_area = max(6.0, min(estimated_area, 80.0))

    details.append(f"Estimated area: {estimated_area} m² (photo analysis)")

    # ── Clutter from lower-third variance ─────────────────────────
    lower_third = rows[2 * small_h // 3:]
    if lower_third:
        flat = [p for row in lower_third for p in row]
        mean_f = sum(flat) / len(flat)
        var_f = sum((p - mean_f) ** 2 for p in flat) / len(flat)
        # Variance 0–8000+ maps to clutter 0–1
        clutter_score = min(var_f / 6000.0, 1.0)
    else:
        clutter_score = 0.35

    details.append(f"Clutter score: {clutter_score:.2f} (floor-area analysis)")

    return estimated_area, clutter_score, details


def _fallback_heuristic(
    raw: bytes,
    width_hint: Optional[int],
    height_hint: Optional[int],
) -> tuple[float, float, list[str], str]:
    """Pure-Python fallback when Pillow is unavailable."""
    details: list[str] = []
    file_size = len(raw)

    if width_hint and height_hint and width_hint > 0 and height_hint > 0:
        # Use actual camera pixel dimensions — much better than file size
        aspect = width_hint / height_hint
        # Typical phone photo: 4032×3024 (12MP) or 4000×3000
        # Normalise by 4000×3000 reference
        px_area_factor = min((width_hint * height_hint) / (4000 * 3000), 1.0)
        # Landscape-oriented shots of rooms tend to be wider than they are deep
        depth_factor = 1.0 / max(aspect, 0.5)
        estimated_area = round(8.0 + (px_area_factor * 20) + (depth_factor * 12), 1)
        details.append(f"Estimated area: {estimated_area} m² (pixel-dimension estimate)")
    else:
        # File size proxy — better than nothing, but unreliable
        size_factor = min(file_size / 400_000, 1.0)
        # Use JPEG header parsing to get dimensions if possible
        img_w, img_h = _parse_jpeg_dimensions(raw)
        if img_w and img_h:
            aspect = img_w / img_h
            estimated_area = round(10 + size_factor * 25 + (1 / max(aspect, 0.5)) * 8, 1)
            details.append(f"Estimated area: {estimated_area} m² (JPEG header + size)")
        else:
            estimated_area = round(10 + size_factor * 30, 1)
            details.append(f"Estimated area: {estimated_area} m² (file-size estimate)")

    estimated_area = max(6.0, min(estimated_area, 80.0))

    # Clutter from byte entropy of lower half of the image bytes
    if file_size > 100:
        lower_half = raw[file_size // 2:]
        sample = lower_half[:min(4096, len(lower_half))]
        byte_counts = [0] * 256
        for b in sample:
            byte_counts[b] += 1
        entropy = 0.0
        for count in byte_counts:
            if count > 0:
                prob = count / len(sample)
                entropy -= prob * math.log2(prob)
        clutter_score = min(entropy / 8.0, 1.0)
    else:
        clutter_score = 0.4

    details.append(f"Clutter score: {clutter_score:.2f} (entropy estimate)")
    return estimated_area, clutter_score, details, "heuristic_fallback"


def _parse_jpeg_dimensions(data: bytes) -> tuple[Optional[int], Optional[int]]:
    """Extract width and height from a JPEG stream without Pillow."""
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        return None, None
    i = 2
    while i < len(data) - 8:
        if data[i] != 0xFF:
            break
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):  # SOF0, SOF1, SOF2
            h = (data[i + 5] << 8) | data[i + 6]
            w = (data[i + 7] << 8) | data[i + 8]
            return w, h
        seg_len = (data[i + 2] << 8) | data[i + 3]
        i += 2 + seg_len
    return None, None


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
