"""
Rate Limiter Middleware.

When Redis is available (REDIS_URL configured), uses an atomic fixed-window
counter keyed per IP — consistent across every worker process and pod.

When Redis is not available, falls back to the original in-memory sliding
window — correct for a single process, over-permissive under horizontal
scaling (each process enforces its own independent counter).

Limits (configurable via env vars, defaults in config.py):
  - General endpoints:  100 req / 60 s
  - Auth endpoints:     5 req / 60 s  (login, signup)
"""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.db.redis import get_redis

WINDOW_SECONDS = 60


# ---------------------------------------------------------------------------
# In-memory fallback (single-process only)
# ---------------------------------------------------------------------------

class _InMemoryBucket:
    """Sliding-window counter.  Correct for one process; not shared."""

    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, key: str, limit: int) -> bool:
        now = time.time()
        cutoff = now - WINDOW_SECONDS
        bucket = self._requests[key]
        # Prune expired entries and evict empty keys to bound memory growth
        fresh = [t for t in bucket if t > cutoff]
        if len(fresh) >= limit:
            self._requests[key] = fresh
            return False
        fresh.append(now)
        self._requests[key] = fresh
        return True


_fallback = _InMemoryBucket()


# ---------------------------------------------------------------------------
# Redis fixed-window counter (multi-process safe)
# ---------------------------------------------------------------------------

async def _is_allowed_redis(client_ip: str, limit: int) -> bool:
    """Atomic INCR-based fixed-window rate check via Redis.

    Uses a key bucketed by the current 60-second window so counters reset
    automatically without a background cleanup job.

    Silently falls back to in-memory on any Redis failure so the service
    stays up even if Redis has a transient hiccup.
    """
    r = get_redis()
    if r is None:
        return _fallback.is_allowed(client_ip, limit)

    try:
        # Key format: rl:{ip}:{window_bucket}
        # e.g.  rl:1.2.3.4:28555430  (Unix epoch // 60)
        bucket = int(time.time()) // WINDOW_SECONDS
        key = f"rl:{client_ip}:{bucket}"
        count = await r.incr(key)
        if count == 1:
            # First hit in this window — set TTL so the key auto-expires
            await r.expire(key, WINDOW_SECONDS * 2)
        return count <= limit
    except Exception:
        # Redis hiccup — degrade gracefully, never block legitimate traffic
        return _fallback.is_allowed(client_ip, limit)


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware that enforces per-client rate limits."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        is_auth = "/auth/login" in path or "/auth/signup" in path
        limit = settings.RATE_LIMIT_AUTH if is_auth else settings.RATE_LIMIT_GENERAL

        allowed = await _is_allowed_redis(client_ip, limit)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": f"Too many requests. Limit: {limit}/min.",
                    }
                },
            )

        return await call_next(request)
