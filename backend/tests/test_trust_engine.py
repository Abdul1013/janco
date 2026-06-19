"""Unit tests for the trust engine."""

from app.engines.trust_engine import TrustTier, calculate_trust_score


class TestTrustScore:
    """Trust score calculation and tier mapping."""

    def test_perfect_janitor(self):
        """Verified, always on time, 5-star rating → Platinum."""
        result = calculate_trust_score(is_verified=True, punctuality_rate=1.0, avg_rating=5.0)
        assert result.score == 1.0
        assert result.tier == TrustTier.PLATINUM

    def test_unverified_janitor(self):
        """Unverified → identity component is 0.0 → likely Pending."""
        result = calculate_trust_score(is_verified=False, punctuality_rate=0.5, avg_rating=3.0)
        # 0.4*0 + 0.3*0.5 + 0.3*(3/5) = 0 + 0.15 + 0.18 = 0.33
        assert result.score == 0.33
        assert result.tier == TrustTier.PENDING

    def test_gold_tier_boundary(self):
        """Score of exactly 0.75 → Gold."""
        # 0.4*1 + 0.3*0.5 + 0.3*(2.5/5) = 0.4 + 0.15 + 0.15 = 0.70 → Silver
        # Try: 0.4*1 + 0.3*0.7 + 0.3*(3.5/5) = 0.4 + 0.21 + 0.21 = 0.82 → Gold
        result = calculate_trust_score(is_verified=True, punctuality_rate=0.7, avg_rating=3.5)
        assert result.tier == TrustTier.GOLD

    def test_silver_tier(self):
        """Mid-range verified janitor → Silver."""
        result = calculate_trust_score(is_verified=True, punctuality_rate=0.3, avg_rating=2.0)
        # 0.4 + 0.09 + 0.12 = 0.61
        assert result.tier == TrustTier.SILVER

    def test_platinum_threshold(self):
        """Score must be strictly > 0.9 for Platinum."""
        result = calculate_trust_score(is_verified=True, punctuality_rate=0.85, avg_rating=4.5)
        # 0.4 + 0.255 + 0.27 = 0.925 → Platinum
        assert result.tier == TrustTier.PLATINUM

    def test_clamping(self):
        """Out-of-range inputs should be clamped."""
        result = calculate_trust_score(is_verified=True, punctuality_rate=1.5, avg_rating=6.0)
        assert result.score == 1.0

    def test_all_zeros(self):
        """Completely new, unverified janitor with no history."""
        result = calculate_trust_score(is_verified=False, punctuality_rate=0.0, avg_rating=0.0)
        assert result.score == 0.0
        assert result.tier == TrustTier.PENDING
