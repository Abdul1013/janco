"""
SMS Service — Termii integration.

Sends transactional SMS via the Termii API (https://termii.com), used mainly
for janitor alerts (new job, reminders) since janitors may be on lower-end
devices where push is less reliable.

Graceful degradation:
  - If SMS_MOCK is true (default) or TERMII_API_KEY is empty, messages are
    logged to stdout instead of sent. Development works without a provider.
  - All functions are fire-and-forget safe and never raise — failures are
    logged as warnings so a notification path is never blocked by SMS.

Docs: https://developer.termii.com/messaging-api
"""

from __future__ import annotations

import asyncio
import logging
import re

import httpx

from app.config import settings

log = logging.getLogger(__name__)

_TERMII_URL = "https://api.ng.termii.com/api/sms/send"
_BULK_CHUNK = 100


def _normalise_msisdn(phone: str) -> str | None:
    """Normalise a Nigerian phone number to international format (no '+').

    Termii expects digits in international format, e.g. '2348012345678'.
    Handles '+234…', '234…', and local '0…' forms. Returns None if the input
    has no usable digits.
    """
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    if digits.startswith("234"):
        return digits
    if digits.startswith("0"):
        return "234" + digits[1:]
    # Bare 10-digit local number (missing leading 0)
    if len(digits) == 10:
        return "234" + digits
    return digits


async def send_sms(phone: str, message: str) -> bool:
    """Send a single SMS. Returns True on success/mock, False on failure."""
    to = _normalise_msisdn(phone)
    if not to:
        log.warning("SMS skipped — no valid phone number (%r).", phone)
        return False

    if settings.SMS_MOCK or not settings.TERMII_API_KEY:
        log.info("[SMS DEV MODE] To: %s | %s", to, message)
        return True

    payload = {
        "api_key": settings.TERMII_API_KEY,
        "to": to,
        "from": settings.TERMII_SENDER_ID,
        "sms": message,
        "type": "plain",
        "channel": "generic",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(_TERMII_URL, json=payload)
        if res.status_code in (200, 201):
            log.info("SMS sent to %s.", to)
            return True
        log.warning("Termii API error %s sending to %s: %s", res.status_code, to, res.text[:200])
        return False
    except Exception as exc:
        log.warning("SMS send failed (to=%s): %s", to, exc)
        return False


async def send_bulk_sms(phones: list[str], message: str) -> int:
    """Send the same message to many numbers in bounded chunks.

    Returns the number of recipients a send was attempted for.
    """
    attempted = 0
    for i in range(0, len(phones), _BULK_CHUNK):
        chunk = phones[i : i + _BULK_CHUNK]
        results = await asyncio.gather(
            *(send_sms(p, message) for p in chunk),
            return_exceptions=True,
        )
        attempted += len(results)
    return attempted
