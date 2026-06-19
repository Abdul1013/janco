"""
Janitor Service.

Orchestrates janitor-related operations: nearby search (using the
dispatch engine), profile retrieval, and availability toggling.
"""

from __future__ import annotations

from fastapi import HTTPException

from app.engines.dispatch_engine import JanitorCandidate, dispatch
from app.repositories import janitor_repo


async def get_nearby_janitors(
    lat: float,
    lng: float,
    service_type: str,
    customer_preferred_ids: set[str] | None = None,
) -> list[dict]:
    """Find and rank nearby available janitors.

    Fetches all available janitors from the DB, feeds them through the
    dispatch engine's filter → score → rank pipeline, and returns a
    ranked list.

    Args:
        lat: Customer / job latitude.
        lng: Customer / job longitude.
        service_type: Requested service type.
        customer_preferred_ids: IDs of janitors the customer prefers.

    Returns:
        List of ranked janitor dicts with score and distance.
    """
    raw_janitors = await janitor_repo.get_available(service_type)

    if not raw_janitors:
        return []

    # Collect only janitors that have location data (needed for dispatch scoring)
    located = [
        j for j in raw_janitors
        if (j.get("latitude") or j.get("lat")) is not None
        and (j.get("longitude") or j.get("lng")) is not None
    ]

    if not located:
        return []

    # Batch fetch recent job counts — ONE query instead of one per janitor
    janitor_ids = [str(j["id"]) for j in located]
    job_counts = await janitor_repo.get_recent_job_counts_batch(janitor_ids)

    # Convert DB rows to dispatch engine input format
    candidates = []
    for j in located:
        j_lat = j.get("latitude") or j.get("lat")
        j_lng = j.get("longitude") or j.get("lng")
        candidates.append(
            JanitorCandidate(
                id=j["id"],
                lat=float(j_lat),
                lng=float(j_lng),
                is_available=True,
                is_verified=True,
                avg_rating=float(j.get("avg_rating") or j.get("trust_score") or 0),
                service_types=j.get("service_types") or [],
                recent_jobs_7d=job_counts.get(str(j["id"]), 0),
            )
        )

    if not candidates:
        return []

    ranked = dispatch(
        candidates=candidates,
        job_lat=lat,
        job_lng=lng,
        requested_service=service_type,
        customer_preferred_ids=customer_preferred_ids,
    )

    # Merge dispatch scores back with DB profile data for the response
    janitor_map = {str(j["id"]): j for j in raw_janitors}
    results = []
    for scored in ranked:
        j_data = janitor_map.get(str(scored.janitor_id), {})
        results.append({
            "janitor_id": str(scored.janitor_id),
            "full_name": j_data.get("full_name"),
            "avatar_url": j_data.get("avatar_url"),
            "trust_score": j_data.get("trust_score"),
            "trust_tier": j_data.get("trust_tier"),
            "avg_rating": j_data.get("avg_rating"),
            "distance_km": scored.distance_km,
            "dispatch_score": scored.score,
            "sub_scores": scored.sub_scores,
        })

    return results


async def get_janitor_profile(janitor_id: str) -> dict:
    """Fetch a janitor's full public profile.

    Args:
        janitor_id: Primary key.

    Returns:
        Janitor dict with joined profile data.

    Raises:
        HTTPException 404 if not found.
    """
    janitor = await janitor_repo.get_by_id(janitor_id)
    if not janitor:
        raise HTTPException(status_code=404, detail="Janitor not found.")
    return janitor


async def register_janitor(user_id: str, data: dict) -> dict:
    """Register a user as a janitor (creates a pending janitor record).

    Also updates the user's profile role to 'janitor'.

    Args:
        user_id: Authenticated user's ID.
        data: Registration fields (phone, address, service_types, experience, bio).

    Returns:
        The created janitor record.
    """
    import uuid as _uuid
    from app.db.pool import get_pool

    # Check if already registered
    existing = await janitor_repo.get_by_id(user_id)
    if existing:
        raise HTTPException(status_code=409, detail="Already registered as a janitor.")

    import json as _json

    # Build metadata JSON for guarantor, bank details, and extra fields
    metadata = {}
    if data.get("guarantor"):
        metadata["guarantor"] = data["guarantor"]
    if data.get("bank_details"):
        metadata["bank_details"] = data["bank_details"]
    if data.get("state_of_origin"):
        metadata["state_of_origin"] = data["state_of_origin"]
    if data.get("lga"):
        metadata["lga"] = data["lga"]
    if "has_own_equipment" in data:
        metadata["has_own_equipment"] = data["has_own_equipment"]

    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO janitors
                (id, phone, address, service_types, experience, bio,
                 availability, is_verified, trust_score, trust_tier,
                 approval_status, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
               RETURNING *""",
            _uuid.UUID(user_id),
            data.get("phone", ""),
            data.get("address", ""),
            data.get("service_types", []),
            data.get("experience", ""),
            data.get("bio", ""),
            bool(data.get("is_available", False)),
            False,
            0.0,
            "Pending",
            "pending",
            _json.dumps(metadata),
        )
        if not row:
            raise HTTPException(status_code=500, detail="Failed to register janitor.")
        await conn.execute(
            "UPDATE profiles SET role = 'janitor' WHERE id = $1",
            _uuid.UUID(user_id),
        )

    return {"message": "Registration submitted. Pending admin approval.", "janitor": dict(row)}


async def update_availability(
    janitor_id: str,
    available: bool,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    """Toggle a janitor's availability and optionally update location.

    When a janitor goes online, they can pass their current GPS
    coordinates so the dispatch engine uses fresh location data.

    Args:
        janitor_id: Primary key.
        available: New status.
        lat: Optional current latitude.
        lng: Optional current longitude.

    Returns:
        Updated janitor dict.
    """
    # Update location if provided (typically when going online)
    if lat is not None and lng is not None:
        import uuid as _uuid
        from app.db.pool import get_pool
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE janitors SET latitude = $1, longitude = $2 WHERE id = $3",
                lat,
                lng,
                _uuid.UUID(janitor_id),
            )

    result = await janitor_repo.update_availability(janitor_id, available)
    if not result:
        raise HTTPException(status_code=404, detail="Janitor not found.")
    return result
