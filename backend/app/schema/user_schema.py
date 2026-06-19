"""Pydantic schemas for user/profile endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


def _validate_password_strength(v: str) -> str:
    """Enforce minimum password complexity rules."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if not any(c.isupper() for c in v):
        raise ValueError("Password must contain at least one uppercase letter.")
    if not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one digit.")
    return v


class UserCreate(BaseModel):
    """Payload for user signup."""
    email: str
    password: str
    full_name: str
    accepted_terms: bool = False

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)

    @field_validator("accepted_terms")
    @classmethod
    def must_accept_terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the Terms & Conditions and Privacy Policy.")
        return v


class UserLogin(BaseModel):
    """Payload for login — full_name not required."""
    email: str
    password: str


class ProfileUpdate(BaseModel):
    """Payload for updating a user profile."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    address: Optional[str] = None
    landmark: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_registered: Optional[bool] = None


class PasswordUpdate(BaseModel):
    """Payload for updating password."""
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class PasswordResetRequest(BaseModel):
    """Payload for requesting a password reset email."""
    email: str


class PasswordResetConfirm(BaseModel):
    """Payload for confirming a password reset with token."""
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)


class PushTokenRequest(BaseModel):
    """Payload for registering an Expo push token."""
    push_token: str


class UserResponse(BaseModel):
    """User profile returned by the API."""
    id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    user_name: Optional[str] = None
    role: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
