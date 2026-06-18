"""
asyncpg Connection Pool.

This is the ONLY place a pool is created.  Every module that needs
database access must import from here::

    from app.db.pool import get_pool

The pool is initialised on FastAPI startup and closed on shutdown via
the lifespan context in main.py.  Calling get_pool() before create_pool()
raises a RuntimeError immediately — fail fast, not at query time.
"""

from __future__ import annotations

import re
import urllib.parse

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None

# asyncpg does not understand libpq-only DSN parameters.
# Strip them before passing the DSN to create_pool.
_UNSUPPORTED_PARAMS = {"channel_binding"}


def _sanitize_dsn(dsn: str) -> str:
    """Remove DSN query parameters that asyncpg doesn't understand."""
    if "?" not in dsn:
        return dsn
    base, qs = dsn.split("?", 1)
    kept = [
        part for part in qs.split("&")
        if part.split("=")[0] not in _UNSUPPORTED_PARAMS
    ]
    return f"{base}?{'&'.join(kept)}" if kept else base


async def create_pool() -> None:
    """Create the global connection pool.  Called once on app startup.

    SSL is enabled automatically for non-localhost connections.
    Override by appending ?sslmode=disable to DATABASE_URL for local dev without SSL.
    """
    global _pool
    dsn = _sanitize_dsn(settings.DATABASE_URL)

    # Auto-detect SSL: enable for any non-localhost/127 host unless
    # the DSN already has an explicit sslmode parameter.
    ssl_needed = (
        "sslmode=" not in dsn
        and "localhost" not in dsn
        and "127.0.0.1" not in dsn
    )

    # max_size=20 is safe for Supabase's direct connection limit (~100 raw connections).
    # For 5,000 CCU in production, enable PgBouncer in Transaction mode (see architecture
    # docs) and raise this to 100 — PgBouncer multiplexes thousands of app connections
    # onto Postgres's limited raw connection pool.
    _pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=2,
        max_size=20,
        command_timeout=30,
        ssl="require" if ssl_needed else None,
    )


async def close_pool() -> None:
    """Close the global connection pool.  Called on app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the active pool.

    Raises:
        RuntimeError: If called before create_pool().
    """
    if _pool is None:
        raise RuntimeError(
            "Database pool is not initialised. "
            "Ensure create_pool() is called in the FastAPI lifespan."
        )
    return _pool
