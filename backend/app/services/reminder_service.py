"""
Reminder Service — in-process scheduled booking reminders.

A lightweight async polling loop (no external scheduler/dependency) that sends
booking reminders to both parties:

  - 24h            : ~24 hours before the scheduled start
  - same_day_morning : in the morning of the scheduled date
  - same_day_soon  : a few hours before the scheduled start

Idempotency / multi-worker safety
----------------------------------
Each (job_id, kind) reminder is "claimed" with an atomic
``INSERT ... ON CONFLICT DO NOTHING`` into ``notification_log`` before sending.
Only the worker that wins the insert sends, so a reminder is delivered exactly
once even when uvicorn runs multiple workers.

Timezone
--------
``scheduled_date``/``scheduled_time`` are naive local (WAT) values. We compare
against "now" shifted by APP_TZ_OFFSET_HOURS. No DST in Nigeria, so a fixed
offset is correct.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.db.pool import get_pool
from app.services import notification_service

log = logging.getLogger(__name__)

_KINDS = ("24h", "same_day_morning", "same_day_soon")


def _now_local() -> datetime:
    """Current time in the app's local timezone (WAT by default), naive."""
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        hours=settings.APP_TZ_OFFSET_HOURS
    )


def _parse_scheduled(date_str: str | None, time_str: str | None) -> datetime | None:
    """Parse TEXT scheduled_date (+ optional time) into a naive local datetime.

    Defaults the time to 09:00 when missing. Returns None on parse failure.
    """
    if not date_str:
        return None
    t = (time_str or "09:00").strip()
    # Accept "HH:MM" or "HH:MM:SS"
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(f"{date_str.strip()} {t}", fmt)
        except ValueError:
            continue
    # Time unparseable — fall back to date at 09:00
    try:
        return datetime.strptime(date_str.strip(), "%Y-%m-%d").replace(hour=9)
    except ValueError:
        return None


def _due_kinds(scheduled: datetime, now: datetime) -> list[str]:
    """Return the reminder kinds currently due for a job's scheduled time."""
    due: list[str] = []
    delta_h = (scheduled - now).total_seconds() / 3600.0
    soon_h = settings.REMINDER_SOON_HOURS

    # Skip anything already started/past.
    if delta_h <= 0:
        return due

    # 24h-before: fires once when crossing into the final day (but not for the
    # near-term window covered by same-day reminders).
    if soon_h < delta_h <= 24:
        # Only treat as "24h" when it's genuinely ~a day out (not same calendar day)
        if delta_h > 12:
            due.append("24h")

    # same-day reminders only when the job is on today's date.
    if scheduled.date() == now.date():
        if now.hour >= settings.REMINDER_MORNING_HOUR and delta_h > soon_h:
            due.append("same_day_morning")
        if 0 < delta_h <= soon_h:
            due.append("same_day_soon")

    return due


async def _claim(conn, job_id, kind: str) -> bool:
    """Atomically claim a (job_id, kind) reminder slot. True if we won it."""
    row = await conn.fetchrow(
        """
        INSERT INTO notification_log (job_id, kind)
        VALUES ($1, $2)
        ON CONFLICT (job_id, kind) DO NOTHING
        RETURNING id
        """,
        job_id,
        kind,
    )
    return row is not None


async def _tick() -> None:
    """One scheduler pass: find due reminders, claim, and send."""
    now = _now_local()
    pool = get_pool()

    async with pool.acquire() as conn:
        # Confirmed jobs scheduled within the next ~2 days (string date compare is
        # safe for ISO 'YYYY-MM-DD'); we parse precisely in Python.
        horizon = (now + timedelta(days=2)).strftime("%Y-%m-%d")
        today = now.strftime("%Y-%m-%d")
        rows = await conn.fetch(
            """
            SELECT id, user_id, janitor_id, service_type, scheduled_date, scheduled_time
            FROM jobs
            WHERE status = 'confirmed'
              AND scheduled_date IS NOT NULL
              AND scheduled_date >= $1
              AND scheduled_date <= $2
            """,
            today,
            horizon,
        )

        for row in rows:
            scheduled = _parse_scheduled(row["scheduled_date"], row["scheduled_time"])
            if not scheduled:
                continue
            for kind in _due_kinds(scheduled, now):
                # Claim-then-send: only send if we won the insert.
                if await _claim(conn, row["id"], kind):
                    try:
                        await notification_service.notify_job_reminder(dict(row), kind)
                    except Exception as exc:  # never let one job break the pass
                        log.warning("Reminder send failed (job=%s kind=%s): %s", row["id"], kind, exc)


async def run_loop() -> None:
    """Run the reminder loop forever (cancelled on shutdown)."""
    interval = max(1, settings.REMINDER_POLL_MINUTES) * 60
    log.info("Reminder loop started (every %s min, tz offset +%sh).",
             settings.REMINDER_POLL_MINUTES, settings.APP_TZ_OFFSET_HOURS)
    while True:
        try:
            await _tick()
        except asyncio.CancelledError:
            log.info("Reminder loop stopped.")
            raise
        except Exception as exc:  # a bad tick must never kill the loop
            log.warning("Reminder tick error: %s", exc)
        await asyncio.sleep(interval)
