"""
JANCO Backend — FastAPI Application Entry Point.

Configures CORS, manages the asyncpg pool lifecycle via lifespan,
registers route modules, and exposes health-check endpoints.
All business logic lives in services/ and engines/.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db.migrations import run_migrations
from app.db.pool import close_pool, create_pool, get_pool
from app.middleware.error_handler import register_error_handlers
from app.middleware.rate_limiter import RateLimitMiddleware
from app.routes import (
    admin_routes,
    auth_routes,
    booking_routes,
    chat_routes,
    janitor_routes,
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
    await create_pool()
    await run_migrations()
    yield
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

_cors_origins = list(settings.CORS_ORIGINS)
# Ensure the admin panel and local dev tools can reach the API
for _o in [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5500",     # VS Code Live Server
    "http://127.0.0.1:5500",    # VS Code Live Server (IP form)
    "null",                      # file:// origin
]:
    if _o not in _cors_origins:
        _cors_origins.append(_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(RateLimitMiddleware)

register_error_handlers(app)

app.include_router(admin_routes.router, prefix="/v1")
app.include_router(auth_routes.router, prefix="/v1")
app.include_router(booking_routes.router, prefix="/v1")
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


@app.get("/test-connection", tags=["Health"])
async def test_connection():
    """Verify database connectivity by reading one profile row."""
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch("SELECT id FROM profiles LIMIT 1")
        return {"status": "ok", "rows_found": len(rows)}
    except Exception as e:
        return {"status": "error", "message": str(e)}
