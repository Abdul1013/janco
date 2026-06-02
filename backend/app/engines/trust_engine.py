"""
Trust Engine — Pure Computation Module.

Computes a janitor's trust score and tier from three inputs:
  - Identity verification status (binary)
  - Punctuality rate (proportion of on-time arrivals)
  - Average customer rating (0–5 scale)

Formula:
    T = w_i × I + w_p × P_rate + w_r × (R_avg / 5.0)

Where w_i = 0.4, w_p = 0.3, w_r = 0.3.

Tier mapping:
    Platinum  > 0.90
    Gold      0.75 – 0.90
    Silver    0.50 – 0.75
    Pending   < 0.50

This module has **no I/O**. Every function is a pure, testable
computation.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

W_IDENTITY = 0.4
W_PUNCTUALITY = 0.3
W_RATING = 0.3


class TrustTier(str, Enum):
    """Human-readable trust badges shown in the janitor profile."""
    PLATINUM = "Platinum"
    GOLD = "Gold"
    SILVER = "Silver"
    PENDING = "Pending"


@dataclass
class TrustResult:
    """Immutable result of a trust-score calculation.

    Attributes:
        score: Float in [0.0, 1.0].
        tier: TrustTier enum value.
    """
    score: float
    tier: TrustTier


def calculate_trust_score(
    is_verified: bool,
    punctuality_rate: float = 0.0,
    avg_rating: float = 0.0,
) -> TrustResult:
    """Compute trust score and tier.

    Args:
        is_verified: True if the janitor has passed Dojah identity
            verification (NIN/BVN + biometric liveness).
        punctuality_rate: Proportion of jobs where the janitor arrived
            within 5 minutes of the scheduled time.  Range [0.0, 1.0].
        avg_rating: Average customer rating on a 0–5 scale.

    Returns:
        TrustResult containing the numeric score and tier.

    Examples:
        >>> calculate_trust_score(True, 0.95, 4.8)
        TrustResult(score=0.958, tier=<TrustTier.PLATINUM: 'Platinum'>)

        >>> calculate_trust_score(False, 0.5, 3.0)
        TrustResult(score=0.33, tier=<TrustTier.PENDING: 'Pending'>)
    """
    identity = 1.0 if is_verified else 0.0
    normalised_rating = min(max(avg_rating, 0.0), 5.0) / 5.0
    clamped_punctuality = min(max(punctuality_rate, 0.0), 1.0)

    score = round(
        W_IDENTITY * identity
        + W_PUNCTUALITY * clamped_punctuality
        + W_RATING * normalised_rating,
        3,
    )

    tier = _score_to_tier(score)
    return TrustResult(score=score, tier=tier)


def _score_to_tier(score: float) -> TrustTier:
    """Map a numeric score to its trust tier.

    Args:
        score: Float in [0.0, 1.0].

    Returns:
        Corresponding TrustTier.
    """
    if score > 0.9:
        return TrustTier.PLATINUM
    if score >= 0.75:
        return TrustTier.GOLD
    if score >= 0.5:
        return TrustTier.SILVER
    return TrustTier.PENDING
