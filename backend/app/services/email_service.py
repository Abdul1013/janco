"""
Email Service — Resend integration.

Sends transactional emails using the Resend API (https://resend.com).

Graceful degradation:
  - If RESEND_API_KEY is empty, emails are logged to stdout instead of sent.
    This keeps development working without an email provider configured.
  - All functions are fire-and-forget safe (caller should use asyncio.create_task).

Email types implemented:
  - Password reset link
  - Email verification link
  - Booking confirmation summary

Docs: https://resend.com/docs/api-reference/emails/send-email
"""

from __future__ import annotations

import asyncio
import html as _html
import logging
import textwrap

import httpx

from app.config import settings

log = logging.getLogger(__name__)

# Resend's batch endpoint accepts up to 100 messages per call; we fan out in
# chunks of this size to stay within that limit and bound concurrency.
_BROADCAST_CHUNK = 100

_RESEND_URL = "https://api.resend.com/emails"
_APP_URL = "https://janco.app"  # Update once custom domain is live


# ─────────────────────────────────────────────────────────────────────────────
# Internal HTTP helper
# ─────────────────────────────────────────────────────────────────────────────

async def _send(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend.

    Returns True on success, False on failure.
    Logs a warning (not an exception) so caller is never blocked.
    """
    if not settings.RESEND_API_KEY:
        # Development fallback — print to stdout
        log.info(
            "[EMAIL DEV MODE] To: %s | Subject: %s\n%s",
            to,
            subject,
            html,
        )
        return True

    payload = {
        "from": settings.FROM_EMAIL,
        "to": [to],
        "subject": subject,
        "html": html,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                _RESEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            )
        if res.status_code in (200, 201):
            log.info("Email sent to %s — subject: %s", to, subject)
            return True

        log.warning(
            "Resend API error %s sending to %s: %s",
            res.status_code,
            to,
            res.text[:200],
        )
        return False

    except Exception as exc:
        log.warning("Email send failed (to=%s): %s", to, exc)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Email templates
# ─────────────────────────────────────────────────────────────────────────────

def _base_template(title: str, body_html: str) -> str:
    """Minimal responsive HTML email wrapper."""
    return textwrap.dedent(f"""\
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                   background: #f4f4f5; margin: 0; padding: 24px; color: #18181b; }}
            .card {{ max-width: 480px; margin: 0 auto; background: #fff;
                    border-radius: 12px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }}
            .logo {{ color: #6750A4; font-size: 22px; font-weight: 700; margin-bottom: 24px; }}
            h2 {{ font-size: 20px; margin: 0 0 12px; }}
            p {{ font-size: 15px; line-height: 1.6; margin: 0 0 16px; color: #52525b; }}
            .btn {{ display: inline-block; background: #6750A4; color: #fff !important;
                   text-decoration: none; padding: 12px 24px; border-radius: 8px;
                   font-size: 15px; font-weight: 600; margin: 8px 0; }}
            .footer {{ font-size: 12px; color: #a1a1aa; margin-top: 24px; text-align: center; }}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">JANCO</div>
            <h2>{title}</h2>
            {body_html}
            <div class="footer">© 2026 JANCO. All rights reserved.</div>
          </div>
        </body>
        </html>
    """)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

async def send_password_reset(email: str, raw_token: str, full_name: str = "") -> bool:
    """Send a password reset email with a magic link.

    The reset link contains the raw token.  The frontend deep-links to
    janco://reset-password?token=<raw_token> which calls the confirm
    endpoint.

    Args:
        email: Recipient's email address.
        raw_token: Plain-text reset token (not the hash).
        full_name: Optional display name for personalisation.
    """
    name = full_name.split()[0] if full_name else "there"
    reset_url = f"{_APP_URL}/reset-password?token={raw_token}"
    deep_link = f"janco://reset-password?token={raw_token}"

    body = f"""\
        <p>Hi {name},</p>
        <p>We received a request to reset your JANCO password. Click the button
           below to set a new password. This link expires in <strong>30 minutes</strong>.</p>
        <a class="btn" href="{reset_url}">Reset Password</a>
        <p style="margin-top:16px;font-size:13px;color:#71717a;">
          If the button above doesn't work, copy and paste this link:<br/>
          <code style="word-break:break-all;">{deep_link}</code>
        </p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
    """
    return await _send(
        to=email,
        subject="Reset your JANCO password",
        html=_base_template("Reset your password", body),
    )


async def send_email_verification(email: str, raw_token: str, full_name: str = "") -> bool:
    """Send an email address verification link.

    Args:
        email: Recipient's email address.
        raw_token: Plain-text verification token.
        full_name: Optional display name.
    """
    name = full_name.split()[0] if full_name else "there"
    verify_url = f"{_APP_URL}/verify-email?token={raw_token}"
    deep_link = f"janco://verify-email?token={raw_token}"

    body = f"""\
        <p>Hi {name},</p>
        <p>Welcome to JANCO! Please verify your email address to activate your account.</p>
        <a class="btn" href="{verify_url}">Verify Email</a>
        <p style="margin-top:16px;font-size:13px;color:#71717a;">
          If the button above doesn't work, copy and paste this link:<br/>
          <code style="word-break:break-all;">{deep_link}</code>
        </p>
        <p>This link expires in <strong>24 hours</strong>.</p>
    """
    return await _send(
        to=email,
        subject="Verify your JANCO email address",
        html=_base_template("Verify your email", body),
    )


async def send_job_completed(
    email: str,
    full_name: str,
    job_id: str,
    service_type: str,
) -> bool:
    """Send a job-completion email inviting the customer to rate the janitor.

    Email is the JANCO channel reserved for the completion event.
    """
    name = full_name.split()[0] if full_name else "there"
    service_label = service_type.replace("_", " ").title()

    body = f"""\
        <p>Hi {name},</p>
        <p>Your <strong>{service_label}</strong> booking is now complete. We hope
           everything was sparkling!</p>
        <p>Please take a moment to rate your janitor — your feedback keeps the
           JANCO community trustworthy and helps great janitors stand out.</p>
        <p style="margin-top:16px;font-size:13px;color:#71717a;">
          Booking ID: {job_id[:8]}…
        </p>
        <p>Thank you for choosing JANCO!</p>
    """
    return await _send(
        to=email,
        subject="Your JANCO cleaning is complete — leave a rating",
        html=_base_template("Job Completed", body),
    )


async def send_broadcast(
    recipients: list[dict],
    subject: str,
    body: str,
) -> int:
    """Send an admin broadcast email to many recipients.

    The plain-text ``body`` typed by the admin is escaped and wrapped in the
    standard JANCO email template. Sends are fanned out in bounded chunks so a
    large audience doesn't open hundreds of sockets at once. Per-recipient
    failures are logged, not raised.

    Args:
        recipients: List of dicts each containing at least ``email`` (rows
            without an email are skipped).
        subject: Email subject line.
        body: Plain-text message body (newlines become paragraph breaks).

    Returns:
        The number of recipients a send was attempted for.
    """
    # Convert the admin's plain text into safe HTML paragraphs.
    paragraphs = "".join(
        f"<p>{_html.escape(line).strip()}</p>"
        for line in body.split("\n")
        if line.strip()
    )
    html_body = _base_template(subject, paragraphs)

    emails = [r["email"] for r in recipients if r.get("email")]
    attempted = 0
    for i in range(0, len(emails), _BROADCAST_CHUNK):
        chunk = emails[i : i + _BROADCAST_CHUNK]
        results = await asyncio.gather(
            *(_send(to=addr, subject=subject, html=html_body) for addr in chunk),
            return_exceptions=True,
        )
        attempted += len(results)
    log.info("Broadcast email '%s' attempted for %d recipient(s).", subject, attempted)
    return attempted


async def send_booking_confirmation(
    email: str,
    full_name: str,
    job_id: str,
    service_type: str,
    scheduled_date: str,
    scheduled_time: str,
    price: int,
) -> bool:
    """Send a booking confirmation email.

    Args:
        email: Customer's email address.
        full_name: Customer's full name.
        job_id: Job UUID string.
        service_type: e.g. "house_cleaning".
        scheduled_date: e.g. "2026-06-15".
        scheduled_time: e.g. "09:00".
        price: Price in Naira (integer).
    """
    name = full_name.split()[0] if full_name else "there"
    service_label = service_type.replace("_", " ").title()
    formatted_price = f"₦{price:,}"

    body = f"""\
        <p>Hi {name},</p>
        <p>Your JANCO booking has been confirmed! Here are your booking details:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#71717a;">Service</td>
              <td style="padding:6px 0;font-weight:600;">{service_label}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a;">Date</td>
              <td style="padding:6px 0;font-weight:600;">{scheduled_date}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a;">Time</td>
              <td style="padding:6px 0;font-weight:600;">{scheduled_time}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a;">Total</td>
              <td style="padding:6px 0;font-weight:600;">{formatted_price}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a;">Booking ID</td>
              <td style="padding:6px 0;font-size:12px;color:#71717a;">{job_id[:8]}…</td></tr>
        </table>
        <p style="margin-top:16px;">You will receive a push notification when a janitor
           is assigned to your booking.</p>
        <p>Thank you for choosing JANCO!</p>
    """
    return await _send(
        to=email,
        subject=f"Booking confirmed — {service_label} on {scheduled_date}",
        html=_base_template("Booking Confirmed", body),
    )
