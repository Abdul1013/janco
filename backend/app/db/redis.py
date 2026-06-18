"""
Redis client singleton.

Provides a shared async Redis connection used by:
  - Rate limiter    (process-safe sliding-window counters)
  - Pricing cache   (shared TTL cache across all workers)
  - Future: WebSocket pub/sub, Celery broker

If REDIS_URL is not set, every call to get_redis() returns None and all
consumers fall back to in-memory behaviour — the system runs correctly
without Redis and simply gains multi-process safety when Redis is present.

Usage::

    from app.db.redis import get_redis

    r = get_redis()
    if r:
        await r.set("key", "value", ex=60)
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis   # type: ignore[import]
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

_redis: "aioredis.Redis | None" = None  # type: ignore[name-defined]


async def create_redis() -> None:
    """Connect to Redis if REDIS_URL is configured.  No-op otherwise.

    Called once during FastAPI lifespan startup.  Silently degrades if
    Redis is unreachable — the app continues with in-memory fallbacks.
    """
    global _redis
    url = os.getenv("REDIS_URL")
    if not url:
        logger.info(
            "REDIS_URL not configured — running without Redis "
            "(in-memory rate-limiter and pricing cache active)."
        )
        return

    if not _REDIS_AVAILABLE:
        logger.warning(
            "redis package not installed. "
            "Run: pip install 'redis>=5.0.0'  — falling back to in-memory."
        )
        return

    try:
        client = aioredis.from_url(url, encoding="utf-8", decode_responses=True)
        await client.ping()
        _redis = client
        # Log without leaking credentials (hide everything before @)
        safe_url = url.split("@")[-1] if "@" in url else url
        logger.info("Redis connected: %s", safe_url)
    except Exception as exc:
        logger.warning(
            "Redis connection failed (%s) — in-memory fallbacks active.", exc
        )
        _redis = None


async def close_redis() -> None:
    """Close the Redis connection.  Called during FastAPI lifespan shutdown."""
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


def get_redis() -> "aioredis.Redis | None":  # type: ignore[name-defined]
    """Return the active Redis client, or None if Redis is unavailable."""
    return _redis
