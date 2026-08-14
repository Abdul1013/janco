"""
Verification Routes.

Handles janitor identity verification via a three-step Dojah flow:
  1. POST /v1/verification/initiate — submit NIN/BVN for lookup
  2. POST /v1/verification/liveness — submit selfie for liveness check
  3. GET  /v1/verification/status  — check current verification state

All endpoints are protected and restricted to janitor-role users.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.services import verification_service

router = APIRouter(prefix="/verification", tags=["Verification"])


# ---------------------------------------------------------------------------
# Request schemas (local — only used by these routes)
# ---------------------------------------------------------------------------

class InitiateRequest(BaseModel):
    """Payload for starting identity verification."""
    id_type: str   # "nin" or "bvn"
    id_number: str


class LivenessRequest(BaseModel):
    """Payload for liveness selfie submission."""
    image_base64: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/initiate")
async def initiate(
    payload: InitiateRequest,
    user_id: str = Depends(get_current_user),
):
    """Step 1: Submit NIN or BVN for identity lookup.

    Args:
        payload: ID type and number.
        user_id: Injected by auth middleware (must be janitor).

    Returns:
        Dojah reference ID and status.
    """
    return await verification_service.initiate_verification(
        janitor_id=user_id,
        id_type=payload.id_type,
        id_number=payload.id_number,
    )


@router.post("/liveness")
async def liveness(
    payload: LivenessRequest,
    user_id: str = Depends(get_current_user),
):
    """Step 2: Submit selfie for liveness/face-match check.

    Args:
        payload: Base64-encoded selfie image.
        user_id: Injected by auth middleware (must be janitor).

    Returns:
        Verification result and status.
    """
    return await verification_service.submit_liveness(
        janitor_id=user_id,
        image_base64=payload.image_base64,
    )


@router.get("/status")
async def status(user_id: str = Depends(get_current_user)):
    """Step 3: Check current verification status.

    Args:
        user_id: Injected by auth middleware (must be janitor).

    Returns:
        Current status, dojah ref, verified_at, retries remaining.
    """
    return await verification_service.get_verification_status(janitor_id=user_id)



@router.post("/webhook")
async def webhook(payload: dict):
    """Endpoint for Dojah webhooks/callbacks.

    This endpoint is intentionally unauthenticated and should be
    secured via Dojah's webhook signing or network controls in
    production. It accepts a JSON payload and delegates handling
    to the verification service.
    """
    await verification_service.handle_dojah_webhook(payload)
    return Response(status_code=204)
