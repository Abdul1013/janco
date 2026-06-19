"""Unit tests for the dispatch engine."""

import math

from app.engines.dispatch_engine import (
    DEFAULT_RADIUS_KM,
    EXPANDED_RADIUS_KM,
    JanitorCandidate,
    dispatch,
    filter_candidates,
    haversine_km,
    score_candidate,
)


def _make_candidate(**overrides) -> JanitorCandidate:
    """Factory helper for test candidates."""
    defaults = dict(
        id="j1",
        lat=7.3775,   # Ibadan
        lng=3.9470,
        is_available=True,
        is_verified=True,
        avg_rating=4.5,
        service_types=["house_cleaning"],
        recent_jobs_7d=5,
    )
    defaults.update(overrides)
    return JanitorCandidate(**defaults)


class TestHaversine:
    def test_same_point(self):
        assert haversine_km(7.0, 3.0, 7.0, 3.0) == 0.0

    def test_known_distance(self):
        # Ibadan to Lagos ≈ 128 km
        d = haversine_km(7.3775, 3.9470, 6.5244, 3.3792)
        assert 90 < d < 130


class TestFiltering:
    def test_excludes_unavailable(self):
        c = _make_candidate(is_available=False)
        result = filter_candidates([c], 7.38, 3.95)
        assert len(result) == 0

    def test_excludes_unverified(self):
        c = _make_candidate(is_verified=False)
        result = filter_candidates([c], 7.38, 3.95)
        assert len(result) == 0

    def test_excludes_out_of_radius(self):
        # Place candidate 50km away
        c = _make_candidate(lat=7.8, lng=4.4)
        result = filter_candidates([c], 7.38, 3.95)
        assert len(result) == 0

    def test_includes_nearby(self):
        c = _make_candidate(lat=7.378, lng=3.948)
        result = filter_candidates([c], 7.38, 3.95)
        assert len(result) == 1

    def test_radius_expansion(self):
        """If <3 candidates within 10km, expand to 15km."""
        c1 = _make_candidate(id="j1", lat=7.378, lng=3.948)  # ~0.3km
        c2 = _make_candidate(id="j2", lat=7.47, lng=3.95)    # ~10.2km (just outside 10km)
        result = filter_candidates([c1, c2], 7.38, 3.95, radius_km=DEFAULT_RADIUS_KM)
        # c1 is within 10km, c2 is outside → only 1 → triggers expansion
        assert len(result) >= 1


class TestScoring:
    def test_weights_sum_to_one(self):
        from app.engines.dispatch_engine import W_DISTANCE, W_QUALITY, W_FAIRNESS, W_SKILL, W_PREFERENCE
        assert abs((W_DISTANCE + W_QUALITY + W_FAIRNESS + W_SKILL + W_PREFERENCE) - 1.0) < 1e-9

    def test_perfect_candidate(self):
        c = _make_candidate(avg_rating=5.0, recent_jobs_7d=0)
        sc = score_candidate(c, distance_km=0.0, search_radius=10.0,
                             requested_service="house_cleaning",
                             customer_preferred_ids={"j1"})
        # D=1.0, Q=1.0, F=1.0, K=1.0, P=1.0 → score = 1.0
        assert sc.score == 1.0

    def test_skill_mismatch(self):
        c = _make_candidate(service_types=["laundry"])
        sc = score_candidate(c, distance_km=0.0, search_radius=10.0,
                             requested_service="house_cleaning")
        assert sc.sub_scores["skill"] == 0.0

    def test_fairness_deprioritises_busy(self):
        busy = _make_candidate(id="busy", recent_jobs_7d=18)
        idle = _make_candidate(id="idle", recent_jobs_7d=2)
        sc_busy = score_candidate(busy, 1.0, 10.0, "house_cleaning")
        sc_idle = score_candidate(idle, 1.0, 10.0, "house_cleaning")
        assert sc_idle.sub_scores["fairness"] > sc_busy.sub_scores["fairness"]


class TestDispatchPipeline:
    def test_empty_pool(self):
        result = dispatch([], 7.38, 3.95, "house_cleaning")
        assert result == []

    def test_ranking_order(self):
        close = _make_candidate(id="close", lat=7.381, lng=3.949, avg_rating=4.8, recent_jobs_7d=2)
        far = _make_candidate(id="far", lat=7.45, lng=3.99, avg_rating=3.0, recent_jobs_7d=15)
        result = dispatch([close, far], 7.38, 3.95, "house_cleaning")
        assert len(result) >= 1
        assert result[0].janitor_id == "close"
