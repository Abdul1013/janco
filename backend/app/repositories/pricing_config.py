"""
Pricing Config Repository.

Loads and updates pricing parameters stored in the pricing_config table.

Cache hierarchy (fastest → slowest):
  1. Redis  (shared across all worker processes, 5-min TTL)
  2. Process-local memory  (fallback when Redis is unavailable)
  3. Database  (authoritative source)
  4. DEFAULT_CONFIG  (last resort if DB unreachable)

When the admin saves new prices, the Redis key is deleted so every
process picks up fresh values on their next request — no stale pricing
across workers.
"""

from __future__ import annotations

import json
import time
from typing import Any

from app.db.redis import get_redis

DEFAULT_CONFIG: dict[str, float] = {
    "room_rate": 1000,
    "toilet_rate": 500,
    "deep_cleaning_room_rate": 3000,
    "kitchen_extra": 2000,
    "living_room_extra": 1500,
    "window_cleaning_extra": 1000,
    "laundry_per_item": 300,
    "laundry_ironing": 500,
    "laundry_delicates": 100,
    "fumigation_flat": 10000,
    "scan_rate_per_sqm": 100,
    "transport_threshold_km": 5,
    "transport_band_km": 5,
    "transport_band_fee": 1000,
    "surge_peak": 1.2,
    "surge_holiday": 1.5,
    "price_floor": 5000,
    "price_ceiling": 200000,
    "platform_commission_rate": 0.20,
}

KNOWN_KEYS: frozenset[str] = frozenset(DEFAULT_CONFIG.keys())

_CACHE_TTL = 300          # 5 minutes (seconds)
_REDIS_KEY = "janco:pricing_config"

# Process-local fallback (used when Redis is unavailable)
_mem_cache: dict[str, float] = {}
_mem_cache_ts: float = 0.0


async def load_config(pool: Any) -> dict[str, float]:
    """Return current pricing config, served from cache where possible.

    Cache lookup order: Redis → process memory → database → defaults.
    """
    global _mem_cache, _mem_cache_ts

    # 1. Try Redis (shared across all processes)
    r = get_redis()
    if r is not None:
        try:
            cached = await r.get(_REDIS_KEY)
            if cached:
                return json.loads(cached)
        except Exception:
            pass  # Redis blip — fall through

    # 2. Process-local memory cache (fallback when Redis is down)
    if _mem_cache and (time.monotonic() - _mem_cache_ts) < _CACHE_TTL:
        return _mem_cache

    # 3. Fetch from database
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT key, value FROM pricing_config")
        if rows:
            fresh = {**DEFAULT_CONFIG}
            for row in rows:
                fresh[row["key"]] = float(row["value"])

            # Populate Redis cache (shared)
            if r is not None:
                try:
                    await r.setex(_REDIS_KEY, _CACHE_TTL, json.dumps(fresh))
                except Exception:
                    pass

            # Populate memory cache (local fallback)
            _mem_cache = fresh
            _mem_cache_ts = time.monotonic()
            return fresh
    except Exception:
        pass

    # 4. Last resort — return hardcoded defaults (no caching so next call retries DB)
    return dict(DEFAULT_CONFIG)


async def update_config(pool: Any, updates: dict[str, float]) -> None:
    """Persist updated pricing values and immediately invalidate all caches."""
    global _mem_cache, _mem_cache_ts

    async with pool.acquire() as conn:
        for key, value in updates.items():
            await conn.execute(
                """
                INSERT INTO pricing_config (key, value, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
                """,
                key,
                value,
            )

    # Invalidate Redis so ALL processes pick up fresh prices on next request
    r = get_redis()
    if r is not None:
        try:
            await r.delete(_REDIS_KEY)
        except Exception:
            pass

    # Also clear process-local cache
    _mem_cache = {}
    _mem_cache_ts = 0.0
