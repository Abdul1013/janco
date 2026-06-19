"""
Chat Routes — HTTP + WebSocket endpoints.

WebSocket scaling strategy
--------------------------
Single process: in-memory _ConnectionManager broadcasts to all local sockets.
Multi-process : Redis pub/sub — every worker subscribes to chat:{job_id};
                a message published by any worker reaches all connected clients.

The Redis path is activated automatically when REDIS_URL is configured.
No code changes required when upgrading from single → multi-process.

Token security
--------------
Tokens are sent in the FIRST WebSocket message (not the URL).
URL query params are logged by every reverse proxy between client and
server — tokens in URLs are a well-known credential-leakage vector.

Auth handshake:
  Client → server: {"type": "auth", "token": "<access_token>"}
  Server: validates token, checks job ownership, enters message loop
  Server → client: {"type": "auth_ok"}  (confirmation)
  Server → client: {"type": "error", "detail": "..."} + close on failure

Endpoints:
    WS   /v1/chat/ws/{job_id}          — live chat (Redis-backed if available)
    POST /v1/chat/{job_id}/messages    — send (HTTP fallback)
    GET  /v1/chat/{job_id}/messages    — fetch history
"""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
from typing import Dict, List

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.db.redis import get_redis
from app.middleware.auth import get_current_user
from app.repositories import job_repo, message_repo
from app.schema.chat_schema import MessageCreate
from app.utils.security import decode_access_token

router = APIRouter(prefix="/chat", tags=["Chat"])

# How long to wait for the first auth message before closing the socket
_AUTH_TIMEOUT_SECONDS = 5


# ---------------------------------------------------------------------------
# In-memory fallback connection manager (single-process only)
# ---------------------------------------------------------------------------

class _ConnectionManager:
    """In-memory map of job_id → active WebSocket connections.

    Used when Redis is not available.  Correct for a single process;
    does NOT work across multiple workers.
    """

    def __init__(self) -> None:
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, job_id: str, ws: WebSocket) -> None:
        self._connections.setdefault(job_id, []).append(ws)

    def disconnect(self, job_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(job_id)
        if conns and ws in conns:
            conns.remove(ws)

    async def broadcast(self, job_id: str, payload: str) -> None:
        for ws in list(self._connections.get(job_id, [])):
            with suppress(Exception):
                await ws.send_text(payload)


_manager = _ConnectionManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/{job_id}")
async def chat_websocket(job_id: str, ws: WebSocket):
    """Live chat WebSocket.

    Authentication: Send {"type": "auth", "token": "<jwt>"} as the very
    first message.  The server responds with {"type": "auth_ok"} before
    entering the message loop.

    Sending a message: {"content": "Hello"}
    Receiving messages: {"type": "message", "data": {…message row…}}
    """
    await ws.accept()

    # ── Phase 1: First-message authentication ────────────────────────────
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=_AUTH_TIMEOUT_SECONDS)
        auth = json.loads(raw)
        if auth.get("type") != "auth" or not auth.get("token"):
            await ws.send_text(json.dumps({"type": "error", "detail": "Send auth message first."}))
            await ws.close(code=4001)
            return
        jwt_payload = decode_access_token(auth["token"])
        user_id: str = jwt_payload["sub"]
    except asyncio.TimeoutError:
        await ws.send_text(json.dumps({"type": "error", "detail": "Auth timeout."}))
        await ws.close(code=4001)
        return
    except (json.JSONDecodeError, jwt.InvalidTokenError, KeyError):
        await ws.send_text(json.dumps({"type": "error", "detail": "Invalid token."}))
        await ws.close(code=4001)
        return

    # ── Phase 2: Authorisation ────────────────────────────────────────────
    job = await job_repo.get_job(job_id)
    if not job or (
        str(job["user_id"]) != user_id
        and str(job.get("janitor_id") or "") != user_id
    ):
        await ws.send_text(json.dumps({"type": "error", "detail": "Not authorised for this chat."}))
        await ws.close(code=4003)
        return

    await ws.send_text(json.dumps({"type": "auth_ok"}))

    # ── Phase 3: Set up delivery path ────────────────────────────────────
    r = get_redis()
    channel = f"chat:{job_id}"
    listener_task: asyncio.Task | None = None

    if r is not None:
        # Redis mode: background task subscribes to channel and forwards
        # messages published by ANY worker to this local WebSocket.
        async def _redis_listener() -> None:
            pubsub = r.pubsub()
            await pubsub.subscribe(channel)
            try:
                async for msg in pubsub.listen():
                    if msg["type"] == "message":
                        with suppress(Exception):
                            await ws.send_text(msg["data"])
            except asyncio.CancelledError:
                pass
            finally:
                with suppress(Exception):
                    await pubsub.unsubscribe(channel)
                    await pubsub.aclose()

        listener_task = asyncio.create_task(_redis_listener())
    else:
        # In-memory fallback — only works within a single process
        await _manager.connect(job_id, ws)

    # ── Phase 4: Receive and broadcast loop ──────────────────────────────
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            content = (data.get("content") or "").strip()
            if not content:
                continue

            msg = await message_repo.create_message(job_id, user_id, content)
            payload = json.dumps({"type": "message", "data": msg}, default=str)

            if r is not None:
                # Publish to Redis → delivered to ALL workers' listeners
                with suppress(Exception):
                    await r.publish(channel, payload)
            else:
                # In-memory broadcast (single-process fallback)
                await _manager.broadcast(job_id, payload)

    except WebSocketDisconnect:
        pass
    finally:
        if listener_task is not None:
            listener_task.cancel()
            with suppress(asyncio.CancelledError):
                await listener_task
        if r is None:
            _manager.disconnect(job_id, ws)


# ---------------------------------------------------------------------------
# HTTP endpoints (REST fallback + history)
# ---------------------------------------------------------------------------

async def _authorize_chat(user_id: str, job_id: str) -> dict:
    job = await job_repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if (
        str(job["user_id"]) != user_id
        and str(job.get("janitor_id") or "") != user_id
    ):
        raise HTTPException(status_code=403, detail="Not authorised for this chat.")
    return job


@router.post("/{job_id}/messages")
async def send_message(
    job_id: str,
    payload: MessageCreate,
    user_id: str = Depends(get_current_user),
):
    """Send a message via HTTP.  Also broadcasts to any live WebSocket connections."""
    await _authorize_chat(user_id, job_id)
    msg = await message_repo.create_message(job_id, user_id, payload.content)

    broadcast_payload = json.dumps({"type": "message", "data": msg}, default=str)
    r = get_redis()
    if r is not None:
        with suppress(Exception):
            await r.publish(f"chat:{job_id}", broadcast_payload)
    else:
        await _manager.broadcast(job_id, broadcast_payload)

    return {"message": "Sent.", "data": msg}


@router.get("/{job_id}/messages")
async def get_messages(
    job_id: str,
    cursor: str | None = Query(None, description="ISO timestamp cursor"),
    limit: int = Query(50, ge=1, le=100),
    user_id: str = Depends(get_current_user),
):
    """Fetch paginated messages for a job's chat (newest first)."""
    await _authorize_chat(user_id, job_id)
    return await message_repo.get_messages(job_id, cursor, limit)
