"""
JWT Authentication Middleware.

Provides FastAPI dependencies that extract and validate the Bearer token
from the Authorization header.  Inject into any protected route::

    @router.get("/me")
    async def me(user_id: str = Depends(get_current_user)):
        ...

    @router.post("/admin")
    async def admin(ctx: dict = Depends(get_current_user_with_role)):
        assert ctx["role"] == "admin"

Tokens are issued by our own auth_service (HS256, PyJWT).
The jose library is no longer used.
"""

from __future__ import annotations

import jwt  # PyJWT
from fastapi import Depends, HTTPException, Request

from app.utils.security import decode_access_token


async def get_current_user(request: Request) -> str:
    """Extract and verify the JWT; return the user_id (sub claim).

    Raises:
        HTTPException 401 — missing header, expired token, invalid signature.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or malformed Authorization header.",
        )

    token = auth_header.split(" ", 1)[1]

    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing 'sub' claim.")

    return user_id


async def get_current_user_with_role(request: Request) -> dict:
    """Like get_current_user but also returns the role + admin_level claims.

    Returns:
        {"user_id": str, "role": str, "admin_level": str | None}
    """
    user_id = await get_current_user(request)
    token = request.headers["Authorization"].split(" ", 1)[1]
    payload = decode_access_token(token)
    return {
        "user_id": user_id,
        "role": payload.get("role", "customer"),
        "admin_level": payload.get("admin_level"),
    }
