"""
Pydantic schemas for room-scan endpoints.

Separates the scan domain from job schemas to keep each module focused.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class RoomScanRequest(BaseModel):
    """Accept a base64-encoded room image for analysis.

    The image is processed by the room-scan engine, which returns
    size/clutter estimates and a price modifier.
    """
    image_base64: str = Field(
        ...,
        min_length=100,
        description="Base64-encoded JPEG or PNG image data.",
    )
    width_hint: Optional[int] = Field(
        None,
        ge=1,
        description="Camera resolution width in pixels (optional).",
    )
    height_hint: Optional[int] = Field(
        None,
        ge=1,
        description="Camera resolution height in pixels (optional).",
    )

    @field_validator("image_base64")
    @classmethod
    def strip_data_uri(cls, v: str) -> str:
        """Remove optional data-URI prefix (e.g. 'data:image/jpeg;base64,')."""
        if v.startswith("data:"):
            parts = v.split(",", 1)
            if len(parts) == 2:
                return parts[1]
        return v


class RoomDimensionsRequest(BaseModel):
    """Accept manual room dimensions (from user input or LiDAR/AR)."""
    width_m: float = Field(..., gt=0, le=100, description="Width in metres.")
    length_m: float = Field(..., gt=0, le=100, description="Length in metres.")
    clutter_score: float = Field(
        0.3,
        ge=0.0,
        le=1.0,
        description="Estimated clutter (0.0 = empty, 1.0 = extreme).",
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class RoomScanResponse(BaseModel):
    """Result of a room-scan analysis."""
    estimated_area: float
    room_size: str
    clutter_level: str
    clutter_score: float
    price_modifier: float
    confidence: float
    analysis_mode: str
    details: List[str]


class ScanPriceResponse(BaseModel):
    """Combined scan result + price estimate."""
    scan: RoomScanResponse
    price_estimate: Optional[Dict] = None
