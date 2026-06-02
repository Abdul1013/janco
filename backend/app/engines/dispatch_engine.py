"""
Dispatch Engine — Multi-Objective Worker Assignment.

Matches a new job to the best available janitor using a weighted
composite score across five dimensions:

    S = 0.30·D + 0.35·Q + 0.20·F + 0.10·K + 0.05·P

Where:
    D = distance score (inverse-normalised Haversine)
    Q = quality score (avg_rating / 5.0)
    F = fairness score (1 − recent_jobs / max_workload)
    K = skill match (binary)
    P = customer preference (binary — prior ≥ 4-star rating)

The engine operates in three stages:
    1. Filter — remove unavailable / unverified / out-of-radius janitors.
    2. Score  — compute composite score for each candidate.
    3. Rank   — sort descending; offer to top candidate first.

Radius expansion: if fewer than 3 candidates found within the default
10 km radius, automatically expand to 15 km.

This module has **no I/O**.
"""

from __future__ import annotations

import math
from dataclasses import dataclass



# Weights — sum to 1.0

W_DISTANCE = 0.30
W_QUALITY = 0.35
W_FAIRNESS = 0.20
W_SKILL = 0.10
W_PREFERENCE = 0.05

DEFAULT_RADIUS_KM = 10.0
EXPANDED_RADIUS_KM = 15.0
MIN_CANDIDATES_BEFORE_EXPAND = 3
DEFAULT_MAX_WORKLOAD = 20  # jobs per 7-day window



# Data containers


@dataclass
class JanitorCandidate:
    """Lightweight janitor representation for dispatch scoring.

    Attributes:
        id: Unique janitor ID.
        lat: Current latitude.
        lng: Current longitude.
        is_available: Whether the janitor is currently online.
        is_verified: Identity verification status.
        avg_rating: Average customer rating (0–5).
        service_types: List of service types the janitor offers.
        recent_jobs_7d: Number of jobs completed in the last 7 days.
    """
    id: str
    lat: float
    lng: float
    is_available: bool
    is_verified: bool
    avg_rating: float
    service_types: list[str]
    recent_jobs_7d: int


@dataclass
class ScoredCandidate:
    """A janitor candidate with their computed composite score.

    Attributes:
        janitor_id: Unique janitor ID.
        score: Composite score in [0.0, 1.0].
        distance_km: Distance to job in kilometres.
        sub_scores: Breakdown of individual score components.
    """
    janitor_id: str
    score: float
    distance_km: float
    sub_scores: dict[str, float]
# Haversine distance
def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute great-circle distance between two coordinates.

    Args:
        lat1, lng1: First point (decimal degrees).
        lat2, lng2: Second point (decimal degrees).

    Returns:
        Distance in kilometres.
    """
    R = 6_371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
# Stage 1 — Candidate filtering
def filter_candidates(
    candidates: list[JanitorCandidate],
    job_lat: float,
    job_lng: float,
    radius_km: float = DEFAULT_RADIUS_KM,
) -> list[tuple[JanitorCandidate, float]]:
    """Filter janitors by availability, verification, and proximity.

    A janitor must satisfy three conditions:
      1. Currently available (is_available = True).
      2. Identity verified (is_verified = True).
      3. Within radius_km of the job location.

    If fewer than MIN_CANDIDATES_BEFORE_EXPAND pass within the default
    radius, the search expands to EXPANDED_RADIUS_KM.

    Args:
        candidates: Full pool of janitors.
        job_lat: Job latitude.
        job_lng: Job longitude.
        radius_km: Initial search radius.

    Returns:
        List of (candidate, distance_km) tuples for eligible janitors.
    """
    def _filter(r: float):
        result = []
        for c in candidates:
            if not c.is_available or not c.is_verified:
                continue
            d = haversine_km(c.lat, c.lng, job_lat, job_lng)
            if d <= r:
                result.append((c, d))
        return result

    eligible = _filter(radius_km)

    # Expand radius if insufficient candidates
    if len(eligible) < MIN_CANDIDATES_BEFORE_EXPAND and radius_km < EXPANDED_RADIUS_KM:
        eligible = _filter(EXPANDED_RADIUS_KM)

    return eligible
# Stage 2 — Scoring
def score_candidate(
    candidate: JanitorCandidate,
    distance_km: float,
    search_radius: float,
    requested_service: str,
    customer_preferred_ids: set[str] | None = None,
    max_workload: int = DEFAULT_MAX_WORKLOAD,
) -> ScoredCandidate:
    """Compute composite score for a single candidate.

    Args:
        candidate: The janitor to score.
        distance_km: Pre-computed distance to job.
        search_radius: Current search radius (for normalisation).
        requested_service: Service type the customer requested.
        customer_preferred_ids: Set of janitor IDs the customer has
            previously rated ≥ 4 stars.
        max_workload: Max jobs in a 7-day window for fairness calc.

    Returns:
        ScoredCandidate with composite score and breakdown.
    """
    customer_preferred_ids = customer_preferred_ids or set()

    # D — distance (closer = higher)
    d_score = max(0.0, 1.0 - (distance_km / search_radius)) if search_radius > 0 else 0.0

    # Q — quality
    q_score = candidate.avg_rating / 5.0

    # F — fairness (less busy = higher)
    f_score = max(0.0, 1.0 - (candidate.recent_jobs_7d / max_workload))

    # K — skill match (binary)
    k_score = 1.0 if requested_service in candidate.service_types else 0.0

    # P — customer preference (binary)
    p_score = 1.0 if candidate.id in customer_preferred_ids else 0.0

    composite = (
        W_DISTANCE * d_score
        + W_QUALITY * q_score
        + W_FAIRNESS * f_score
        + W_SKILL * k_score
        + W_PREFERENCE * p_score
    )

    return ScoredCandidate(
        janitor_id=candidate.id,
        score=round(composite, 4),
        distance_km=round(distance_km, 2),
        sub_scores={
            "distance": round(d_score, 3),
            "quality": round(q_score, 3),
            "fairness": round(f_score, 3),
            "skill": k_score,
            "preference": p_score,
        },
    )
# Stage 3 — Ranking
def rank_candidates(scored: list[ScoredCandidate]) -> list[ScoredCandidate]:
    """Sort candidates by composite score (descending).

    Args:
        scored: List of scored candidates.

    Returns:
        Sorted list (best first).
    """
    return sorted(scored, key=lambda c: c.score, reverse=True)

# Convenience — full pipeline
def dispatch(
    candidates: list[JanitorCandidate],
    job_lat: float,
    job_lng: float,
    requested_service: str,
    customer_preferred_ids: set[str] | None = None,
    max_workload: int = DEFAULT_MAX_WORKLOAD,
) -> list[ScoredCandidate]:
    """Run the full dispatch pipeline: filter → score → rank.

    Args:
        candidates: Full janitor pool.
        job_lat: Job latitude.
        job_lng: Job longitude.
        requested_service: Requested service type.
        customer_preferred_ids: IDs of janitors the customer prefers.
        max_workload: Max weekly jobs for fairness calculation.

    Returns:
        Ranked list of ScoredCandidate (best first). Empty if no
        eligible janitors found.
    """
    eligible = filter_candidates(candidates, job_lat, job_lng)
    if not eligible:
        return []

    # Determine effective radius for normalisation
    max_dist = max(d for _, d in eligible)
    radius = max(max_dist, DEFAULT_RADIUS_KM)

    scored = [
        score_candidate(c, d, radius, requested_service, customer_preferred_ids, max_workload)
        for c, d in eligible
    ]
    return rank_candidates(scored)
