"""
Chat Routes — HTTP + WebSocket endpoints.

Replaces Supabase Realtime with a native FastAPI WebSocket endpoint.
The in-memory connection manager is sufficient for a single-process
deployment; upgrade to Redis pub/sub to scale horizontally.

Endpoints:
    WS   /v1/chat/ws/{job_id}?token=<access_token>  — live chat
    POST /v1/chat/{job_id}/messages                  — send (HTTP fallback)
    GET  /v1/chat/{job_id}/messages                  — fetch history
"""

from __future__ import annotations

import json
from typing import Dict, List

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.middleware.auth import get_current_user
from app.repositories import job_repo, message_repo
from app.schema.chat_schema import MessageCreate
from app.utils.security import decode_access_token

router = APIRouter(prefix="/chat", tags=["Chat"])


# ---------------------------------------------------------------------------
# WebSocket connection manager
# ---------------------------------------------------------------------------

class _ConnectionManager:
    """In-memory map of job_id → active WebSocket connections."""

    def __init__(self) -> None:
        self._connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, job_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(job_id, []).append(ws)

    def disconnect(self, job_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(job_id)
        if conns and ws in conns:
            conns.remove(ws)

    async def broadcast(self, job_id: str, message: dict) -> None:
        payload = json.dumps(message, default=str)
        for ws in list(self._connections.get(job_id, [])):
            try:
                await ws.send_text(payload)
            except Exception:
                self.disconnect(job_id, ws)


_manager = _ConnectionManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/{job_id}")
async def chat_websocket(
    job_id: str,
    ws: WebSocket,
    token: str = Query(..., description="Access token for authentication"),
):
    """Live chat WebSocket.

    Connect with ``?token=<access_token>``.

    Client → server: ``{"content": "Hello"}``
    Server → client: ``{"type": "message", "data": {...message row...}}``
    """
    # Authenticate via token query param (Authorization header unavailable in WS handshake)
    try:
        payload = decode_access_token(token)
        user_id: str = payload["sub"]
    except jwt.InvalidTokenError:
        await ws.close(code=4001)  # 4001 = Unauthorized
        return

    # Authorise — user must be job owner or assigned janitor
    job = await job_repo.get_job(job_id)
    if not job or (str(job["user_id"]) != str(user_id) and str(job.get("janitor_id") or "") != str(user_id)):
        await ws.close(code=4003)  # 4003 = Forbidden
        return

    await _manager.connect(job_id, ws)
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
            await _manager.broadcast(job_id, {"type": "message", "data": msg})
    except WebSocketDisconnect:
        _manager.disconnect(job_id, ws)


# ---------------------------------------------------------------------------
# HTTP endpoints (REST fallback + history)
# ---------------------------------------------------------------------------

async def _authorize_chat(user_id: str, job_id: str) -> dict:
    job = await job_repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if str(job["user_id"]) != str(user_id) and str(job.get("janitor_id") or "") != str(user_id):
        raise HTTPException(status_code=403, detail="Not authorised for this chat.")
    return job


@router.post("/{job_id}/messages")
async def send_message(
    job_id: str,
    payload: MessageCreate,
    user_id: str = Depends(get_current_user),
):
    """Send a message via HTTP.  Also broadcasts to any live WS connections."""
    await _authorize_chat(user_id, job_id)
    msg = await message_repo.create_message(job_id, user_id, payload.content)
    await _manager.broadcast(job_id, {"type": "message", "data": msg})
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
