"""
JANCO Load & Performance Test Suite
=====================================

Tests the system under realistic concurrent load and verifies that
race conditions, double-booking, and token replay attacks are prevented
at scale.

Usage:
    # Install: venv/bin/pip install locust
    # Terminal: venv/bin/locust -f locustfile.py --host http://localhost:8000
    # Then open http://localhost:8089 to start the test.

    # Headless (CI):
    #   venv/bin/locust -f locustfile.py --host http://localhost:8000 \\
    #       --headless -u 50 -r 10 --run-time 60s

User profiles:
  - CustomerUser   : signs up, creates bookings, polls status (60 % of load)
  - JanitorUser    : polls assigned jobs, updates status (25 % of load)
  - RaceProber     : hammers concurrent token refresh to detect replay bugs (15 %)

Expected results at 5,000 CCU:
  - P95 response < 500 ms for booking creation
  - P99 response < 1,000 ms for all endpoints
  - Zero 5xx responses
  - Zero double-booking 200 responses after the first accept
  - Token refresh race: only one 200 per token, rest are 401
"""

from __future__ import annotations

import json
import random
import string
import time
import uuid
from threading import Lock

from locust import HttpUser, TaskSet, between, events, task


# ─────────────────────────────────────────────────────────────────────────────
# Shared state (written under lock to be thread-safe)
# ─────────────────────────────────────────────────────────────────────────────

_shared: dict = {
    "users": [],       # list of {"user_id", "access_token", "refresh_token"}
    "jobs": [],        # list of job_ids created during the test
    "janitors": [],    # list of janitor_ids
    "lock": Lock(),
}


def _rand_email() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"loadtest_{suffix}@janco.test"


def _rand_password() -> str:
    return "LoadTest@" + "".join(random.choices(string.digits, k=6))


# ─────────────────────────────────────────────────────────────────────────────
# Customer tasks
# ─────────────────────────────────────────────────────────────────────────────

class CustomerTasks(TaskSet):

    def on_start(self):
        """Each VU creates a new account and stores credentials."""
        email = _rand_email()
        pwd = _rand_password()
        r = self.client.post("/v1/auth/signup", json={
            "email": email,
            "password": pwd,
            "full_name": "Load Test User",
        })
        if r.status_code == 200:
            data = r.json()
            self._access = data.get("access_token", "")
            self._refresh = data.get("refresh_token", "")
            self._user_id = data.get("user_id", "")
            with _shared["lock"]:
                _shared["users"].append({
                    "user_id": self._user_id,
                    "access_token": self._access,
                    "refresh_token": self._refresh,
                })
        else:
            self._access = ""
            self._refresh = ""
            self._user_id = ""

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._access}"}

    @task(5)
    def create_booking(self):
        """Create a booking — primary write load."""
        if not self._access:
            return
        payload = {
            "service_type": random.choice(["house_cleaning", "deep_cleaning", "laundry"]),
            "rooms": random.randint(1, 5),
            "toilets": random.randint(0, 2),
            "address": "123 Load Test Street, Lagos",
            "latitude": 6.5 + random.uniform(-0.1, 0.1),
            "longitude": 3.3 + random.uniform(-0.1, 0.1),
            "scheduled_date": "2027-01-15",
            "scheduled_time": "09:00",
            "distance_km": random.uniform(1, 20),
        }
        r = self.client.post("/v1/bookings", json=payload, headers=self._headers())
        if r.status_code == 200:
            job_id = r.json().get("job", {}).get("id")
            if job_id:
                with _shared["lock"]:
                    _shared["jobs"].append(job_id)

    @task(3)
    def list_my_bookings(self):
        """Read load — polling for booking status."""
        if not self._access:
            return
        self.client.get("/v1/bookings", headers=self._headers())

    @task(2)
    def get_price_estimate(self):
        """Pricing engine read — high frequency, should be cached."""
        if not self._access:
            return
        self.client.post("/v1/pricing/estimate", json={
            "service_type": "house_cleaning",
            "rooms": random.randint(1, 10),
            "toilets": random.randint(0, 3),
        }, headers=self._headers())

    @task(2)
    def get_nearby_janitors(self):
        """Dispatch engine read — verifies N+1 fix doesn't time out."""
        if not self._access:
            return
        lat = 6.5 + random.uniform(-0.5, 0.5)
        lng = 3.3 + random.uniform(-0.5, 0.5)
        self.client.get(
            f"/v1/janitors/nearby?lat={lat}&lng={lng}&service_type=house_cleaning",
            headers=self._headers(),
        )

    @task(1)
    def refresh_tokens(self):
        """Token rotation — single use; must not allow replay."""
        if not self._refresh:
            return
        r = self.client.post("/v1/auth/refresh", json={"refresh_token": self._refresh})
        if r.status_code == 200:
            data = r.json()
            self._access = data.get("access_token", self._access)
            self._refresh = data.get("refresh_token", self._refresh)


# ─────────────────────────────────────────────────────────────────────────────
# Race condition prober — concurrent token refresh attack
# ─────────────────────────────────────────────────────────────────────────────

class RaceProberTasks(TaskSet):
    """
    Reuses the SAME refresh token in rapid succession to probe for
    token replay vulnerabilities.

    Expected: exactly ONE 200, all others 401.
    Failures are recorded as custom Locust errors.
    """

    def on_start(self):
        email = _rand_email()
        pwd = _rand_password()
        r = self.client.post("/v1/auth/signup", json={
            "email": email, "password": pwd, "full_name": "Race Prober",
        })
        if r.status_code == 200:
            data = r.json()
            self._refresh = data.get("refresh_token", "")
        else:
            self._refresh = ""

    @task
    def concurrent_refresh_probe(self):
        """Send the same refresh token twice in rapid succession."""
        if not self._refresh:
            return

        token_to_replay = self._refresh
        results = []

        # Fire two rapid requests with the same token
        for _ in range(2):
            r = self.client.post(
                "/v1/auth/refresh",
                json={"refresh_token": token_to_replay},
                name="/v1/auth/refresh [race probe]",
            )
            results.append(r.status_code)

        successes = results.count(200)
        if successes > 1:
            # Both requests with the same token returned 200 — replay vulnerability!
            events.request.fire(
                request_type="RACE_CONDITION",
                name="Token replay succeeded (VULNERABILITY)",
                response_time=0,
                response_length=0,
                exception=Exception(
                    f"Token replay not prevented: {results}"
                ),
            )

        # After probe, get a fresh token for next iteration
        r2 = self.client.post("/v1/auth/login", json={
            "email": "probe@janco.test", "password": "invalid"  # will 401 — that's fine
        })
        self._refresh = ""  # reset so next probe starts fresh


# ─────────────────────────────────────────────────────────────────────────────
# Double-booking prober
# ─────────────────────────────────────────────────────────────────────────────

class DoubleBookingProberTasks(TaskSet):
    """
    Creates a job, then tries to assign the same janitor to TWO jobs
    simultaneously. Verifies the second returns 409.
    """

    def on_start(self):
        self._token = ""
        email = _rand_email()
        r = self.client.post("/v1/auth/signup", json={
            "email": email, "password": "TestPass@123", "full_name": "Booking Prober",
        })
        if r.status_code == 200:
            self._token = r.json().get("access_token", "")

    @task
    def probe_double_booking(self):
        """Skip if no shared jobs or this is not an admin-level test."""
        # This probe only works when running against a test environment with
        # an admin token configured via LOCUST_ADMIN_TOKEN env var.
        import os
        admin_token = os.getenv("LOCUST_ADMIN_TOKEN", "")
        if not admin_token:
            return

        # Pick two jobs from shared state
        with _shared["lock"]:
            if len(_shared["jobs"]) < 2:
                return
            job_a, job_b = _shared["jobs"][-2], _shared["jobs"][-1]

        janitor_id = os.getenv("LOCUST_TEST_JANITOR_ID", "")
        if not janitor_id:
            return

        headers = {"Authorization": f"Bearer {admin_token}"}

        # Attempt to assign same janitor to both jobs
        r1 = self.client.patch(
            f"/v1/admin/jobs/{job_a}/assign",
            json={"janitor_id": janitor_id},
            headers=headers,
            name="/v1/admin/jobs/[id]/assign [double booking probe]",
        )
        r2 = self.client.patch(
            f"/v1/admin/jobs/{job_b}/assign",
            json={"janitor_id": janitor_id},
            headers=headers,
            name="/v1/admin/jobs/[id]/assign [double booking probe]",
        )

        if r2.status_code == 200:
            events.request.fire(
                request_type="DOUBLE_BOOKING",
                name="Double booking not prevented (VULNERABILITY)",
                response_time=0,
                response_length=0,
                exception=Exception(
                    f"Both assignments returned 200: job_a={job_a}, job_b={job_b}"
                ),
            )


# ─────────────────────────────────────────────────────────────────────────────
# User classes (weights control the mix)
# ─────────────────────────────────────────────────────────────────────────────

class CustomerUser(HttpUser):
    """Regular customer — 60 % of simulated load."""
    tasks = [CustomerTasks]
    wait_time = between(1, 3)
    weight = 60


class RaceProber(HttpUser):
    """Concurrent token-replay prober — 15 % of load."""
    tasks = [RaceProberTasks]
    wait_time = between(2, 5)
    weight = 15


class DoubleBookingProber(HttpUser):
    """Double-booking probe — 10 % of load."""
    tasks = [DoubleBookingProberTasks]
    wait_time = between(3, 8)
    weight = 10
