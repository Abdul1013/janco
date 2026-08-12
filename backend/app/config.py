"""
JANCO Backend Configuration.

Loads all environment variables on import and validates that required
values are present.  If any required var is missing the app crashes
on startup with a clear error — fail fast, not at request time.

Usage::

    from app.config import settings
    db_url = settings.DATABASE_URL
"""

import os
from dotenv import load_dotenv

load_dotenv()


class _Settings:
    """Simple settings container. Validates required vars on init."""

    def __init__(self):
        # Database
        self.DATABASE_URL: str = self._require("DATABASE_URL")

        # JWT — HS256 with a strong random secret (≥32 bytes).
        # Generate: python -c "import secrets; print(secrets.token_hex(32))"
        self.JWT_SECRET: str = self._require("JWT_SECRET")
        self.JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
        self.ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
        )
        self.REFRESH_TOKEN_EXPIRE_DAYS: int = int(
            os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")
        )

        # Environment ("development" | "staging" | "production")
        self.APP_ENV: str = os.getenv("APP_ENV", "development")

        # CORS (comma-separated origins)
        raw_origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:8081,http://localhost:19006,exp://localhost:8081,https://janco-seven.vercel.app,https://janco.vercel.app",
        )
        self.CORS_ORIGINS: list[str] = [o.strip() for o in raw_origins.split(",")]

        # Rate-limit defaults (requests per minute)
        self.RATE_LIMIT_GENERAL: int = int(os.getenv("RATE_LIMIT_GENERAL", "100"))
        self.RATE_LIMIT_AUTH: int = int(os.getenv("RATE_LIMIT_AUTH", "5"))

        # Payment (Paystack)
        self.PAYSTACK_SECRET_KEY: str = os.getenv("PAYSTACK_SECRET_KEY", "")
        self.PAYSTACK_WEBHOOK_SECRET: str = os.getenv("PAYSTACK_WEBHOOK_SECRET", "")

        # Email (Resend)
        self.RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
        self.FROM_EMAIL: str = os.getenv("FROM_EMAIL", "noreply@janco.app")

        # SMS (Termii) — janitor alerts & reminders. Mocked (logged) when no key.
        self.TERMII_API_KEY: str = os.getenv("TERMII_API_KEY", "")
        self.TERMII_SENDER_ID: str = os.getenv("TERMII_SENDER_ID", "JANCO")
        self.SMS_MOCK: bool = os.getenv("SMS_MOCK", "true").lower() == "true"

        # Scheduled reminders (in-process loop)
        self.REMINDERS_ENABLED: bool = os.getenv("REMINDERS_ENABLED", "true").lower() == "true"
        self.REMINDER_POLL_MINUTES: int = int(os.getenv("REMINDER_POLL_MINUTES", "10"))
        self.REMINDER_MORNING_HOUR: int = int(os.getenv("REMINDER_MORNING_HOUR", "7"))
        self.REMINDER_SOON_HOURS: int = int(os.getenv("REMINDER_SOON_HOURS", "3"))
        # App timezone offset from UTC in hours (Nigeria / WAT = +1)
        self.APP_TZ_OFFSET_HOURS: int = int(os.getenv("APP_TZ_OFFSET_HOURS", "1"))

        # Error monitoring
        self.SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

        # Redis (optional — enables rate limiter, pricing cache, pub/sub)
        self.REDIS_URL: str = os.getenv("REDIS_URL", "")

        # Legal docs — bump when Terms/Privacy content materially changes.
        # The active version is stored against each signup (profiles.terms_version).
        self.LEGAL_VERSION: str = os.getenv("LEGAL_VERSION", "1.0")

    @staticmethod
    def _require(name: str) -> str:
        """Return env var value or raise with a helpful message."""
        value = os.getenv(name)
        if not value:
            raise RuntimeError(
                f"Missing required environment variable: {name}. "
                f"Add it to backend/.env and restart."
            )
        return value


settings = _Settings()
