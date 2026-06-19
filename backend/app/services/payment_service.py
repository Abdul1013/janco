"""
Payment Service — Paystack integration.

Handles the full Paystack payment lifecycle:
  - Initialize a transaction (returns authorization_url + reference)
  - Verify a transaction by reference (polling fallback)
  - Validate an inbound webhook (HMAC-SHA512 signature check)

Graceful degradation: if PAYSTACK_SECRET_KEY is empty the service raises
a clear 503 rather than making calls with an invalid key.

Docs: https://paystack.com/docs/api/
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
import logging
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import settings
from app.db.pool import get_pool

log = logging.getLogger(__name__)

_PAYSTACK_BASE = "https://api.paystack.co"


# ─────────────────────────────────────────────────────────────────────────────
# Internal HTTP helper
# ─────────────────────────────────────────────────────────────────────────────

def _headers() -> dict[str, str]:
    if not settings.PAYSTACK_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Payment service is not configured. Contact support.",
        )
    return {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


async def _post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(f"{_PAYSTACK_BASE}{path}", json=body, headers=_headers())
    res.raise_for_status()
    return res.json()


async def _get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(f"{_PAYSTACK_BASE}{path}", headers=_headers())
    res.raise_for_status()
    return res.json()


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

async def initialize_transaction(
    email: str,
    amount_naira: float,
    job_id: str,
    callback_url: str | None = None,
) -> dict:
    """Create a Paystack transaction.

    Args:
        email: Customer's email address.
        amount_naira: Amount in Naira (converted to kobo internally).
        job_id: JANCO job ID stored in metadata for webhook lookup.
        callback_url: URL Paystack redirects to after web checkout.

    Returns:
        {
          "authorization_url": "https://checkout.paystack.com/...",
          "access_code": "...",
          "reference": "janco_<uuid>"
        }
    """
    reference = f"janco_{uuid.uuid4().hex[:16]}"
    payload: dict[str, Any] = {
        "email": email,
        "amount": int(amount_naira * 100),  # kobo
        "reference": reference,
        "metadata": {
            "job_id": job_id,
            "custom_fields": [
                {"display_name": "Job ID", "variable_name": "job_id", "value": job_id}
            ],
        },
        "currency": "NGN",
        "channels": ["card", "bank", "ussd", "mobile_money"],
    }
    if callback_url:
        payload["callback_url"] = callback_url

    try:
        resp = await _post("/transaction/initialize", payload)
    except httpx.HTTPStatusError as exc:
        log.error("Paystack initialize failed: %s", exc.response.text)
        raise HTTPException(status_code=502, detail="Payment gateway error. Try again.")

    data = resp.get("data", {})
    return {
        "authorization_url": data.get("authorization_url"),
        "access_code": data.get("access_code"),
        "reference": data.get("reference", reference),
    }


async def verify_transaction(reference: str) -> dict:
    """Verify a Paystack transaction by reference.

    Used as a manual fallback when the webhook hasn't fired yet.

    Returns:
        {
          "status": "success" | "failed" | "abandoned",
          "amount_naira": float,
          "reference": str,
          "job_id": str | None,
          "paid_at": str | None,
        }

    Raises:
        HTTPException 404: Reference not found.
        HTTPException 502: Paystack error.
    """
    try:
        resp = await _get(f"/transaction/verify/{reference}")
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Transaction not found.")
        log.error("Paystack verify failed: %s", exc.response.text)
        raise HTTPException(status_code=502, detail="Payment gateway error. Try again.")

    data = resp.get("data", {})
    return {
        "status": data.get("status"),
        "amount_naira": data.get("amount", 0) / 100,
        "reference": data.get("reference"),
        "job_id": (data.get("metadata") or {}).get("job_id"),
        "paid_at": data.get("paid_at"),
    }


def validate_webhook_signature(raw_body: bytes, signature_header: str) -> bool:
    """Verify that an inbound webhook came from Paystack.

    Paystack signs webhooks with HMAC-SHA512 using your secret key.
    Returns False (rather than raising) so the route can return 400.
    """
    if not settings.PAYSTACK_WEBHOOK_SECRET:
        log.warning("PAYSTACK_WEBHOOK_SECRET not set — skipping signature check")
        return True  # Allow through in dev; block in prod by always setting the secret

    expected = hmac.new(
        settings.PAYSTACK_WEBHOOK_SECRET.encode(),
        raw_body,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header or "")


async def handle_charge_success(data: dict) -> None:
    """Process a verified charge.success webhook event.

    Updates the job's payment_status to 'paid' and fires a push notification.
    Safe to call multiple times — idempotent UPDATE WHERE payment_status != 'paid'.
    """
    job_id_str = (data.get("metadata") or {}).get("job_id")
    if not job_id_str:
        log.warning("charge.success webhook missing job_id in metadata")
        return

    try:
        job_id = uuid.UUID(str(job_id_str))
    except ValueError:
        log.warning("charge.success webhook has invalid job_id: %s", job_id_str)
        return

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE jobs
               SET payment_status = 'paid'
             WHERE id = $1
               AND payment_status != 'paid'
            RETURNING id, user_id, janitor_id, service_type
            """,
            job_id,
        )

    if row:
        log.info("Payment confirmed for job %s", job_id)
        # Fire push notification (fire-and-forget — import lazily to avoid circular deps)
        try:
            import asyncio
            from app.services.notification_service import notify_job_status_change
            asyncio.create_task(
                notify_job_status_change(dict(row), "payment_confirmed")
            )
        except Exception:
            pass  # Notification failure must not affect webhook response
    else:
        log.info("charge.success for job %s — already paid or not found", job_id)
