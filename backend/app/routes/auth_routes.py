"""
Authentication Routes.

Thin HTTP adapter over auth_service.  No Supabase — all auth is handled
by our own JWT + bcrypt stack.

Endpoints:
    POST   /v1/auth/signup          — create account
    POST   /v1/auth/login           — email/password sign-in
    POST   /v1/auth/refresh         — exchange refresh token for new tokens
    GET    /v1/auth/me              — current user profile  (protected)
    PATCH  /v1/auth/profile         — update profile fields (protected)
    POST   /v1/auth/push-token      — register Expo push token (protected)
    POST   /v1/auth/update-password — change password        (protected)
    POST   /v1/auth/logout          — invalidate all sessions (protected)
"""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from app.middleware.auth import get_current_user
from app.repositories import user_repo
from app.schema.user_schema import (
    PasswordResetConfirm,
    PasswordResetRequest,
    PasswordUpdate,
    ProfileUpdate,
    PushTokenRequest,
    UserCreate,
    UserLogin,
)
from app.services import auth_service, notification_service

router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------------------------------------------------------------------------
# Public endpoints (no JWT required)
# ---------------------------------------------------------------------------

@router.post("/signup")
async def signup(payload: UserCreate):
    return await auth_service.signup(payload.email, payload.password, payload.full_name)


@router.post("/login")
async def login(payload: UserLogin):
    return await auth_service.login(payload.email, payload.password)


@router.post("/reset-password")
async def request_password_reset(payload: PasswordResetRequest):
    """Send a password reset email (or return token in beta).

    Always returns 200 to prevent email enumeration.
    """
    return await auth_service.request_password_reset(payload.email)


@router.post("/reset-password/confirm")
async def confirm_password_reset(payload: PasswordResetConfirm):
    """Verify reset token and set new password."""
    return await auth_service.confirm_password_reset(payload.token, payload.new_password)


@router.post("/refresh")
async def refresh_token(refresh_token: str = Body(..., embed=True)):
    """Exchange a refresh token for new access + refresh tokens.

    Body: ``{"refresh_token": "<token>"}``
    """
    return await auth_service.refresh(refresh_token)


# ---------------------------------------------------------------------------
# Protected endpoints (JWT required)
# ---------------------------------------------------------------------------

@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user)):
    profile = await user_repo.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile


@router.patch("/profile")
async def update_profile(
    payload: ProfileUpdate,
    user_id: str = Depends(get_current_user),
):
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")
    result = await user_repo.update_profile(user_id, update_data)
    if not result:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return {"message": "Profile updated.", "profile": result}


@router.post("/push-token")
async def register_push_token(
    payload: PushTokenRequest,
    user_id: str = Depends(get_current_user),
):
    return await notification_service.register_push_token(user_id, payload.push_token)


@router.post("/update-password")
async def update_password(
    payload: PasswordUpdate,
    user_id: str = Depends(get_current_user),
):
    return await auth_service.update_password(user_id, payload.password)


@router.post("/logout")
async def logout(user_id: str = Depends(get_current_user)):
    return await auth_service.logout(user_id)
