"""
JANCO Backend — FastAPI Application Entry Point.

Configures CORS, manages the asyncpg pool lifecycle via lifespan,
registers route modules, and exposes health-check endpoints.
All business logic lives in services/ and engines/.
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.migrations import run_migrations
from app.db.pool import close_pool, create_pool, get_pool
from app.db.redis import close_redis, create_redis, get_redis
from app.middleware.error_handler import register_error_handlers
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.middleware.rate_limiter import RateLimitMiddleware

# ── Structured logging setup ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",  # Emit the JSON dict directly
)

# ── Sentry (optional — no-op when SENTRY_DSN is empty) ───────────────────────
if settings.SENTRY_DSN:
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=0.05,   # 5 % of requests traced
            environment=settings.APP_ENV,
        )
        logging.getLogger(__name__).info("Sentry initialised (env=%s)", settings.APP_ENV)
    except ImportError:
        logging.getLogger(__name__).warning(
            "SENTRY_DSN set but sentry-sdk not installed — run: pip install sentry-sdk[fastapi]"
        )

from app.routes import (
    admin_routes,
    auth_routes,
    booking_routes,
    chat_routes,
    janitor_routes,
    legal_routes,
    payment_routes,
    pricing_routes,
    rating_routes,
    room_scan_routes,
    verification_routes,
)


#
# Lifespan — pool is created once on startup, closed on shutdown
#

@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    from app.services import reminder_service

    await create_pool()
    await run_migrations()
    await create_redis()   # Optional — no-op if REDIS_URL is unset

    # Background reminder loop (24h / same-day booking reminders)
    reminder_task = None
    if settings.REMINDERS_ENABLED:
        reminder_task = asyncio.create_task(reminder_service.run_loop())

    yield

    if reminder_task:
        reminder_task.cancel()
        try:
            await reminder_task
        except asyncio.CancelledError:
            pass
    await close_redis()
    await close_pool()


#
# App
#

app = FastAPI(
    title="JANCO Backend",
    version="2.0.0",
    description="API for JANCO on-demand janitorial platform",
    lifespan=lifespan,
)

# CORS: base origins come from config (set CORS_ORIGINS env var in production).
# In development, also allow common local dev server addresses.
# "null" (file:// origin) and VS Code Live Server are explicitly excluded —
# they are never needed in production and are a security risk.
_cors_origins = list(settings.CORS_ORIGINS)
if settings.APP_ENV == "development":
    for _o in [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",     # Next.js admin dashboard (dev only)
        "http://127.0.0.1:3000",    # Next.js admin dashboard (IP form, dev only)
        "http://localhost:5500",     # VS Code Live Server (dev only)
        "http://127.0.0.1:5500",    # VS Code Live Server (IP form, dev only)
    ]:
        if _o not in _cors_origins:
            _cors_origins.append(_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)


@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    """Inject security headers into every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

register_error_handlers(app)

app.include_router(admin_routes.router, prefix="/v1")
app.include_router(auth_routes.router, prefix="/v1")
app.include_router(legal_routes.router, prefix="/v1")
app.include_router(booking_routes.router, prefix="/v1")
app.include_router(payment_routes.router, prefix="/v1")
app.include_router(pricing_routes.router, prefix="/v1")
app.include_router(janitor_routes.router, prefix="/v1")
app.include_router(chat_routes.router, prefix="/v1")
app.include_router(rating_routes.router, prefix="/v1")
app.include_router(room_scan_routes.router, prefix="/v1")
app.include_router(verification_routes.router, prefix="/v1")


#
# Admin web panel — served at /admin
#
_admin_dir = Path(__file__).resolve().parent.parent / "admin"
if _admin_dir.exists():
    @app.get("/admin", include_in_schema=False)
    async def admin_panel():
        """Serve the admin SPA entry point."""
        return FileResponse(str(_admin_dir / "index.html"))

    app.mount("/admin-static", StaticFiles(directory=str(_admin_dir)), name="admin-static")


#
# Health checks
#

@app.get("/", tags=["Health"])
def root():
    """Returns 200 when the server is running."""
    return {"status": "ok", "message": "JANCO backend running"}


@app.get("/health", tags=["Health"])
def health():
    """Liveness probe — returns 200 if the process is alive."""
    return {"status": "ok"}


@app.get("/ready", tags=["Health"])
async def ready():
    """Readiness probe — verifies DB and Redis connectivity.

    Returns 200 only when both the database pool and (if configured) Redis
    are reachable.  Load balancers / orchestrators use this to decide
    whether to route traffic to this instance.
    """
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
    except Exception as exc:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "error", "component": "database", "detail": str(exc)},
        )

    r = get_redis()
    if r is not None:
        try:
            await r.ping()
        except Exception as exc:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=503,
                content={"status": "error", "component": "redis", "detail": str(exc)},
            )

    return {"status": "ready"}
