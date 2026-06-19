"""
Payment Routes — Paystack integration.

Endpoints:
  POST /v1/payments/initialize       — Create a Paystack transaction
  POST /v1/payments/webhook          — Receive Paystack webhook events
  GET  /v1/payments/{reference}/verify — Manual verification fallback

Authentication:
  - initialize and verify require a valid JWT
  - webhook is public (authenticated by HMAC-SHA512 signature)

Webhook security: Paystack signs the request body with HMAC-SHA512 using
your PAYSTACK_WEBHOOK_SECRET.  validate_webhook_signature() verifies this.
Never skip signature verification in production.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.repositories import job_repo
from app.services import payment_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class InitializeRequest(BaseModel):
    job_id: str
    callback_url: str | None = None


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/initialize")
async def initialize_payment(
    payload: InitializeRequest,
    user_id: str = Depends(get_current_user),
):
    """Create a Paystack transaction for a job.

    Returns ``authorization_url`` — redirect the customer there to pay.
    On success, Paystack fires a webhook to ``POST /v1/payments/webhook``.

    The job must exist and belong to the requesting user.
    Payment is only allowed on jobs with ``payment_status == "unpaid"``.
    """
    from app.db.pool import get_pool
    import uuid

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT j.id, j.price, j.payment_status, p.email
              FROM jobs j
              JOIN profiles p ON p.id = j.user_id
             WHERE j.id = $1 AND j.user_id = $2
            """,
            uuid.UUID(payload.job_id),
            uuid.UUID(user_id),
        )

    if not row:
        raise HTTPException(status_code=404, detail="Job not found.")

    if row["payment_status"] == "paid":
        raise HTTPException(status_code=409, detail="Job is already paid.")

    if not row["price"]:
        raise HTTPException(status_code=400, detail="Job has no price — cannot initialize payment.")

    result = await payment_service.initialize_transaction(
        email=row["email"],
        amount_naira=float(row["price"]),
        job_id=payload.job_id,
        callback_url=payload.callback_url,
    )

    # Mark payment as pending so duplicate initialize calls are obvious
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE jobs SET payment_status = 'pending' WHERE id = $1 AND payment_status = 'unpaid'",
            uuid.UUID(payload.job_id),
        )

    return result


@router.post("/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str | None = Header(None),
):
    """Receive Paystack webhook events.

    Paystack sends ``charge.success`` when a transaction succeeds.
    The handler updates the job's payment_status and fires a push notification.

    This endpoint must remain publicly accessible (no JWT auth).
    Security comes from HMAC-SHA512 signature verification.
    """
    raw_body = await request.body()

    if not payment_service.validate_webhook_signature(raw_body, x_paystack_signature or ""):
        log.warning("Paystack webhook signature mismatch — rejecting")
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    event = payload.get("event")
    data = payload.get("data", {})

    log.info("Paystack webhook received: event=%s", event)

    if event == "charge.success":
        await payment_service.handle_charge_success(data)

    # Always return 200 — Paystack retries on non-2xx
    return {"received": True}


@router.get("/{reference}/verify")
async def verify_payment(
    reference: str,
    user_id: str = Depends(get_current_user),
):
    """Manually verify a Paystack transaction.

    Use this as a fallback if the webhook hasn't fired yet
    (e.g. the customer returns from checkout and the webhook is delayed).

    If the transaction is successful, this also updates the job's payment_status.
    """
    result = await payment_service.verify_transaction(reference)

    if result["status"] == "success" and result.get("job_id"):
        # Trigger the same handler the webhook uses
        await payment_service.handle_charge_success({
            "reference": reference,
            "metadata": {"job_id": result["job_id"]},
        })

    return result
