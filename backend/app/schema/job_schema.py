from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class JobCreate(BaseModel):
    """Schema for creating a new job"""
    user_id: str
    janitor_id: Optional[str] = None
    service_type: str
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    room_data: Optional[str] = None  # JSON string
    extras: Optional[str] = None  # JSON string
    notes: Optional[str] = None

class BookJobPayload(BaseModel):
    """Schema for booking a job with a specific janitor"""
    user_id: str
    janitor_id: str
    service_type: str
    scheduled_time: str
    location: Dict[str, Any]  # { city, lat, lng, address_line }
    metadata: Optional[Dict[str, Any]] = None  # { priceEstimate, breakdown, notes, etc }

class JobUpdate(BaseModel):
    """Schema for updating job status"""
    status: Optional[str] = None
    payment_status: Optional[str] = None
    janitor_id: Optional[str] = None

class JobResponse(BaseModel):
    """Schema for job response"""
    id: str
    user_id: str
    janitor_id: Optional[str]
    service_type: str
    status: str
    payment_status: str
    scheduled_date: Optional[str]
    scheduled_time: Optional[str]
    address: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    created_at: Optional[datetime]
    
    class Config:
        from_attributes = True 