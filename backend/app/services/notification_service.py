"""
Notification Service.

Sends push notifications via Firebase Cloud Messaging (FCM) through
the Expo push notification service.

Trigger events:
  - Job status change (pending → confirmed → in_progress → completed)
  - New chat message received
  - New booking assigned to janitor
  - Verification result ready

For beta/development, a mock mode logs notifications instead of
sending them to FCM.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid as _uuid
from typing import Any

from app.db.pool import get_pool
from app.services import email_service, sms_service

logger = logging.getLogger(__name__)


async def _get_contact(user_id: str) -> dict | None:
    """Fetch a user's notification contact fields in one query.

    Returns {push_token, phone, email, full_name} or None if not found.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT push_token, phone, email, full_name FROM profiles WHERE id = $1",
            _uuid.UUID(str(user_id)),
        )
    return dict(row) if row else None

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
USE_MOCK = os.getenv("NOTIFICATION_MOCK", "true").lower() == "true"
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def send_push(
    user_id: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Send a push notification to a user.

    Looks up the user's Expo push token from the profiles table,
    then sends via Expo push service.

    Args:
        user_id: The recipient's user ID.
        title: Notification title.
        body: Notification body text.
        data: Optional data payload for deep linking.

    Returns:
        Dict with ``sent`` (bool) and ``message``.
    """
    # Look up push token
    import uuid as _uuid
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT push_token, full_name FROM profiles WHERE id = $1",
            _uuid.UUID(str(user_id)),
        )

    if not row or not row["push_token"]:
        return {"sent": False, "message": "No push token registered."}

    push_token = row["push_token"]

    if USE_MOCK:
        # Log instead of sending
        logger.info("[MOCK PUSH] To: %s | Title: %s | Body: %s", user_id, title, body)
        return {"sent": True, "message": "Mock notification logged."}

    return await _send_expo_push(push_token, title, body, data)


async def notify_job_status_change(
    job: dict,
    new_status: str,
) -> None:
    """Schedule push notifications when a job status changes (fire-and-forget).

    Returns immediately — notifications are delivered in a background task
    so the caller's response time is not affected by Expo API latency.

    Args:
        job: The job dict with user_id, janitor_id, service_type.
        new_status: The new status value.
    """
    asyncio.create_task(_do_notify_job_status_change(job, new_status))


async def _do_notify_job_status_change(job: dict, new_status: str) -> None:
    """Internal: performs the actual push sends for a status change."""
    status_messages = {
        "confirmed": {
            "customer_title": "Booking Confirmed!",
            "customer_body": "A janitor has accepted your booking.",
            "janitor_title": "Job Accepted",
            "janitor_body": "You've accepted a new job.",
        },
        "in_progress": {
            "customer_title": "Cleaning In Progress",
            "customer_body": "Your janitor has started the job.",
            "janitor_title": "Job Started",
            "janitor_body": "Job is now in progress.",
        },
        "completed": {
            "customer_title": "Job Completed!",
            "customer_body": "Your cleaning job is done. Please rate your janitor.",
            "janitor_title": "Job Completed",
            "janitor_body": "Great work! Job marked as completed.",
        },
        "cancelled": {
            "customer_title": "Booking Cancelled",
            "customer_body": "Your booking has been cancelled.",
            "janitor_title": "Job Cancelled",
            "janitor_body": "A job has been cancelled.",
        },
        "payment_confirmed": {
            "customer_title": "Payment Received",
            "customer_body": "Your payment was confirmed. Thank you!",
            "janitor_title": "Payment Confirmed",
            "janitor_body": "Payment for your job has been confirmed.",
        },
    }

    msgs = status_messages.get(new_status)
    if not msgs:
        return

    data = {
        "type": "job_status",
        "job_id": str(job.get("id", "")),
        "status": new_status,
    }

    # Notify customer and janitor concurrently
    tasks = []
    if job.get("user_id"):
        tasks.append(send_push(
            str(job["user_id"]),
            msgs["customer_title"],
            msgs["customer_body"],
            data,
        ))
    if job.get("janitor_id"):
        tasks.append(send_push(
            str(job["janitor_id"]),
            msgs["janitor_title"],
            msgs["janitor_body"],
            data,
        ))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

    # Email is reserved for the completion event — notify the customer by email
    # in addition to the push above.
    if new_status == "completed" and job.get("user_id"):
        contact = await _get_contact(str(job["user_id"]))
        if contact and contact.get("email"):
            await email_service.send_job_completed(
                email=contact["email"],
                full_name=contact.get("full_name") or "",
                job_id=str(job.get("id", "")),
                service_type=str(job.get("service_type", "")),
            )


async def notify_new_message(
    recipient_id: str,
    sender_name: str,
    job_id: str,
) -> None:
    """Schedule a push notification for a new chat message (fire-and-forget).

    Args:
        recipient_id: User ID of the message recipient.
        sender_name: Display name of the sender.
        job_id: The associated job ID for deep linking.
    """
    asyncio.create_task(send_push(
        user_id=recipient_id,
        title="New Message",
        body=f"{sender_name} sent you a message.",
        data={"type": "chat", "job_id": job_id},
    ))


async def notify_new_booking_assigned(
    janitor_id: str,
    job_id: str,
    service_type: str,
) -> None:
    """Schedule notifications when a booking is assigned to a janitor.

    Janitors get both a push and an SMS (SMS because janitors may be on
    lower-end devices where push is unreliable). Fire-and-forget.

    Args:
        janitor_id: The janitor being notified.
        job_id: The new job ID.
        service_type: Type of cleaning service.
    """
    asyncio.create_task(_do_notify_new_booking_assigned(janitor_id, job_id, service_type))


async def _do_notify_new_booking_assigned(janitor_id: str, job_id: str, service_type: str) -> None:
    service_label = service_type.replace("_", " ")
    body = f"You have a new {service_label} booking. Open JANCO to accept or reject it."

    tasks = [send_push(
        user_id=janitor_id,
        title="New Job Available!",
        body=body,
        data={"type": "new_booking", "job_id": job_id},
    )]

    contact = await _get_contact(janitor_id)
    if contact and contact.get("phone"):
        tasks.append(sms_service.send_sms(
            contact["phone"],
            f"JANCO: New {service_label} job assigned to you. Open the app to accept or reject.",
        ))

    await asyncio.gather(*tasks, return_exceptions=True)


async def notify_job_rejected(job: dict) -> None:
    """Notify the customer that the assigned janitor became unavailable.

    Sent when a janitor rejects a pending job (which unassigns it). Push to the
    customer only. Fire-and-forget.
    """
    user_id = job.get("user_id")
    if not user_id:
        return
    asyncio.create_task(send_push(
        user_id=str(user_id),
        title="Finding you another janitor",
        body="Your assigned janitor became unavailable. We're matching you with another.",
        data={"type": "job_status", "job_id": str(job.get("id", "")), "status": "pending"},
    ))


# Reminder copy keyed by kind.
_REMINDER_COPY = {
    "24h": {
        "customer_title": "Booking tomorrow",
        "customer_body": "Reminder: your JANCO cleaning is scheduled in about 24 hours.",
        "janitor_title": "Job tomorrow",
        "janitor_body": "Reminder: you have a JANCO job scheduled in about 24 hours.",
        "sms": "JANCO reminder: you have a job scheduled in ~24 hours.",
    },
    "same_day_morning": {
        "customer_title": "Booking today",
        "customer_body": "Reminder: your JANCO cleaning is scheduled for today.",
        "janitor_title": "Job today",
        "janitor_body": "Reminder: you have a JANCO job scheduled for today.",
        "sms": "JANCO reminder: you have a job scheduled today.",
    },
    "same_day_soon": {
        "customer_title": "Booking soon",
        "customer_body": "Your JANCO cleaning is starting soon.",
        "janitor_title": "Job soon",
        "janitor_body": "Your JANCO job is starting soon. Please head over.",
        "sms": "JANCO reminder: your job starts soon. Please head to the location.",
    },
}


async def notify_job_reminder(job: dict, kind: str) -> None:
    """Send a scheduled reminder for an upcoming job.

    Push to both parties; SMS additionally to the janitor. Awaited directly by
    the reminder loop (which has already claimed the send slot), so this is NOT
    fire-and-forget.

    Args:
        job: Job dict with user_id, janitor_id, id.
        kind: '24h' | 'same_day_morning' | 'same_day_soon'.
    """
    copy = _REMINDER_COPY.get(kind)
    if not copy:
        return

    data = {"type": "job_reminder", "job_id": str(job.get("id", "")), "kind": kind}
    tasks = []

    if job.get("user_id"):
        tasks.append(send_push(
            str(job["user_id"]), copy["customer_title"], copy["customer_body"], data,
        ))
    if job.get("janitor_id"):
        tasks.append(send_push(
            str(job["janitor_id"]), copy["janitor_title"], copy["janitor_body"], data,
        ))
        contact = await _get_contact(str(job["janitor_id"]))
        if contact and contact.get("phone"):
            tasks.append(sms_service.send_sms(contact["phone"], copy["sms"]))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def send_broadcast_push(
    recipients: list[dict],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> int:
    """Send an admin broadcast push notification to many recipients.

    Only recipients with a registered ``push_token`` receive a push. Sends are
    fanned out concurrently in bounded chunks; failures are swallowed per
    recipient (gather with return_exceptions).

    Args:
        recipients: List of dicts each optionally containing ``push_token``.
        title: Notification title.
        body: Notification body text.
        data: Optional deep-link payload.

    Returns:
        The number of recipients with a push token a send was attempted for.
    """
    tokens = [r["push_token"] for r in recipients if r.get("push_token")]

    if USE_MOCK:
        logger.info(
            "[MOCK BROADCAST PUSH] %d recipient(s) | Title: %s | Body: %s",
            len(tokens), title, body,
        )
        return len(tokens)

    attempted = 0
    chunk = 100
    for i in range(0, len(tokens), chunk):
        batch = tokens[i : i + chunk]
        results = await asyncio.gather(
            *(_send_expo_push(tok, title, body, data) for tok in batch),
            return_exceptions=True,
        )
        attempted += len(results)
    logger.info("Broadcast push '%s' attempted for %d recipient(s).", title, attempted)
    return attempted


async def register_push_token(user_id: str, push_token: str) -> dict:
    """Store a user's Expo push token in their profile.

    Args:
        user_id: The user's ID.
        push_token: The Expo push token string.

    Returns:
        Dict with status message.
    """
    import uuid as _uuid
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE profiles SET push_token = $1 WHERE id = $2",
            push_token,
            _uuid.UUID(str(user_id)),
        )
    return {"message": "Push token registered."}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _send_expo_push(
    push_token: str,
    title: str,
    body: str,
    data: dict | None = None,
) -> dict[str, Any]:
    """Send a push notification via Expo's push service.

    Args:
        push_token: Expo push token.
        title: Notification title.
        body: Notification body.
        data: Optional deep link data.

    Returns:
        Dict with ``sent`` (bool) and ``message``.
    """
    import httpx

    payload = {
        "to": push_token,
        "title": title,
        "body": body,
        "sound": "default",
    }
    if data:
        payload["data"] = data

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(EXPO_PUSH_URL, json=payload)
            resp.raise_for_status()
            return {"sent": True, "message": "Notification sent."}
    except Exception as e:
        return {"sent": False, "message": f"Push failed: {str(e)}"}
