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

        # CORS (comma-separated origins)
        raw_origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:8081,http://localhost:19006,exp://localhost:8081",
        )
        self.CORS_ORIGINS: list[str] = [o.strip() for o in raw_origins.split(",")]

        # Rate-limit defaults (requests per minute)
        self.RATE_LIMIT_GENERAL: int = int(os.getenv("RATE_LIMIT_GENERAL", "100"))
        self.RATE_LIMIT_AUTH: int = int(os.getenv("RATE_LIMIT_AUTH", "5"))

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
