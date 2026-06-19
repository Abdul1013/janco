"""Pydantic schemas for chat/messaging endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MessageCreate(BaseModel):
    """Payload for sending a chat message."""
    content: str


class MessageResponse(BaseModel):
    """Chat message returned by the API."""
    id: str
    job_id: str
    sender_id: str
    content: str
    read_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
