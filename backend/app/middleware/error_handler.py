"""
Global Error Handler Middleware.

Catches all unhandled exceptions and returns a standardised JSON
error response so the frontend always receives a predictable shape:

    {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "Something went wrong.",
            "details": {}
        }
    }

Stack traces are logged server-side but NEVER sent to the client
(prevents information leakage in production).

Usage::

    from app.middleware.error_handler import register_error_handlers
    register_error_handlers(app)
"""

import logging
import traceback
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("janco")


def _error_response(status: int, code: str, message: str, details=None):
    """Build standardised error JSON response.

    Args:
        status: HTTP status code.
        code: Machine-readable error code (e.g. VALIDATION_ERROR).
        message: Human-readable explanation.
        details: Optional dict with extra context.

    Returns:
        JSONResponse with the error payload.
    """
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        },
    )


def register_error_handlers(app: FastAPI) -> None:
    """Attach global exception handlers to the FastAPI app.

    Args:
        app: The FastAPI application instance.
    """

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_req: Request, exc: HTTPException):
        return _error_response(
            status=exc.status_code,
            code="HTTP_ERROR",
            message=str(exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_req: Request, exc: RequestValidationError):
        return _error_response(
            status=422,
            code="VALIDATION_ERROR",
            message="Request validation failed.",
            details={"errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(req: Request, exc: Exception):
        # Log full traceback server-side
        logger.error(
            "Unhandled exception on %s %s:\n%s",
            req.method,
            req.url.path,
            traceback.format_exc(),
        )
        # Return safe response to client — no stack trace
        return _error_response(
            status=500,
            code="INTERNAL_ERROR",
            message="An unexpected error occurred. Please try again.",
        )
