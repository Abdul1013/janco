"""
Pydantic schemas for job-related endpoints.

Includes the JobStatus enum that enforces valid state transitions
and prevents arbitrary status strings from entering the system.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class JobStatus(str, Enum):
    """Finite state machine states for a job.

    Valid transitions:
        pending → confirmed → in_progress → completed
        pending → cancelled
        confirmed → cancelled
    """
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"


# Allowed transitions map — prevents invalid state changes
VALID_TRANSITIONS: dict[JobStatus, list[JobStatus]] = {
    JobStatus.PENDING: [JobStatus.CONFIRMED, JobStatus.CANCELLED],
    JobStatus.CONFIRMED: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
    JobStatus.IN_PROGRESS: [JobStatus.COMPLETED],
    JobStatus.COMPLETED: [],
    JobStatus.CANCELLED: [],
}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class JobCreate(BaseModel):
    """Create a new job (customer-initiated).

    Note: user_id is NOT in the payload — it comes from the JWT
    token via the auth middleware dependency injection.
    """
    janitor_id: Optional[str] = None
    service_type: str
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rooms: int = 1
    toilets: int = 0
    extras: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    distance_km: Optional[float] = None
    use_scan: bool = False
    area_m2: Optional[float] = None


class BookJobPayload(BaseModel):
    """Book a job with a specific janitor (includes location + pricing).

    Note: user_id comes from JWT, not the payload.
    """
    janitor_id: str
    service_type: str
    scheduled_time: str
    location: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


class JobStatusUpdate(BaseModel):
    """Update a job's status. Validates against the transition map."""
    new_status: JobStatus

    @field_validator("new_status", mode="before")
    @classmethod
    def lowercase_status(cls, v):
        return v.lower() if isinstance(v, str) else v


class PriceEstimateRequest(BaseModel):
    """Request a price estimate from the pricing engine."""
    service_type: str
    rooms: int = 1
    toilets: int = 0
    clothes_count: int = 0
    extras: Optional[Dict[str, bool]] = None
    use_fixed: bool = True
    surge: str = "normal"
    # Scan-mode fields
    use_scan: bool = False
    area_m2: Optional[float] = None
    # Transport fee
    distance_km: Optional[float] = None


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class PriceEstimateResponse(BaseModel):
    """Pricing engine result returned to the client."""
    total: int
    breakdown: List[str]
    mode: str
    surge_multiplier: float = 1.0
    transport_fee: int = 0


class JobResponse(BaseModel):
    """Standard job object returned by the API."""
    id: str
    user_id: str
    janitor_id: Optional[str] = None
    service_type: str
    status: str
    payment_status: str
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rooms: Optional[int] = None
    toilets: Optional[int] = None
    price: Optional[int] = None
    transport_fee: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
