"""
Structured Logging Middleware.

Assigns a unique ``request_id`` (UUID4) to every incoming HTTP request and
logs a structured JSON record on completion:
  {
    "request_id": "...",
    "method": "POST",
    "path": "/v1/bookings",
    "status_code": 200,
    "duration_ms": 42,
    "client_ip": "1.2.3.4"
  }

Uses the stdlib ``logging`` module with JSON formatting so log lines can be
ingested by any log aggregator (CloudWatch, Datadog, Loki, etc.) without
additional configuration.

Structlog integration: the ``request_id`` is bound to structlog's context
variables so every downstream log call within the same request automatically
includes it.  If structlog is not installed, the middleware still functions —
the request_id is just not propagated to sub-logs.

Usage (in main.py):
    from app.middleware.logging_middleware import RequestLoggingMiddleware
    app.add_middleware(RequestLoggingMiddleware)
"""

from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = logging.getLogger("janco.request")

# Attempt to bind structlog context — optional dependency
try:
    import structlog
    _HAS_STRUCTLOG = True
except ImportError:
    _HAS_STRUCTLOG = False


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs every request with request_id, method, path, status, and duration."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        start = time.perf_counter()

        # Make request_id available to other parts of the request context
        request.state.request_id = request_id

        # Bind to structlog context if available
        if _HAS_STRUCTLOG:
            structlog.contextvars.clear_contextvars()
            structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        client_ip = request.client.host if request.client else "unknown"

        record = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "client_ip": client_ip,
        }

        # Attach request_id header so clients / load balancers can correlate logs
        response.headers["X-Request-ID"] = request_id

        if response.status_code >= 500:
            log.error(json.dumps(record))
        elif response.status_code >= 400:
            log.warning(json.dumps(record))
        else:
            log.info(json.dumps(record))

        return response
