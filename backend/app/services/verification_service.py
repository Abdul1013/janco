"""
Verification Service.

Manages janitor identity verification via Dojah API integration.
Three-step flow:
  1. NIN/BVN lookup — validate the ID number
  2. Liveness detection — compare selfie to NIN/BVN photo
  3. Result storage — save ``dojah_ref``, ``status``, ``verified_at``

**Security:** Raw NIN/BVN numbers are NEVER stored in the database.
Only the Dojah reference ID and verification status are persisted.

For beta/development, a mock mode is available that simulates
the Dojah API responses.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException

from app.db.pool import get_pool
from app.engines.trust_engine import calculate_trust_score
from app.repositories import janitor_repo

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DOJAH_APP_ID = os.getenv("DOJAH_APP_ID", "")
DOJAH_SECRET = os.getenv("DOJAH_SECRET", "")
DOJAH_BASE_URL = os.getenv("DOJAH_BASE_URL", "https://sandbox.dojah.io")
USE_MOCK = os.getenv("DOJAH_MOCK", "true").lower() == "true"

MAX_RETRIES = 3


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def initiate_verification(
    janitor_id: str,
    id_type: str,
    id_number: str,
) -> dict[str, Any]:
    """Step 1: Submit NIN or BVN for lookup.

    Args:
        janitor_id: The janitor's user ID.
        id_type: Either ``"nin"`` or ``"bvn"``.
        id_number: The government-issued ID number.

    Returns:
        Dict with ``dojah_ref``, ``status``, and ``message``.

    Raises:
        HTTPException 400: If id_type is invalid or max retries exceeded.
        HTTPException 502: If Dojah API call fails.
    """
    if id_type not in ("nin", "bvn"):
        raise HTTPException(status_code=400, detail="id_type must be 'nin' or 'bvn'.")

    # Check retry count
    existing = await _get_verification_record(janitor_id)
    if existing and existing.get("retry_count", 0) >= MAX_RETRIES:
        raise HTTPException(
            status_code=400,
            detail="Maximum verification attempts exceeded. Please contact support.",
        )

    # Call Dojah (or mock)
    if USE_MOCK:
        dojah_ref = f"mock_{id_type}_{janitor_id[:8]}"
        lookup_result = {"match": True, "ref": dojah_ref}
    else:
        lookup_result = await _dojah_id_lookup(id_type, id_number)

    if not lookup_result.get("match"):
        # Increment retry count
        retry_count = (existing.get("retry_count", 0) if existing else 0) + 1
        await _upsert_verification_record(janitor_id, {
            "status": "id_failed",
            "retry_count": retry_count,
        })
        raise HTTPException(status_code=400, detail="ID verification failed. Please check your details.")

    # Store pending verification with dojah ref
    await _upsert_verification_record(janitor_id, {
        "dojah_ref": lookup_result["ref"],
        "id_type": id_type,
        "status": "id_verified",
        "retry_count": existing.get("retry_count", 0) if existing else 0,
    })

    return {
        "dojah_ref": lookup_result["ref"],
        "status": "id_verified",
        "message": "ID verified. Proceed to liveness check.",
    }


async def submit_liveness(
    janitor_id: str,
    image_base64: str,
) -> dict[str, Any]:
    """Step 2: Submit selfie for liveness detection.

    Args:
        janitor_id: The janitor's user ID.
        image_base64: Base64-encoded selfie image.

    Returns:
        Dict with ``status`` and ``message``.

    Raises:
        HTTPException 400: If Step 1 not completed or liveness fails.
        HTTPException 502: If Dojah API call fails.
    """
    record = await _get_verification_record(janitor_id)
    if not record or record.get("status") != "id_verified":
        raise HTTPException(
            status_code=400,
            detail="Complete ID verification (Step 1) first.",
        )

    # Call Dojah liveness (or mock)
    if USE_MOCK:
        liveness_pass = True
    else:
        liveness_pass = await _dojah_liveness_check(
            record["dojah_ref"], image_base64
        )

    if not liveness_pass:
        retry_count = record.get("retry_count", 0) + 1
        await _upsert_verification_record(janitor_id, {
            "status": "liveness_failed",
            "retry_count": retry_count,
        })
        raise HTTPException(status_code=400, detail="Liveness check failed. Please try again.")

    # Mark fully verified
    now = datetime.now(timezone.utc).isoformat()
    await _upsert_verification_record(janitor_id, {
        "status": "verified",
        "verified_at": now,
    })

    # Update janitor record
    import uuid as _uuid
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE janitors SET is_verified = TRUE, verified_at = $1 WHERE id = $2",
            datetime.fromisoformat(now),
            _uuid.UUID(janitor_id),
        )

    # Recalculate trust score
    janitor = await janitor_repo.get_by_id(janitor_id)
    if janitor:
        trust = calculate_trust_score(
            is_verified=True,
            punctuality_rate=janitor.get("punctuality_rate", 0.0),
            avg_rating=janitor.get("avg_rating", 0.0),
        )
        await janitor_repo.update_trust_score(janitor_id, trust.score, trust.tier.value)

    return {
        "status": "verified",
        "message": "Verification complete! Your profile now shows a verified badge.",
    }


async def get_verification_status(janitor_id: str) -> dict[str, Any]:
    """Step 3: Check current verification status.

    Args:
        janitor_id: The janitor's user ID.

    Returns:
        Dict with ``status``, ``dojah_ref``, ``verified_at``, ``retries_left``.
    """
    record = await _get_verification_record(janitor_id)
    if not record:
        return {
            "status": "not_started",
            "dojah_ref": None,
            "verified_at": None,
            "retries_left": MAX_RETRIES,
        }

    return {
        "status": record.get("status", "not_started"),
        "dojah_ref": record.get("dojah_ref"),
        "verified_at": record.get("verified_at"),
        "retries_left": MAX_RETRIES - record.get("retry_count", 0),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_verification_record(janitor_id: str) -> dict | None:
    """Fetch the verification record for a janitor."""
    import uuid as _uuid
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM verifications WHERE janitor_id = $1",
            _uuid.UUID(janitor_id),
        )
    return dict(row) if row else None


async def _upsert_verification_record(janitor_id: str, data: dict) -> None:
    """Create or update the verification record (upsert on janitor_id)."""
    import uuid as _uuid
    pool = get_pool()
    upsert_data = {"janitor_id": janitor_id, **data}
    cols = list(upsert_data.keys())
    vals: list = []
    for k, v in upsert_data.items():
        vals.append(_uuid.UUID(v) if k == "janitor_id" and isinstance(v, str) else v)
    placeholders = ", ".join(f"${i + 1}" for i in range(len(vals)))
    update_set = ", ".join(
        f"{k} = EXCLUDED.{k}" for k in cols if k != "janitor_id"
    )
    async with pool.acquire() as conn:
        await conn.execute(
            f"""
            INSERT INTO verifications ({', '.join(cols)}) VALUES ({placeholders})
            ON CONFLICT (janitor_id) DO UPDATE SET {update_set}
            """,
            *vals,
        )


async def _dojah_id_lookup(id_type: str, id_number: str) -> dict:
    """Call Dojah NIN/BVN lookup API.

    Returns:
        Dict with ``match`` (bool) and ``ref`` (string).
    """
    # Prefer POST JSON requests per Dojah docs, but fall back to GET if necessary.
    from httpx import AsyncClient

    path = f"/api/v1/kyc/{id_type}"
    json_payload = {id_type: id_number}

    try:
        body = await _dojah_request("POST", path, json=json_payload)
    except HTTPException:
        # Try the older GET-style call as a fallback
        body = await _dojah_request("GET", path, params=json_payload)

    entity = body.get("entity", {}) if isinstance(body, dict) else {}
    return {
        "match": entity.get(id_type) is not None,
        "ref": entity.get("reference_id", ""),
    }


async def _dojah_liveness_check(dojah_ref: str, image_base64: str) -> bool:
    """Call Dojah liveness/face-match API.

    Returns:
        True if the liveness check passes.
    """
    path = "/api/v1/kyc/liveness"
    payload = {"reference_id": dojah_ref, "image": image_base64}

    try:
        body = await _dojah_request("POST", path, json=payload)
        entity = body.get("entity", {}) if isinstance(body, dict) else {}
        # Support multiple possible response shapes
        liveness = entity.get("liveness") or entity.get("face") or {}
        return bool(liveness.get("match") or liveness.get("confidence", 0) >= 0.8)
    except HTTPException:
        return False


async def _dojah_request(method: str, path: str, json: dict | None = None, params: dict | None = None) -> dict:
    """Generic Dojah request helper.

    Tries the configured Dojah base URL with the provided method and
    returns parsed JSON. Raises HTTPException(502) on network/error.
    """
    import httpx

    if path.startswith("http"):
        url = path
    else:
        url = DOJAH_BASE_URL.rstrip("/") + (path if path.startswith("/") else f"/{path}")

    headers = {
        "AppId": DOJAH_APP_ID,
        "Authorization": DOJAH_SECRET,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            if method.upper() == "POST":
                resp = await client.post(url, headers=headers, json=json)
            else:
                resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Dojah API error: {str(e)}")


async def _get_verification_record_by_ref(dojah_ref: str) -> dict | None:
    """Fetch verification record by Dojah reference ID."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM verifications WHERE dojah_ref = $1",
            dojah_ref,
        )
    return dict(row) if row else None


async def handle_dojah_webhook(payload: dict) -> None:
    """Handle incoming Dojah webhook/callback payload.

    The provider may send different shapes; this handler attempts to
    be tolerant: it extracts a reference ID, status, and verified_at
    when available and updates the local verification record and
    janitor row accordingly.
    """
    # Try common payload shapes
    reference = None
    if not isinstance(payload, dict):
        return

    # Common top-level fields
    reference = payload.get("reference_id") or payload.get("reference")

    # Nested entity
    if not reference:
        entity = payload.get("entity") or {}
        reference = entity.get("reference_id") or entity.get("dojah_reference")

    if not reference:
        return

    # Determine verified status
    verified = False
    verified_at = None
    # Check common status fields
    status_field = payload.get("status") or (payload.get("entity") or {}).get("status")
    if isinstance(status_field, str) and status_field.lower() in ("verified", "success", "completed"):
        verified = True

    # Check liveness/face match nested
    entity = payload.get("entity") or {}
    liveness = entity.get("liveness") or entity.get("face") or {}
    if isinstance(liveness, dict) and (liveness.get("match") or liveness.get("confidence", 0) >= 0.8):
        verified = True
        if liveness.get("verified_at"):
            verified_at = liveness.get("verified_at")

    # Fallback for explicit verified_at
    if not verified_at:
        verified_at = payload.get("verified_at") or entity.get("verified_at")

    # Update verification record
    record = await _get_verification_record_by_ref(reference)
    if not record:
        return

    janitor_id = record.get("janitor_id")
    update_data = {"status": "verified" if verified else "failed"}
    if verified_at:
        update_data["verified_at"] = verified_at

    await _upsert_verification_record(janitor_id, {**update_data, "dojah_ref": reference})

    # If verified, mark janitor and recalc trust
    if verified and janitor_id:
        import uuid as _uuid
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE janitors SET is_verified = TRUE, verified_at = $1 WHERE id = $2",
                datetime.fromisoformat(verified_at) if verified_at else datetime.now(timezone.utc),
                _uuid.UUID(janitor_id),
            )

        janitor = await janitor_repo.get_by_id(janitor_id)
        if janitor:
            trust = calculate_trust_score(
                is_verified=True,
                punctuality_rate=janitor.get("punctuality_rate", 0.0),
                avg_rating=janitor.get("avg_rating", 0.0),
            )
            await janitor_repo.update_trust_score(janitor_id, trust.score, trust.tier.value)
