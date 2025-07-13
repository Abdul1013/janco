from fastapi import APIRouter, HTTPException, Query
from typing import List
import math
from app.db.supabase_client import supabase   # ← import once

#  constants
MAX_DISTANCE_KM = 10
MAX_ACTIVE_JOBS = 5
EARTH_RADIUS_KM = 6371.0

#  helpers
def haversine_km(lat1, lon1, lat2, lon2) -> float:
    φ1, φ2 = map(math.radians, (lat1, lat2))
    Δφ, Δλ = φ2 - φ1, math.radians(lon2 - lon1)
    a = math.sin(Δφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(Δλ/2)**2
    return EARTH_RADIUS_KM * 2 * math.asin(math.sqrt(a))

def active_job_count(janitor_id: str) -> int:
    resp = (supabase.table("jobs")
            .select("id", count="exact")
            .eq("janitor_id", janitor_id)
            .in_("status", ["pending", "assigned"])
            .execute())
    return resp.count or 0

#router
router = APIRouter(prefix="/nearby-janitors", tags=["janitors"])

@router.get("/", summary="Find nearby available janitors")
def nearby_janitors(
    service: str  = Query(..., description="e.g. 'laundry'"),
    user_lat: float = Query(...),
    user_lng: float = Query(...),
    max_km: float   = Query(MAX_DISTANCE_KM)
):
    resp = (supabase.table("janitors")
            .select("*")
            .eq("available", True)
            .contains("services_offered", [service])
            .execute())

    if not resp.data:
        raise HTTPException(404, "No janitors available")

    candidates: List[dict] = []
    for jan in resp.data:
        j_lat, j_lng = jan.get("lat"), jan.get("lng")
        if j_lat is None or j_lng is None:
            continue
        dist = haversine_km(user_lat, user_lng, j_lat, j_lng)
        if dist > max_km or active_job_count(jan["id"]) >= MAX_ACTIVE_JOBS:
            continue
        jan["distance_km"] = round(dist, 2)
        candidates.append(jan)

    candidates.sort(key=lambda j: j["distance_km"])
    return {"count": len(candidates), "janitors": candidates}
