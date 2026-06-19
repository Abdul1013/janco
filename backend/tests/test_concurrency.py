"""
Concurrency, race condition, and double-booking tests.

Tests in this file verify that all architectural fixes from the scale-up
review actually prevent the failure modes they were designed to stop.

All tests run without a live database — asyncpg is mocked at the pool
level so the tests cover application logic and SQL structure, not DB
connectivity.

Run:
    venv/bin/python -m pytest tests/test_concurrency.py -v
"""

from __future__ import annotations

import asyncio
import hashlib
import time
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def _make_token_row(
    *,
    token_hash: str,
    family_id: str | None = None,
    revoked: bool = False,
    expired: bool = False,
) -> dict:
    """Build a fake refresh_tokens row."""
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    return {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "token_hash": token_hash,
        "family_id": uuid.UUID(family_id) if family_id else uuid.uuid4(),
        "revoked_at": now if revoked else None,
        "expires_at": now - timedelta(hours=1) if expired else now + timedelta(days=7),
    }


@asynccontextmanager
async def _mock_pool(fetchrow_side_effect=None, fetchrow_return=None):
    """Context manager that patches get_pool() with a fully mocked asyncpg pool."""
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        side_effect=fetchrow_side_effect,
        return_value=fetchrow_return,
    )
    conn.fetchval = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value=None)

    # Async context manager for conn.transaction()
    tx = AsyncMock()
    tx.__aenter__ = AsyncMock(return_value=tx)
    tx.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx)

    # Async context manager for pool.acquire()
    pool = MagicMock()
    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acquire_ctx)

    with patch("app.repositories.token_repo.get_pool", return_value=pool):
        with patch("app.repositories.job_repo.get_pool", return_value=pool):
            yield conn


# ─────────────────────────────────────────────────────────────────────────────
# 1. Refresh-token security
# ─────────────────────────────────────────────────────────────────────────────

class TestRefreshTokenSecurity:
    """
    Verifies that consume_refresh_token:
    a) uses a transaction (FOR UPDATE serialises concurrent requests)
    b) correctly detects already-revoked tokens (replay / reuse attack)
    c) returns None for expired tokens
    d) returns the row and revokes it for valid tokens
    """

    @pytest.mark.asyncio
    async def test_valid_token_returns_row_and_revokes(self):
        """Happy path: valid token → row returned, revoke executed."""
        raw = "my-raw-refresh-token-abc123"
        tok_hash = _sha256(raw)
        row = _make_token_row(token_hash=tok_hash)

        async with _mock_pool(fetchrow_return=row) as conn:
            from app.repositories.token_repo import consume_refresh_token
            result = await consume_refresh_token(raw)

        assert result is not None
        assert result["token_hash"] == tok_hash
        # revoke execute must have been called
        conn.execute.assert_called_once()
        revoke_sql = conn.execute.call_args[0][0]
        assert "revoked_at" in revoke_sql.lower()

    @pytest.mark.asyncio
    async def test_expired_token_returns_none(self):
        """Expired token (not found by query) → None."""
        raw = "expired-token"
        # fetchrow returns None (expires_at filter excludes the row)
        async with _mock_pool(fetchrow_return=None) as conn:
            from app.repositories.token_repo import consume_refresh_token
            result = await consume_refresh_token(raw)

        assert result is None
        conn.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_revoked_token_triggers_family_revocation(self):
        """Presenting an already-revoked token → reuse attack → family revoked."""
        raw = "reused-token"
        tok_hash = _sha256(raw)
        fid = str(uuid.uuid4())
        row = _make_token_row(token_hash=tok_hash, family_id=fid, revoked=True)

        async with _mock_pool(fetchrow_return=row) as conn:
            from app.repositories.token_repo import consume_refresh_token
            result = await consume_refresh_token(raw)

        assert result is None
        # Family revocation must have fired
        conn.execute.assert_called_once()
        sql, fam_id_arg = conn.execute.call_args[0]
        assert "family_id" in sql
        assert fam_id_arg == row["family_id"]

    @pytest.mark.asyncio
    async def test_transaction_is_used(self):
        """consume_refresh_token must open a transaction (FOR UPDATE semantics)."""
        raw = "token-for-tx-check"
        tok_hash = _sha256(raw)
        row = _make_token_row(token_hash=tok_hash)

        async with _mock_pool(fetchrow_return=row) as conn:
            from app.repositories.token_repo import consume_refresh_token
            await consume_refresh_token(raw)

        # conn.transaction() must have been called
        conn.transaction.assert_called_once()

    @pytest.mark.asyncio
    async def test_query_contains_for_update(self):
        """The SELECT query must include FOR UPDATE to serialise concurrent requests."""
        raw = "check-for-update-token"
        tok_hash = _sha256(raw)
        row = _make_token_row(token_hash=tok_hash)

        async with _mock_pool(fetchrow_return=row) as conn:
            from app.repositories.token_repo import consume_refresh_token
            await consume_refresh_token(raw)

        fetchrow_sql = conn.fetchrow.call_args[0][0]
        assert "FOR UPDATE" in fetchrow_sql.upper(), (
            "consume_refresh_token must use SELECT … FOR UPDATE to prevent "
            "concurrent token replay"
        )

    @pytest.mark.asyncio
    async def test_concurrent_calls_same_token_only_one_succeeds(self):
        """
        Simulate concurrent refresh calls with the same token.

        The first call sees a valid row; subsequent calls see a revoked row
        (simulating what FOR UPDATE + commit achieves at the DB level).
        The second caller must return None.
        """
        raw = "concurrent-token"
        tok_hash = _sha256(raw)
        fid = str(uuid.uuid4())

        valid_row = _make_token_row(token_hash=tok_hash, family_id=fid)
        revoked_row = _make_token_row(token_hash=tok_hash, family_id=fid, revoked=True)

        call_count = 0

        async def _fetchrow_side_effect(sql, tok_hash_arg):
            nonlocal call_count
            call_count += 1
            # First call sees valid row; second sees already-revoked (as DB would after commit)
            return valid_row if call_count == 1 else revoked_row

        async with _mock_pool() as conn:
            conn.fetchrow = AsyncMock(side_effect=_fetchrow_side_effect)
            from app.repositories.token_repo import consume_refresh_token
            r1, r2 = await asyncio.gather(
                consume_refresh_token(raw),
                consume_refresh_token(raw),
            )

        assert r1 is not None, "First concurrent call should succeed"
        assert r2 is None, "Second concurrent call should fail (token already consumed)"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Double-booking prevention
# ─────────────────────────────────────────────────────────────────────────────

class TestDoubleBookingPrevention:
    """
    Verifies that assign_janitor:
    a) blocks assignment if janitor already has an active (confirmed/in_progress) job
    b) succeeds when janitor has no active job
    c) uses a transaction to serialise concurrent assignments
    """

    @pytest.mark.asyncio
    async def test_blocks_when_janitor_has_active_job(self):
        """A janitor with an active job must get a 409 on second assignment."""
        from fastapi import HTTPException

        job_id = str(uuid.uuid4())
        janitor_id = str(uuid.uuid4())
        active_job_id = uuid.uuid4()

        async with _mock_pool() as conn:
            # fetchval returns an existing active job id
            conn.fetchval = AsyncMock(return_value=active_job_id)
            conn.fetchrow = AsyncMock(return_value=None)  # shouldn't be reached

            from app.repositories.job_repo import assign_janitor
            with pytest.raises(HTTPException) as exc_info:
                await assign_janitor(job_id, janitor_id)

        assert exc_info.value.status_code == 409
        assert "active job" in exc_info.value.detail.lower()
        # The UPDATE must NOT have been called
        conn.fetchrow.assert_not_called()

    @pytest.mark.asyncio
    async def test_succeeds_when_janitor_is_free(self):
        """A janitor with no active job can be assigned."""
        job_id = str(uuid.uuid4())
        janitor_id = str(uuid.uuid4())
        expected_row = {
            "id": uuid.UUID(job_id),
            "janitor_id": uuid.UUID(janitor_id),
            "status": "pending",
        }

        async with _mock_pool() as conn:
            conn.fetchval = AsyncMock(return_value=None)   # no active job
            conn.fetchrow = AsyncMock(return_value=expected_row)

            from app.repositories.job_repo import assign_janitor
            result = await assign_janitor(job_id, janitor_id)

        assert result["janitor_id"] == uuid.UUID(janitor_id)
        conn.fetchrow.assert_called_once()

    @pytest.mark.asyncio
    async def test_transaction_used_for_serialisation(self):
        """assign_janitor must run inside a transaction to prevent TOCTOU races."""
        job_id = str(uuid.uuid4())
        janitor_id = str(uuid.uuid4())
        row = {"id": uuid.UUID(job_id), "janitor_id": uuid.UUID(janitor_id), "status": "pending"}

        async with _mock_pool() as conn:
            conn.fetchval = AsyncMock(return_value=None)
            conn.fetchrow = AsyncMock(return_value=row)

            from app.repositories.job_repo import assign_janitor
            await assign_janitor(job_id, janitor_id)

        conn.transaction.assert_called_once()

    @pytest.mark.asyncio
    async def test_concurrent_assignments_only_one_wins(self):
        """
        Two concurrent assign_janitor calls for the same janitor:
        the first wins; the second must get a 409.
        """
        from fastapi import HTTPException

        job_a = str(uuid.uuid4())
        job_b = str(uuid.uuid4())
        janitor_id = str(uuid.uuid4())

        call_count = 0

        async def _fetchval_side_effect(sql, uid):
            nonlocal call_count
            call_count += 1
            # First call: no active job (free to assign)
            # Second call: active job exists (first assignment committed)
            return None if call_count == 1 else uuid.uuid4()

        row = {"id": uuid.uuid4(), "janitor_id": uuid.UUID(janitor_id), "status": "pending"}

        async with _mock_pool() as conn:
            conn.fetchval = AsyncMock(side_effect=_fetchval_side_effect)
            conn.fetchrow = AsyncMock(return_value=row)

            from app.repositories.job_repo import assign_janitor

            results = await asyncio.gather(
                assign_janitor(job_a, janitor_id),
                assign_janitor(job_b, janitor_id),
                return_exceptions=True,
            )

        successes = [r for r in results if isinstance(r, dict)]
        failures = [r for r in results if isinstance(r, Exception)]

        assert len(successes) == 1, f"Exactly one assignment should succeed, got {successes}"
        assert len(failures) == 1, f"Exactly one should fail with 409"
        assert isinstance(failures[0], HTTPException)
        assert failures[0].status_code == 409


# ─────────────────────────────────────────────────────────────────────────────
# 3. Status transition validation
# ─────────────────────────────────────────────────────────────────────────────

class TestStatusTransitions:
    """
    Verifies the job FSM enforces valid transitions and rejects invalid ones.
    All transitions are tested at the schema level (no DB needed).
    """

    def test_valid_transitions(self):
        from app.schema.job_schema import JobStatus, VALID_TRANSITIONS

        valid = [
            (JobStatus.PENDING, JobStatus.CONFIRMED),
            (JobStatus.PENDING, JobStatus.CANCELLED),
            (JobStatus.CONFIRMED, JobStatus.IN_PROGRESS),
            (JobStatus.CONFIRMED, JobStatus.CANCELLED),
            (JobStatus.IN_PROGRESS, JobStatus.COMPLETED),
        ]
        for current, target in valid:
            assert target in VALID_TRANSITIONS[current], (
                f"{current.value} → {target.value} should be valid"
            )

    def test_invalid_transitions_rejected(self):
        from app.schema.job_schema import JobStatus, VALID_TRANSITIONS

        invalid = [
            (JobStatus.PENDING, JobStatus.IN_PROGRESS),
            (JobStatus.PENDING, JobStatus.COMPLETED),
            (JobStatus.IN_PROGRESS, JobStatus.CONFIRMED),
            (JobStatus.COMPLETED, JobStatus.PENDING),
            (JobStatus.COMPLETED, JobStatus.IN_PROGRESS),
            (JobStatus.CANCELLED, JobStatus.CONFIRMED),
            (JobStatus.CANCELLED, JobStatus.IN_PROGRESS),
        ]
        for current, target in invalid:
            assert target not in VALID_TRANSITIONS[current], (
                f"{current.value} → {target.value} should be INVALID"
            )

    def test_terminal_states_have_no_transitions(self):
        from app.schema.job_schema import JobStatus, VALID_TRANSITIONS

        assert VALID_TRANSITIONS[JobStatus.COMPLETED] == []
        assert VALID_TRANSITIONS[JobStatus.CANCELLED] == []

    @pytest.mark.asyncio
    async def test_update_status_rejects_invalid_transition(self):
        """update_status raises 400 for an illegal FSM move."""
        from fastapi import HTTPException
        from app.repositories.job_repo import update_status

        job_id = str(uuid.uuid4())
        pending_row = {
            "id": uuid.UUID(job_id),
            "status": "pending",
            "price": 5000,
        }

        async with _mock_pool(fetchrow_return=pending_row) as _conn:
            # pending → completed is not a valid transition
            with pytest.raises(HTTPException) as exc_info:
                await update_status(job_id, "completed")

        assert exc_info.value.status_code == 400
        assert "invalid transition" in exc_info.value.detail.lower()


# ─────────────────────────────────────────────────────────────────────────────
# 4. Rate limiter
# ─────────────────────────────────────────────────────────────────────────────

class TestRateLimiter:
    """
    Verifies that the rate limiter:
    a) allows requests up to the limit
    b) blocks requests over the limit
    c) resets after the window expires
    d) uses Redis when available, in-memory when not
    """

    def test_in_memory_allows_up_to_limit(self):
        from app.middleware.rate_limiter import _InMemoryBucket

        bucket = _InMemoryBucket()
        limit = 5
        results = [bucket.is_allowed("test-ip", limit) for _ in range(7)]

        assert results[:5] == [True] * 5, "First 5 should be allowed"
        assert results[5:] == [False] * 2, "6th and 7th should be blocked"

    def test_in_memory_resets_after_window(self):
        from app.middleware.rate_limiter import _InMemoryBucket, WINDOW_SECONDS

        bucket = _InMemoryBucket()
        limit = 3

        # Fill the bucket
        for _ in range(3):
            bucket.is_allowed("test-ip2", limit)

        # Manually age out the entries
        bucket._requests["test-ip2"] = [
            t - WINDOW_SECONDS - 1 for t in bucket._requests["test-ip2"]
        ]

        # Should now be allowed again
        assert bucket.is_allowed("test-ip2", limit) is True

    def test_different_ips_independent_counters(self):
        from app.middleware.rate_limiter import _InMemoryBucket

        bucket = _InMemoryBucket()
        limit = 2

        # Fill ip1
        bucket.is_allowed("1.1.1.1", limit)
        bucket.is_allowed("1.1.1.1", limit)

        # ip2 should not be affected
        assert bucket.is_allowed("2.2.2.2", limit) is True

    @pytest.mark.asyncio
    async def test_redis_rate_limiter_uses_incr(self):
        """When Redis is available, the rate check uses INCR for atomicity."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock(return_value=True)

        with patch("app.middleware.rate_limiter.get_redis", return_value=mock_redis):
            from app.middleware.rate_limiter import _is_allowed_redis
            result = await _is_allowed_redis("1.2.3.4", 100)

        assert result is True
        mock_redis.incr.assert_called_once()

    @pytest.mark.asyncio
    async def test_redis_rate_limiter_blocks_over_limit(self):
        """Redis rate limiter blocks when INCR returns value > limit."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(return_value=101)  # Over the 100 limit
        mock_redis.expire = AsyncMock(return_value=True)

        with patch("app.middleware.rate_limiter.get_redis", return_value=mock_redis):
            from app.middleware.rate_limiter import _is_allowed_redis
            result = await _is_allowed_redis("1.2.3.4", 100)

        assert result is False

    @pytest.mark.asyncio
    async def test_redis_failure_falls_back_to_in_memory(self):
        """Redis failure must fall back to in-memory, never block all traffic."""
        mock_redis = AsyncMock()
        mock_redis.incr = AsyncMock(side_effect=ConnectionError("Redis down"))

        with patch("app.middleware.rate_limiter.get_redis", return_value=mock_redis):
            from app.middleware.rate_limiter import _is_allowed_redis
            # Should not raise — falls back to in-memory bucket
            result = await _is_allowed_redis("fallback-ip", 100)

        assert result is True

    def test_concurrent_requests_consistent_limit(self):
        """50 rapid calls with limit=20 → exactly 20 allowed, 30 blocked."""
        from app.middleware.rate_limiter import _InMemoryBucket

        bucket = _InMemoryBucket()
        limit = 20

        # The in-memory bucket is synchronous — call it 50 times in a tight loop
        # to simulate a burst.  asyncio is single-threaded so there is no true
        # concurrent interleaving here; this test validates the sliding-window
        # logic holds the line at exactly `limit` requests within the window.
        results = [bucket.is_allowed("burst-ip", limit) for _ in range(50)]

        allowed = sum(results)
        assert allowed == limit, (
            f"Expected exactly {limit} allowed requests, got {allowed}"
        )
        assert results[:limit] == [True] * limit, "First batch should all succeed"
        assert results[limit:] == [False] * (50 - limit), "Rest should be blocked"


# ─────────────────────────────────────────────────────────────────────────────
# 5. Pricing cache coherence
# ─────────────────────────────────────────────────────────────────────────────

class TestPricingCacheCoherence:
    """
    Verifies that:
    a) pricing config is served from Redis when available
    b) an update clears the Redis key (all processes see fresh prices)
    c) falls back to DB if Redis misses
    d) falls back to defaults if DB is unreachable
    """

    @pytest.mark.asyncio
    async def test_redis_cache_hit_skips_db(self):
        """If Redis has the pricing config, the DB pool is never queried."""
        import json
        from app.repositories.pricing_config import DEFAULT_CONFIG

        cached_config = json.dumps({**DEFAULT_CONFIG, "room_rate": 9999})
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=cached_config)

        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock()  # should NOT be called

        with patch("app.repositories.pricing_config.get_redis", return_value=mock_redis):
            from app.repositories.pricing_config import load_config
            config = await load_config(mock_pool)

        assert config["room_rate"] == 9999
        mock_pool.acquire.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_invalidates_redis_key(self):
        """update_config must delete the Redis cache key so all workers reload."""
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock()

        conn = AsyncMock()
        conn.execute = AsyncMock()
        acquire_ctx = AsyncMock()
        acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
        acquire_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=acquire_ctx)

        with patch("app.repositories.pricing_config.get_redis", return_value=mock_redis):
            from app.repositories.pricing_config import update_config
            await update_config(mock_pool, {"room_rate": 1500})

        mock_redis.delete.assert_called_once()
        deleted_key = mock_redis.delete.call_args[0][0]
        assert "pricing" in deleted_key.lower()

    @pytest.mark.asyncio
    async def test_redis_miss_falls_back_to_db(self):
        """Cache miss (Redis returns None) must trigger a DB fetch."""
        from app.repositories.pricing_config import DEFAULT_CONFIG

        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)   # cache miss
        mock_redis.setex = AsyncMock()

        db_rows = [MagicMock(spec=dict)]
        db_rows[0].__getitem__ = lambda s, k: {"key": "room_rate", "value": 2000}[k]

        conn = AsyncMock()
        conn.fetch = AsyncMock(return_value=[
            {"key": "room_rate", "value": 2000},
        ])
        acquire_ctx = AsyncMock()
        acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
        acquire_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=acquire_ctx)

        with patch("app.repositories.pricing_config.get_redis", return_value=mock_redis):
            # Reset module-level memory cache to force DB path
            import app.repositories.pricing_config as pc_module
            pc_module._mem_cache = {}
            pc_module._mem_cache_ts = 0.0

            from app.repositories.pricing_config import load_config
            config = await load_config(mock_pool)

        assert config["room_rate"] == 2000
        conn.fetch.assert_called_once()
        # Redis should now be populated
        mock_redis.setex.assert_called_once()

    @pytest.mark.asyncio
    async def test_db_failure_returns_defaults(self):
        """If both Redis and DB are unavailable, return DEFAULT_CONFIG."""
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        conn = AsyncMock()
        conn.fetch = AsyncMock(side_effect=Exception("DB down"))
        acquire_ctx = AsyncMock()
        acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
        acquire_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_pool = MagicMock()
        mock_pool.acquire = MagicMock(return_value=acquire_ctx)

        with patch("app.repositories.pricing_config.get_redis", return_value=mock_redis):
            import app.repositories.pricing_config as pc_module
            pc_module._mem_cache = {}
            pc_module._mem_cache_ts = 0.0

            from app.repositories.pricing_config import load_config, DEFAULT_CONFIG
            config = await load_config(mock_pool)

        assert config == DEFAULT_CONFIG


# ─────────────────────────────────────────────────────────────────────────────
# 6. N+1 fix verification
# ─────────────────────────────────────────────────────────────────────────────

class TestDispatchN1Fix:
    """
    Verifies that get_nearby_janitors makes exactly 2 DB calls regardless
    of how many janitors are available (1 for janitor list + 1 batch count).
    """

    @pytest.mark.asyncio
    async def test_exactly_two_queries_for_ten_janitors(self):
        """10 available janitors → exactly 2 queries, not 11."""
        n = 10
        janitors = [
            {
                "id": uuid.uuid4(),
                "latitude": 6.5 + i * 0.01,
                "longitude": 3.3,
                "avg_rating": 4.0,
                "trust_score": 4.0,
                "trust_tier": "Gold",
                "service_types": ["house_cleaning"],
                "full_name": f"Janitor {i}",
                "avatar_url": None,
            }
            for i in range(n)
        ]

        # Build a mock for janitor_repo that counts calls
        call_log: list[str] = []

        async def mock_get_available(service_type=None, limit=50):
            call_log.append("get_available")
            return janitors

        async def mock_get_recent_job_counts_batch(janitor_ids, days=7):
            call_log.append("get_recent_job_counts_batch")
            return {str(jid): 2 for jid in janitor_ids}

        with patch("app.services.janitor_service.janitor_repo.get_available",
                   side_effect=mock_get_available):
            with patch("app.services.janitor_service.janitor_repo.get_recent_job_counts_batch",
                       side_effect=mock_get_recent_job_counts_batch):
                from app.services.janitor_service import get_nearby_janitors
                results = await get_nearby_janitors(
                    lat=6.55, lng=3.35, service_type="house_cleaning"
                )

        assert "get_available" in call_log, "get_available must be called"
        assert "get_recent_job_counts_batch" in call_log, "batch count must be called"
        assert call_log.count("get_available") == 1, "get_available called once"
        assert call_log.count("get_recent_job_counts_batch") == 1, "batch count called once"
        assert len(call_log) == 2, (
            f"Expected exactly 2 DB calls for {n} janitors, got {len(call_log)}: {call_log}"
        )

    @pytest.mark.asyncio
    async def test_no_calls_when_no_janitors_available(self):
        """Zero available janitors → no batch query needed."""
        call_log: list[str] = []

        async def mock_get_available(service_type=None, limit=50):
            call_log.append("get_available")
            return []

        async def mock_batch(*args, **kwargs):
            call_log.append("batch")
            return {}

        with patch("app.services.janitor_service.janitor_repo.get_available",
                   side_effect=mock_get_available):
            with patch("app.services.janitor_service.janitor_repo.get_recent_job_counts_batch",
                       side_effect=mock_batch):
                from app.services.janitor_service import get_nearby_janitors
                results = await get_nearby_janitors(lat=6.5, lng=3.3, service_type="house_cleaning")

        assert results == []
        assert "batch" not in call_log, "Batch query should not fire when no janitors"
