# JANCO Platform — Product Requirements Document (PRD)

**Version:** 2.0
**Date:** March 8, 2026
**Author:** Engineering Team
**Status:** Active Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Objectives](#2-product-vision--objectives)
3. [System Architecture](#3-system-architecture)
4. [Module Specifications](#4-module-specifications)
5. [Database Schema](#5-database-schema)
6. [API Specification](#6-api-specification)
7. [Frontend Specification](#7-frontend-specification)
8. [Trust & Security Module](#8-trust--security-module)
9. [AI/ML Pipeline](#9-aiml-pipeline)
10. [Engineering Standards](#10-engineering-standards)
11. [Performance & Optimization](#11-performance--optimization)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Testing Strategy](#13-testing-strategy)
14. [Appendices](#14-appendices)

---

## 1. Executive Summary

JANCO is an AI-powered gig-economy platform for domestic cleaning services in Nigeria. It addresses four critical market failures: trust deficit between customers and workers, subjective pricing, worker exploitation, and infrastructure fragility (poor networks, low-end devices).

### Current State (Gap Summary)

The codebase is approximately 15-20% complete. The backend has 164 lines of production code (booking routes) with 16 empty stub files. The frontend has ~2,750 lines across 22 screens but suffers from business logic leaking into the UI layer, direct Supabase calls bypassing the backend, hardcoded pricing, no authentication middleware, and zero test coverage.

### What This PRD Delivers

This document serves as the single source of truth for an AI coding agent to rebuild JANCO from the existing foundation into a production-grade platform. Every feature maps to an academic objective. Every module follows KISS, DRY, SOLID principles. Every screen is optimized for low-end Android devices on 2G/3G networks.

---

## 2. Product Vision & Objectives

### 2.1 Academic Objectives (Must Be Demonstrable)

Each objective must have working code that can be demonstrated during project defense.

**Objective 1 — User-Centric Architecture**
- Complete mobile app (React Native + Expo)
- Clean Architecture (Presentation → Domain → Data layers)
- Booking flow completable in under 3 minutes
- System Usability Scale score above 70

**Objective 2 — AI-Based Spatial Pricing**
- Computer Vision module: U-Net segmentation + EfficientNet clutter classification
- Fallback: room-count heuristic pricing (current implementation, refined)
- Price = Area × BaseRate(₦125/sqm) × ClutterMultiplier
- Pricing MAPE below 10%

**Objective 3 — Intelligent Dispatch**
- Multi-objective weighted scoring: 0.30×Distance + 0.35×Quality + 0.20×Fairness + 0.10×Skill + 0.05×Preference
- Assignment time under 30 seconds
- Worker acceptance rate above 80%

**Objective 4 — Trust & Identity Verification**
- Dojah API integration for NIN/BVN verification
- Liveness detection via selfie capture
- TrustScore algorithm: (IdentityVerified × 0.4) + (Punctuality × 0.3) + (Rating × 0.3)
- Verification under 3 minutes, completion rate above 90%

**Objective 5 — System Evaluation**
- Unit + integration + usability tests
- 50-100 beta users
- System uptime above 95%

### 2.2 Product Differentiators vs Competitors

Compared to Eden Life (Nigeria), SweepSouth (Africa), TaskRabbit, Handy, and JustLife:

- **Transparent AI Pricing** — customers see exactly why they're paying what they pay (area breakdown, clutter level)
- **Trust-First Design** — verified badge visible before booking, not hidden in settings
- **Offline Resilience** — optimistic UI with background sync (critical for Nigerian infrastructure)
- **Worker Fairness** — fatigue-aware dispatch prevents star-worker burnout
- **Low-End Device Support** — targets 2GB RAM Android devices on 3G

---

## 3. System Architecture

### 3.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
│  React Native + Expo (iOS/Android)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Screens  │ │  Hooks   │ │  Store   │ │  API Client   │  │
│  │ (UI only)│ │(data only│ │ (Zustand)│ │ (fetch wrapper)│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (JSON)
                           │ JWT Bearer Token
┌──────────────────────────▼──────────────────────────────────┐
│                    API LAYER (FastAPI)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Routes  │ │Middleware │ │ Services │ │  Validators   │  │
│  │ (thin)   │ │(auth,rate)│ │(business)│ │  (Pydantic)   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ Pricing  │ │ Dispatch │ │  Trust   │                    │
│  │ Engine   │ │ Engine   │ │ Engine   │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Supabase         │  │ Cloudinary   │  │ Redis (cache) │  │
│  │ (PostgreSQL + RLS│  │ (images)     │  │ (optional)    │  │
│  │  + Realtime)     │  │              │  │               │  │
│  └──────────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 EXTERNAL SERVICES                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Dojah    │ │ Paystack │ │ Firebase │ │ OpenStreetMap │  │
│  │ (NIN/BVN)│ │(payments)│ │ (FCM)    │ │ (routing)     │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Core Principle: Backend-as-Proxy

**Rule: The frontend NEVER touches the database directly.**

All Supabase calls currently in the frontend must migrate to the backend. The frontend communicates exclusively with FastAPI endpoints via the API client. The only exception is Supabase Realtime subscriptions for chat (read-only, filtered by RLS).

### 3.3 Directory Structure (Target)

```
janco/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app, CORS, routers
│   │   ├── config.py                  # Settings (env vars, constants)
│   │   ├── dependencies.py            # Shared dependencies (get_db, get_current_user)
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.py                # JWT validation middleware
│   │   │   ├── rate_limiter.py        # Request rate limiting
│   │   │   └── error_handler.py       # Global exception handler
│   │   │
│   │   ├── routes/
│   │   │   ├── auth_routes.py         # /auth/* (login, signup, refresh, verify)
│   │   │   ├── booking_routes.py      # /bookings/* (create, list, update, cancel)
│   │   │   ├── janitor_routes.py      # /janitors/* (register, profile, availability)
│   │   │   ├── job_routes.py          # /jobs/* (status, history, assign)
│   │   │   ├── chat_routes.py         # /chat/* (messages, channels)
│   │   │   ├── pricing_routes.py      # /pricing/* (estimate, calculate)
│   │   │   ├── trust_routes.py        # /trust/* (verify, trust-score)
│   │   │   └── admin_routes.py        # /admin/* (dashboard, reports)
│   │   │
│   │   ├── services/
│   │   │   ├── auth_service.py        # Auth business logic
│   │   │   ├── booking_service.py     # Booking orchestration
│   │   │   ├── pricing_service.py     # Pricing engine (heuristic + CV)
│   │   │   ├── dispatch_service.py    # Multi-objective dispatch algorithm
│   │   │   ├── trust_service.py       # Trust score + Dojah integration
│   │   │   ├── notification_service.py# Push notifications (FCM)
│   │   │   ├── chat_service.py        # Message handling
│   │   │   └── location_service.py    # Haversine, geocoding, ETA
│   │   │
│   │   ├── models/
│   │   │   ├── user.py                # User Pydantic models
│   │   │   ├── job.py                 # Job/Booking models
│   │   │   ├── janitor.py             # Janitor models
│   │   │   ├── pricing.py             # Pricing models
│   │   │   ├── trust.py               # Trust/verification models
│   │   │   └── chat.py                # Chat models
│   │   │
│   │   ├── db/
│   │   │   ├── supabase_client.py     # Singleton Supabase client
│   │   │   └── repositories/
│   │   │       ├── user_repo.py       # User CRUD operations
│   │   │       ├── job_repo.py        # Job CRUD operations
│   │   │       ├── janitor_repo.py    # Janitor CRUD operations
│   │   │       └── message_repo.py    # Message CRUD operations
│   │   │
│   │   ├── engines/
│   │   │   ├── pricing_engine.py      # Core pricing algorithm
│   │   │   ├── dispatch_engine.py     # Core dispatch algorithm
│   │   │   └── trust_engine.py        # Core trust scoring
│   │   │
│   │   └── utils/
│   │       ├── constants.py           # ALL magic numbers live here
│   │       ├── geo.py                 # Haversine, distance, ETA
│   │       ├── validators.py          # Custom validators
│   │       ├── formatters.py          # Response formatting
│   │       └── logger.py              # Structured logging
│   │
│   ├── tests/
│   │   ├── test_pricing_engine.py
│   │   ├── test_dispatch_engine.py
│   │   ├── test_trust_engine.py
│   │   ├── test_booking_routes.py
│   │   └── test_auth_routes.py
│   │
│   ├── requirements.txt               # Correct dependencies
│   ├── .env.example                   # Template (no secrets)
│   └── Dockerfile
│
├── frontend/
│   ├── App/
│   │   ├── api/
│   │   │   ├── client.js              # Fetch wrapper (auth headers, retry, offline queue)
│   │   │   ├── endpoints.js           # All endpoint URLs as constants
│   │   │   ├── authApi.js             # /auth/* calls
│   │   │   ├── bookingApi.js          # /bookings/* calls
│   │   │   ├── janitorApi.js          # /janitors/* calls
│   │   │   ├── pricingApi.js          # /pricing/* calls
│   │   │   └── trustApi.js            # /trust/* calls
│   │   │
│   │   ├── store/
│   │   │   ├── authStore.js           # Zustand auth state
│   │   │   ├── bookingStore.js        # Zustand booking state
│   │   │   ├── jobStore.js            # Zustand job state
│   │   │   └── uiStore.js             # Loading, errors, modals
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js             # Auth hook (calls API, not Supabase)
│   │   │   ├── useBooking.js          # Booking flow hook
│   │   │   ├── useJanitors.js         # Janitor data hook
│   │   │   ├── useLocation.js         # Geolocation hook
│   │   │   ├── useNetwork.js          # Network status hook
│   │   │   └── useOfflineQueue.js     # Offline mutation queue
│   │   │
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   │   ├── LoginScreen.jsx
│   │   │   │   ├── SignupScreen.jsx
│   │   │   │   ├── VerifyOTPScreen.jsx
│   │   │   │   └── ForgotPasswordScreen.jsx
│   │   │   ├── onboarding/
│   │   │   │   ├── WelcomeScreen.jsx
│   │   │   │   └── ProfileSetupScreen.jsx
│   │   │   ├── customer/
│   │   │   │   ├── HomeScreen.jsx
│   │   │   │   ├── BookingScreen.jsx
│   │   │   │   ├── PriceEstimateScreen.jsx
│   │   │   │   ├── NearbyJanitorsScreen.jsx
│   │   │   │   ├── JobStatusScreen.jsx
│   │   │   │   ├── BookingHistoryScreen.jsx
│   │   │   │   └── ProfileScreen.jsx
│   │   │   ├── janitor/
│   │   │   │   ├── DashboardScreen.jsx
│   │   │   │   ├── RegistrationScreen.jsx
│   │   │   │   ├── VerificationScreen.jsx
│   │   │   │   ├── JobDetailScreen.jsx
│   │   │   │   └── EarningsScreen.jsx
│   │   │   └── shared/
│   │   │       ├── ChatScreen.jsx
│   │   │       ├── NotificationsScreen.jsx
│   │   │       └── SettingsScreen.jsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                    # Reusable primitives
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── Badge.jsx
│   │   │   │   ├── Skeleton.jsx       # Loading placeholder
│   │   │   │   ├── OfflineBanner.jsx
│   │   │   │   └── EmptyState.jsx
│   │   │   ├── booking/
│   │   │   │   ├── ServiceCard.jsx
│   │   │   │   ├── DateTimePicker.jsx
│   │   │   │   ├── RoomCounter.jsx
│   │   │   │   └── PriceBreakdown.jsx
│   │   │   ├── janitor/
│   │   │   │   ├── JanitorCard.jsx
│   │   │   │   ├── TrustBadge.jsx     # Verified indicator
│   │   │   │   └── RatingStars.jsx
│   │   │   └── layout/
│   │   │       ├── Header.jsx
│   │   │       ├── SafeArea.jsx
│   │   │       └── ScreenWrapper.jsx
│   │   │
│   │   ├── navigation/
│   │   │   ├── RootNavigator.jsx
│   │   │   ├── AuthNavigator.jsx
│   │   │   ├── CustomerNavigator.jsx
│   │   │   └── JanitorNavigator.jsx
│   │   │
│   │   ├── constants/
│   │   │   ├── colors.js              # Theme colors
│   │   │   ├── spacing.js             # Spacing scale
│   │   │   ├── typography.js          # Font sizes/weights
│   │   │   ├── services.js            # Service type definitions
│   │   │   └── config.js              # API_URL, timeouts, limits
│   │   │
│   │   └── utils/
│   │       ├── formatters.js          # Currency, date, distance formatters
│   │       ├── validators.js          # Input validation rules
│   │       └── storage.js             # AsyncStorage wrapper
│   │
│   ├── app.json
│   └── package.json
│
├── context.md                         # AI agent context file
├── JANCO_PRD.md                       # This document
└── .gitignore
```

---

## 4. Module Specifications

### 4.1 Pricing Engine

**Location:** `backend/app/engines/pricing_engine.py`

The pricing engine supports two modes: heuristic (room-count based, available now) and spatial (CV-based, planned). The heuristic mode serves as the fallback.

**Heuristic Pricing (Primary — implement first):**

```
Input: service_type, room_count, toilet_count, extras[], pricing_mode (fixed|dynamic)

Fixed Mode:
  house_cleaning: {basic: 24000, standard: 35000, premium: 50000}
  deep_cleaning:  {basic: 40000, standard: 60000, premium: 85000}
  laundry:        {per_item: 300, ironing_addon: 500}
  fumigation:     {flat_rate: 10000}

Dynamic Mode:
  base = room_count × RATE_PER_ROOM (₦1500)
  toilets = toilet_count × RATE_PER_TOILET (₦800)
  extras_total = sum(EXTRA_RATES[extra] for extra in extras)
  subtotal = base + toilets + extras_total
  surge = get_surge_multiplier(datetime.now())  # 1.0 normal, 1.2 peak, 1.5 holiday
  total = subtotal × surge

Output: {total, breakdown: {base, toilets, extras, surge}, mode, confidence: 1.0}
```

**Spatial Pricing (Phase 2 — CV integration):**

```
Input: room_image (base64), service_type

Pipeline:
  1. Preprocess image (resize 512×512, normalize)
  2. U-Net segmentation → floor mask (binary)
  3. Pixel-to-meter conversion (reference object detection)
  4. floor_area_sqm = floor_pixels / (pixels_per_meter²)
  5. EfficientNet classification → clutter_level (low|medium|high)
  6. clutter_multiplier = {low: 1.0, medium: 1.3, high: 1.6}
  7. price = floor_area_sqm × BASE_RATE_PER_SQM (₦125) × clutter_multiplier
  8. confidence = segmentation_iou × classification_probability

Output: {total, breakdown: {area_sqm, clutter_level, multiplier, base_rate},
         mode: "spatial", confidence: 0.0-1.0}
```

**Constants file (`utils/constants.py`):**

```python
# Pricing Constants (ISSA 612 Standards)
BASE_RATE_PER_SQM = 125          # Naira per square meter
RATE_PER_ROOM = 1500             # Naira per room (heuristic)
RATE_PER_TOILET = 800            # Naira per toilet
SURGE_PEAK_MULTIPLIER = 1.2     # Weekend/evening multiplier
SURGE_HOLIDAY_MULTIPLIER = 1.5  # Public holiday multiplier
CLUTTER_MULTIPLIERS = {"low": 1.0, "medium": 1.3, "high": 1.6}
MIN_PRICE_NAIRA = 5000           # Floor price
MAX_PRICE_NAIRA = 200000         # Ceiling price

# Fixed Service Prices
FIXED_PRICES = {
    "house_cleaning": {"basic": 24000, "standard": 35000, "premium": 50000},
    "deep_cleaning": {"basic": 40000, "standard": 60000, "premium": 85000},
    "laundry": {"per_item": 300, "ironing_addon": 500},
    "fumigation": {"flat_rate": 10000},
}

# Extra Service Rates
EXTRA_RATES = {
    "kitchen": 3000,
    "living_room": 2500,
    "window_cleaning": 2000,
    "carpet_cleaning": 4000,
    "oven_cleaning": 3500,
}
```

### 4.2 Dispatch Engine

**Location:** `backend/app/engines/dispatch_engine.py`

```
Input: job (service_type, location, scheduled_time, customer_preferences)

Algorithm:
  1. FILTER candidates:
     - available = true
     - service_type in janitor.services_offered
     - distance(job.location, janitor.location) < MAX_DISPATCH_RADIUS_KM (20)
     - janitor.trust_status = "verified"
     - active_jobs_count < MAX_ACTIVE_JOBS (5)

  2. SCORE each candidate:
     distance_score = max(0, 100 - (DISTANCE_DECAY_RATE * distance_km))
     quality_score = janitor.rating * 20  # normalize 0-5 to 0-100
     fairness_score = 100 - (recent_jobs_7d - avg_jobs_7d) * FAIRNESS_PENALTY
     skill_score = (matched_skills / required_skills) * 100
     preference_score = 100 if preferred_worker else 50

     total = (WEIGHT_DISTANCE * distance_score
            + WEIGHT_QUALITY * quality_score
            + WEIGHT_FAIRNESS * fairness_score
            + WEIGHT_SKILL * skill_score
            + WEIGHT_PREFERENCE * preference_score)

  3. RANK by total descending

  4. OFFER to top 3 candidates
     - Push notification with job details
     - 120-second acceptance window per candidate
     - Sequential offer (next candidate if declined/timeout)

  5. FALLBACK if no acceptance:
     - Expand radius to 30km
     - Relax fairness constraint
     - Notify customer of delay

Output: {assigned_janitor, score, distance_km, eta_minutes}
```

**Dispatch Constants:**

```python
# Dispatch Weights (must sum to 1.0)
WEIGHT_DISTANCE = 0.30
WEIGHT_QUALITY = 0.35
WEIGHT_FAIRNESS = 0.20
WEIGHT_SKILL = 0.10
WEIGHT_PREFERENCE = 0.05

# Dispatch Limits
MAX_DISPATCH_RADIUS_KM = 20
FALLBACK_RADIUS_KM = 30
MAX_ACTIVE_JOBS = 5
ACCEPTANCE_TIMEOUT_SECONDS = 120
MAX_OFFER_ATTEMPTS = 3
DISTANCE_DECAY_RATE = 5           # Points lost per km
FAIRNESS_PENALTY = 10             # Points lost per job above average

# Haversine
EARTH_RADIUS_KM = 6371.0
```

### 4.3 Trust & Security Module (Single Entity)

**Location:** `backend/app/engines/trust_engine.py` + `backend/app/services/trust_service.py`

The Trust Module is a unified system handling identity verification, trust scoring, and security enforcement. It is NOT split across files — it is one coherent module.

**Trust Score Formula:**

```
trust_score = (identity_weight × identity_score)
            + (punctuality_weight × punctuality_score)
            + (rating_weight × rating_score)

Where:
  identity_score: 0 (unverified) or 100 (verified via Dojah)
  punctuality_score: (on_time_jobs / total_jobs) × 100
  rating_score: (average_rating / 5.0) × 100

Weights: identity=0.4, punctuality=0.3, rating=0.3

Trust Tiers:
  PLATINUM: trust_score >= 90 (priority dispatch, higher earnings)
  GOLD:     trust_score >= 75 (standard access)
  SILVER:   trust_score >= 60 (limited jobs per day)
  PENDING:  identity not verified (no job access)
```

**Dojah Verification Flow:**

```
Step 1: Worker submits NIN (11 digits) or BVN (11 digits)
Step 2: Backend validates format (regex: ^\d{11}$)
Step 3: Backend calls Dojah Lookup API
         POST https://api.dojah.io/api/v1/kyc/nin
         Headers: {Authorization, AppId}
         Body: {nin: "12345678901"}
Step 4: Dojah returns identity data + photo
Step 5: Worker captures live selfie (liveness check)
Step 6: Backend calls Dojah Face Match API
         POST https://api.dojah.io/api/v1/kyc/face
         Body: {selfie_image, reference_image}
Step 7: Evaluate confidence:
         >= 90%: status = "verified"
         70-89%: status = "manual_review"
         < 70%:  status = "rejected"
Step 8: Store result (NEVER store raw NIN/BVN):
         {verification_id, status, confidence, verified_at, dojah_reference}
Step 9: Update janitor profile trust_status
Step 10: Log to audit_log table (immutable)
```

**Security Enforcement Middleware:**

```python
# Every job-related endpoint checks:
async def verify_trust_status(current_user):
    if current_user.role == "janitor":
        if current_user.trust_status != "verified":
            raise HTTPException(403, "Verification required")
        if current_user.trust_score < MIN_TRUST_SCORE:
            raise HTTPException(403, "Trust score too low")
```

---

## 5. Database Schema

### 5.1 Tables

**profiles** (extends Supabase auth.users)
```sql
id              UUID PRIMARY KEY (references auth.users.id)
email           VARCHAR NOT NULL
full_name       VARCHAR NOT NULL
phone           VARCHAR NOT NULL
address         TEXT
landmark        TEXT
city            VARCHAR
lat             FLOAT
lng             FLOAT
role            VARCHAR DEFAULT 'customer'  -- customer | janitor | admin
avatar_url      TEXT
is_registered   BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

**janitors**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE
name            VARCHAR NOT NULL
bio             TEXT
services_offered TEXT[] NOT NULL          -- ['house_cleaning', 'laundry']
available       BOOLEAN DEFAULT false
lat             FLOAT
lng             FLOAT
rating          FLOAT DEFAULT 0.0
total_ratings   INTEGER DEFAULT 0
total_jobs      INTEGER DEFAULT 0
trust_status    VARCHAR DEFAULT 'pending'  -- pending | verified | suspended
trust_score     FLOAT DEFAULT 0.0
verified_at     TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

**jobs**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
customer_id     UUID NOT NULL REFERENCES profiles(id)
janitor_id      UUID REFERENCES janitors(id)
service_type    VARCHAR NOT NULL
status          VARCHAR DEFAULT 'pending'
                -- pending | confirmed | in_progress | completed | cancelled | disputed
payment_status  VARCHAR DEFAULT 'unpaid'
                -- unpaid | pending | paid | refunded
pricing_mode    VARCHAR DEFAULT 'fixed'    -- fixed | dynamic | spatial
price_total     INTEGER                    -- in kobo (smallest unit)
price_breakdown JSONB                      -- {base, extras, surge, area_sqm, clutter}
room_data       JSONB                      -- {rooms: 3, toilets: 2}
extras          TEXT[]                     -- ['kitchen', 'window_cleaning']
address         TEXT NOT NULL
lat             FLOAT NOT NULL
lng             FLOAT NOT NULL
scheduled_date  DATE NOT NULL
scheduled_time  TIME NOT NULL
notes           TEXT
started_at      TIMESTAMPTZ
completed_at    TIMESTAMPTZ
cancelled_at    TIMESTAMPTZ
cancellation_reason TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

**messages**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE
sender_id       UUID NOT NULL REFERENCES profiles(id)
content         TEXT NOT NULL
read            BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
```

**verifications**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
janitor_id      UUID NOT NULL REFERENCES janitors(id) ON DELETE CASCADE
type            VARCHAR NOT NULL           -- nin | bvn | face_match
status          VARCHAR DEFAULT 'pending'  -- pending | verified | rejected | manual_review
confidence      FLOAT
dojah_reference VARCHAR                    -- external reference (NOT raw NIN)
verified_at     TIMESTAMPTZ
expires_at      TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
```

**reviews**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
job_id          UUID NOT NULL REFERENCES jobs(id)
customer_id     UUID NOT NULL REFERENCES profiles(id)
janitor_id      UUID NOT NULL REFERENCES janitors(id)
rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5)
comment         TEXT
created_at      TIMESTAMPTZ DEFAULT now()
```

**audit_log** (immutable — no UPDATE or DELETE)
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
actor_id        UUID NOT NULL REFERENCES profiles(id)
action          VARCHAR NOT NULL            -- job.created, verification.completed, etc.
resource_type   VARCHAR NOT NULL            -- job, janitor, verification
resource_id     UUID NOT NULL
metadata        JSONB                       -- {lat, lng, ip, user_agent}
created_at      TIMESTAMPTZ DEFAULT now()
```

**notifications**
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID NOT NULL REFERENCES profiles(id)
type            VARCHAR NOT NULL            -- job_offer, status_update, chat, verification
title           VARCHAR NOT NULL
body            TEXT NOT NULL
data            JSONB                       -- {job_id, screen, action}
read            BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ DEFAULT now()
```

### 5.2 Row Level Security (RLS) Policies

```sql
-- Users can only read/update their own profile
CREATE POLICY profiles_self ON profiles
  USING (auth.uid() = id);

-- Customers can read janitor profiles (public info only)
CREATE POLICY janitors_public_read ON janitors
  FOR SELECT USING (true);

-- Janitors can only update their own record
CREATE POLICY janitors_self_update ON janitors
  FOR UPDATE USING (profile_id = auth.uid());

-- Jobs: customers see their own, janitors see assigned
CREATE POLICY jobs_customer ON jobs
  FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY jobs_janitor ON jobs
  FOR SELECT USING (janitor_id IN (
    SELECT id FROM janitors WHERE profile_id = auth.uid()
  ));

-- Messages: only participants can read
CREATE POLICY messages_participants ON messages
  FOR SELECT USING (
    sender_id = auth.uid() OR
    job_id IN (SELECT id FROM jobs WHERE customer_id = auth.uid())
  );

-- Audit log: insert only, no read from client
CREATE POLICY audit_insert_only ON audit_log
  FOR INSERT WITH CHECK (true);
```

---

## 6. API Specification

### 6.1 Base URL & Versioning

```
Production:  https://api.janco.ng/v1
Development: http://localhost:8000/v1
```

All endpoints prefixed with `/v1/`. Responses follow consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed",
  "meta": { "page": 1, "per_page": 20, "total": 45 }
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [{"field": "email", "issue": "Invalid format"}]
  }
}
```

### 6.2 Authentication Endpoints

```
POST   /v1/auth/signup          # Register new user
POST   /v1/auth/login           # Login (email + password)
POST   /v1/auth/refresh         # Refresh JWT token
POST   /v1/auth/forgot-password # Request password reset
POST   /v1/auth/reset-password  # Complete password reset
POST   /v1/auth/logout          # Invalidate session
GET    /v1/auth/me              # Get current user profile
PATCH  /v1/auth/profile         # Update profile
```

### 6.3 Booking Endpoints

```
POST   /v1/bookings             # Create new booking
GET    /v1/bookings             # List user's bookings (paginated)
GET    /v1/bookings/:id         # Get booking details
PATCH  /v1/bookings/:id/status  # Update booking status
POST   /v1/bookings/:id/cancel  # Cancel booking (with reason)
POST   /v1/bookings/:id/review  # Submit review after completion
```

### 6.4 Pricing Endpoints

```
POST   /v1/pricing/estimate     # Get price estimate (heuristic)
POST   /v1/pricing/spatial      # Get price from room image (CV)
GET    /v1/pricing/rates        # Get current rate card
```

### 6.5 Janitor Endpoints

```
POST   /v1/janitors/register    # Apply to become a janitor
GET    /v1/janitors/nearby      # Find nearby available janitors
GET    /v1/janitors/:id         # Get janitor public profile
PATCH  /v1/janitors/availability # Toggle availability
GET    /v1/janitors/dashboard   # Janitor dashboard data
GET    /v1/janitors/earnings    # Earnings summary
```

### 6.6 Trust & Verification Endpoints

```
POST   /v1/trust/verify-nin     # Submit NIN for verification
POST   /v1/trust/verify-face    # Submit selfie for face match
GET    /v1/trust/status         # Get verification status
GET    /v1/trust/score/:id      # Get janitor trust score (public)
```

### 6.7 Chat Endpoints

```
GET    /v1/chat/:job_id/messages    # Get messages for a job
POST   /v1/chat/:job_id/messages    # Send a message
```

### 6.8 Job Endpoints (Janitor-facing)

```
GET    /v1/jobs/offers              # Get pending job offers
POST   /v1/jobs/:id/accept          # Accept job offer
POST   /v1/jobs/:id/decline         # Decline job offer
POST   /v1/jobs/:id/start           # Mark job as started
POST   /v1/jobs/:id/complete        # Mark job as completed
```

---

## 7. Frontend Specification

### 7.1 Design System

**Colors:**
```javascript
export const COLORS = {
  // Primary
  primary: '#1B5E20',       // Deep green (trust, nature, cleanliness)
  primaryLight: '#4CAF50',
  primaryDark: '#0D3B0F',

  // Accent
  accent: '#FF9800',        // Warm orange (energy, action)
  accentLight: '#FFB74D',

  // Neutrals
  background: '#FAFAFA',    // Light mode
  backgroundDark: '#121212', // Dark mode
  surface: '#FFFFFF',
  surfaceDark: '#1E1E1E',
  text: '#212121',
  textSecondary: '#757575',
  textOnPrimary: '#FFFFFF',

  // Semantic
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Trust Badge Colors
  verified: '#1B5E20',
  pending: '#FF9800',
  unverified: '#9E9E9E',
};
```

**Typography:**
```javascript
export const TYPOGRAPHY = {
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
};
```

**Spacing Scale:**
```javascript
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

**Touch Targets:** Minimum 48×48dp for all interactive elements (WCAG AA).

### 7.2 Screen Flows

**Customer Booking Flow (target: under 3 minutes, under 5 taps):**
```
HomeScreen → Select Service Card (tap 1)
  → BookingScreen → Fill rooms/date/time → "Get Estimate" (tap 2)
    → PriceEstimateScreen → Review price → "Find Janitor" (tap 3)
      → NearbyJanitorsScreen → Select janitor → "Confirm" (tap 4)
        → JobStatusScreen (tracking)
```

**Janitor Onboarding Flow:**
```
ProfileScreen → "Become a Janitor" (tap 1)
  → JanitorRegistrationScreen → Fill bio/services → Submit (tap 2)
    → VerificationScreen → Enter NIN → Take selfie → Submit (tap 3)
      → Pending approval screen (polls for status)
        → DashboardScreen (on approval)
```

### 7.3 Offline-First Strategy

**Network Status Hook:**
```javascript
// useNetwork.js
// Monitors NetInfo, shows OfflineBanner when disconnected
// Queues mutations (bookings, messages) for background sync
// Optimistic UI: show success immediately, sync later
```

**Offline Queue:**
```javascript
// useOfflineQueue.js
// Stores failed POST/PATCH requests in AsyncStorage
// On reconnect: replay queue in order
// On conflict: last-write-wins with timestamp comparison
// Max queue size: 50 items (prevent storage bloat)
```

**Data Caching:**
```
- Profile data: cache for 24 hours (rarely changes)
- Service rates: cache for 1 hour (may have surge pricing)
- Nearby janitors: no cache (location-dependent, real-time)
- Job status: Supabase Realtime subscription (no polling)
- Chat messages: Supabase Realtime subscription
```

### 7.4 Low-End Device Optimizations

```
Target device: Android, 2GB RAM, 3G network

Optimizations:
1. Image optimization: Resize to max 800px before upload, JPEG quality 70%
2. List virtualization: FlatList with windowSize=5 (render 5 screens worth)
3. Lazy loading: Import screens with React.lazy() for code splitting
4. Minimal re-renders: React.memo() on all list items, useCallback for handlers
5. Skeleton screens: Show placeholder while loading (perceived performance)
6. Compressed API responses: gzip from FastAPI
7. Pagination: 20 items per page, infinite scroll
8. Image placeholders: Show initials/icon while avatar loads
9. Debounced inputs: 300ms debounce on search/filter inputs
10. Memory management: Clear image cache on low memory warning
```

---

## 8. Trust & Security Module

### 8.1 Unified Architecture

The Trust & Security Module is a single, cohesive system — not scattered across files. It handles three concerns: Identity (who are you?), Reputation (how good are you?), and Enforcement (what can you do?).

```
TrustModule/
├── trust_engine.py      # Core scoring algorithm (pure functions, no I/O)
├── trust_service.py     # Orchestration (Dojah calls, DB updates, notifications)
├── trust_middleware.py   # FastAPI middleware (route protection)
└── trust_models.py      # Pydantic schemas for all trust-related data
```

### 8.2 Security Practices (From Day One)

**Authentication:**
- JWT tokens with 15-minute expiry + refresh tokens (7-day expiry)
- Refresh token rotation (old token invalidated on use)
- bcrypt password hashing (12 rounds)
- Rate limit: 5 login attempts per minute per IP

**API Security:**
- CORS: whitelist specific origins only (no wildcard)
- Helmet-equivalent headers (X-Content-Type-Options, X-Frame-Options)
- Input validation on every endpoint (Pydantic strict mode)
- Request size limit: 10MB
- Rate limiting: 100 requests/minute per user

**Data Security:**
- Never store raw NIN/BVN — only verification status + Dojah reference
- Supabase RLS on all tables
- Environment variables for all secrets (.env, never committed)
- Audit logging for all sensitive operations
- PII encryption at rest (Supabase pgcrypto)

**Frontend Security:**
- No secrets in client bundle (API URL only)
- Certificate pinning for API calls (production)
- Secure token storage (expo-secure-store)
- Auto-logout on token expiry
- Biometric lock option for app access

---

## 9. AI/ML Pipeline

### 9.1 Phase 1: Heuristic Pricing (Ship First)

Use the room-count + extras + surge formula. This is already partially implemented in `pricing.js`. Move it to backend, add validation, add surge logic.

### 9.2 Phase 2: CV Spatial Pricing (Research Feature)

**U-Net Floor Segmentation:**
- Architecture: 4-layer encoder-decoder with skip connections
- Input: 512×512×3 RGB
- Output: 512×512×1 binary mask
- Training data: ADE20K + NYU Depth V2 + 500 Nigerian interior images
- Target: IoU > 0.85
- Deployment: TensorFlow Lite (on-device) or backend API endpoint

**EfficientNet Clutter Classification:**
- Architecture: EfficientNet-B0 + custom head (Dense 256 → 128 → 3)
- Classes: Low, Medium, High clutter
- Training: 1500 images per class
- Target: Accuracy > 80%
- Deployment: Same as above

**Integration:**
- Camera capture → preprocess → segment → classify → price
- Confidence threshold: if confidence < 0.7, fall back to heuristic
- User sees both prices: "AI estimate" and "Standard estimate"

---

## 10. Engineering Standards

### 10.1 KISS (Keep It Simple, Stupid)

- No over-engineering. A service with 3 functions is better than a class hierarchy with 10 methods.
- Prefer flat structures over deep nesting. Max 3 levels of nesting in any function.
- If a function exceeds 30 lines, split it.
- If a file exceeds 300 lines, split it.
- Avoid premature abstraction. Write it twice before abstracting.

### 10.2 DRY (Don't Repeat Yourself)

- All constants in `constants/` (backend) or `constants/` (frontend). Zero magic numbers in business logic.
- Shared validators in `utils/validators.py` and `utils/validators.js`.
- Reusable UI components in `components/ui/`.
- API response formatting in one place: `utils/formatters.py`.
- Database queries in repositories, not in route handlers.

### 10.3 SOLID Principles

- **Single Responsibility:** Routes handle HTTP. Services handle logic. Repositories handle data. Engines handle algorithms.
- **Open/Closed:** New service types added via configuration (constants), not code changes.
- **Liskov Substitution:** Pricing modes (fixed, dynamic, spatial) share the same interface.
- **Interface Segregation:** Frontend hooks expose only what screens need.
- **Dependency Inversion:** Services depend on repository interfaces, not Supabase directly.

### 10.4 Comments & Documentation

```python
# BAD:
x = x + 1  # increment x

# GOOD:
# Expand search radius when no janitors found within default range
search_radius_km += RADIUS_INCREMENT_KM
```

**Rules:**
- Every function has a docstring explaining WHY it exists (not what it does — the name should say what).
- Complex algorithms have step-by-step comments.
- No commented-out code in production.
- TODO comments include a ticket/issue reference.

### 10.5 Error Handling

```python
# Backend: Structured error responses
class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        self.code = code
        self.message = message
        self.status = status

# Usage:
raise AppError("JANITOR_NOT_AVAILABLE", "This janitor is not currently available", 409)

# Global handler catches and formats consistently
```

```javascript
// Frontend: User-friendly error handling
// Never show raw API errors to users
// Map error codes to friendly messages:
const ERROR_MESSAGES = {
  JANITOR_NOT_AVAILABLE: "This cleaner isn't available right now. Try another.",
  BOOKING_CONFLICT: "This time slot is already taken. Pick another time.",
  NETWORK_ERROR: "Check your internet connection and try again.",
  TRUST_VERIFICATION_REQUIRED: "Please complete verification to continue.",
};
```

### 10.6 Naming Conventions

```
Backend (Python):
  Files:        snake_case.py
  Functions:    snake_case()
  Classes:      PascalCase
  Constants:    UPPER_SNAKE_CASE
  Variables:    snake_case

Frontend (JavaScript):
  Files:        PascalCase.jsx (components), camelCase.js (utilities)
  Functions:    camelCase()
  Components:   PascalCase
  Constants:    UPPER_SNAKE_CASE
  Hooks:        useCamelCase()
  API calls:    verbNoun() (e.g., fetchJanitors, createBooking)
```

### 10.7 Git Conventions

```
Branch naming: feature/pricing-engine, fix/booking-validation, refactor/auth-flow
Commit format: type(scope): description
  feat(pricing): add surge multiplier for peak hours
  fix(booking): validate date is in the future
  refactor(auth): move Supabase calls to backend
  test(dispatch): add unit tests for fairness scoring
```

---

## 11. Performance & Optimization

### 11.1 API Performance Targets

```
Endpoint Response Times (p95):
  Auth endpoints:           < 200ms
  Pricing estimate:         < 300ms
  Nearby janitors:          < 500ms
  Job creation:             < 400ms
  Chat messages:            < 200ms
  CV spatial pricing:       < 5000ms (model inference)
```

### 11.2 Frontend Performance Targets

```
App startup:                < 3 seconds (cold start on 3G)
Screen transitions:         < 300ms
List scroll:                60 FPS
Image load:                 < 2 seconds (with placeholder)
Bundle size:                < 15MB (APK)
Memory usage:               < 150MB peak
```

### 11.3 Network Optimization

```
- API responses: gzip compression (FastAPI middleware)
- Images: WebP format where supported, max 800px width
- Pagination: 20 items default, cursor-based for chat
- Caching: ETags for static data (rates, service types)
- Retry: exponential backoff (1s, 2s, 4s, max 3 retries)
- Timeout: 10 seconds for API calls, 30 seconds for image upload
```

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Backend:**
- [ ] Set up project structure (directories, config, constants)
- [ ] Fix requirements.txt (FastAPI, uvicorn, supabase, pydantic, python-dotenv, python-jose)
- [ ] Implement config.py (environment variables, settings)
- [ ] Implement Supabase client (single instance, connection pooling)
- [ ] Implement repository pattern (user_repo, job_repo, janitor_repo)
- [ ] Implement global error handler middleware
- [ ] Implement auth middleware (JWT validation)
- [ ] Implement auth routes (signup, login, refresh, logout, me, profile)
- [ ] Implement auth service (Supabase auth proxy, JWT issuance)

**Frontend:**
- [ ] Set up API client (fetch wrapper with auth headers, retry, error handling)
- [ ] Set up Zustand stores (auth, booking, job, ui)
- [ ] Refactor useAuth to call backend API (not Supabase directly)
- [ ] Set up constants (colors, spacing, typography, config)
- [ ] Implement OfflineBanner component
- [ ] Implement ScreenWrapper component (SafeArea + scroll + header)

**Database:**
- [ ] Create/update all tables with proper types and constraints
- [ ] Enable RLS on all tables
- [ ] Create RLS policies
- [ ] Add indexes on frequently queried columns (customer_id, janitor_id, status)

### Phase 2: Core Features (Week 3-4)

**Backend:**
- [ ] Implement pricing engine (heuristic: fixed + dynamic modes)
- [ ] Implement pricing routes (estimate, rates)
- [ ] Implement booking service (create, list, update, cancel)
- [ ] Implement booking routes
- [ ] Implement janitor routes (register, nearby, profile, availability)
- [ ] Implement location service (Haversine, ETA calculation)
- [ ] Implement dispatch engine (scoring algorithm)
- [ ] Implement job routes (offers, accept, decline, start, complete)

**Frontend:**
- [ ] Rebuild BookingScreen (clean, no business logic)
- [ ] Rebuild PriceEstimateScreen (fetch from API)
- [ ] Rebuild NearbyJanitorsScreen (fetch from API)
- [ ] Rebuild JobStatusScreen (Supabase Realtime, not polling)
- [ ] Build JanitorDashboardScreen (real data)
- [ ] Implement useNetwork hook + useOfflineQueue hook
- [ ] Build TrustBadge component
- [ ] Build RatingStars component

### Phase 3: Trust & Communication (Week 5-6)

**Backend:**
- [ ] Implement trust engine (trust score calculation)
- [ ] Implement trust service (Dojah API integration)
- [ ] Implement trust routes (verify-nin, verify-face, status, score)
- [ ] Implement trust middleware (route protection)
- [ ] Implement chat service
- [ ] Implement chat routes
- [ ] Implement notification service (FCM integration)
- [ ] Implement audit logging

**Frontend:**
- [ ] Build VerificationScreen (NIN input, selfie capture)
- [ ] Build ChatScreen (Supabase Realtime)
- [ ] Build NotificationsScreen
- [ ] Build BookingHistoryScreen
- [ ] Implement push notification handling
- [ ] Build review/rating flow (post-completion)

### Phase 4: Polish & Testing (Week 7-8)

**Backend:**
- [ ] Write unit tests (pricing engine, dispatch engine, trust engine)
- [ ] Write integration tests (all API endpoints)
- [ ] Load testing (100 concurrent users)
- [ ] Security audit (CORS, input validation, rate limiting)

**Frontend:**
- [ ] Accessibility audit (labels, touch targets, contrast)
- [ ] Performance profiling (memory, render time)
- [ ] Offline testing (airplane mode scenarios)
- [ ] UI polish (animations, transitions, error states, empty states)

### Phase 5: CV Module (Week 9-10, if time permits)

- [ ] Set up TensorFlow training pipeline
- [ ] Collect/label Nigerian interior images
- [ ] Train U-Net segmentation model
- [ ] Train EfficientNet classification model
- [ ] Convert to TensorFlow Lite
- [ ] Integrate into pricing API endpoint
- [ ] A/B test: heuristic vs spatial pricing

---

## 13. Testing Strategy

### 13.1 Unit Tests

```python
# test_pricing_engine.py
def test_fixed_price_house_cleaning_basic():
    result = calculate_fixed_price("house_cleaning", "basic")
    assert result == 24000

def test_dynamic_price_with_extras():
    result = calculate_dynamic_price(rooms=3, toilets=2, extras=["kitchen"])
    assert result == (3 * 1500) + (2 * 800) + 3000  # 9100

def test_surge_multiplier_peak():
    # Saturday 10am should be peak
    result = get_surge_multiplier(datetime(2026, 3, 7, 10, 0))
    assert result == 1.2

# test_dispatch_engine.py
def test_distance_score_at_zero():
    assert calculate_distance_score(0) == 100

def test_distance_score_at_max():
    assert calculate_distance_score(20) == 0

def test_fairness_penalizes_overworked():
    score = calculate_fairness_score(recent_jobs=10, avg_jobs=5)
    assert score < 100

# test_trust_engine.py
def test_trust_score_verified_janitor():
    score = calculate_trust_score(identity_verified=True, punctuality=0.95, rating=4.5)
    assert score >= 85

def test_unverified_janitor_capped():
    score = calculate_trust_score(identity_verified=False, punctuality=1.0, rating=5.0)
    assert score < 60  # identity weight pulls it down
```

### 13.2 Integration Tests

```python
# test_booking_routes.py
async def test_create_booking_success(auth_client):
    response = await auth_client.post("/v1/bookings", json={
        "service_type": "house_cleaning",
        "room_data": {"rooms": 3, "toilets": 2},
        "address": "12 Adeola Odeku, VI, Lagos",
        "lat": 6.4281, "lng": 3.4219,
        "scheduled_date": "2026-03-15",
        "scheduled_time": "10:00",
    })
    assert response.status_code == 201
    assert response.json()["data"]["status"] == "pending"

async def test_create_booking_past_date_fails(auth_client):
    response = await auth_client.post("/v1/bookings", json={
        "scheduled_date": "2020-01-01", ...
    })
    assert response.status_code == 400
    assert "future" in response.json()["error"]["message"].lower()
```

### 13.3 Usability Testing Protocol

```
Participants: 50-100 beta users (mix of tech-savvy and non-tech)
Tasks:
  1. Create account and complete profile (target: < 2 min)
  2. Book a house cleaning service (target: < 3 min)
  3. Find and select a nearby janitor (target: < 1 min)
  4. Check job status (target: < 30 sec)
  5. Send a chat message (target: < 1 min)

Metrics:
  - Task completion rate (target: > 90%)
  - Task completion time
  - Error rate (target: < 5%)
  - System Usability Scale score (target: > 70)
  - Net Promoter Score
```

---

## 14. Appendices

### A. Environment Variables

```env
# Backend (.env)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key    # For admin operations
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRY_MINUTES=15
REFRESH_TOKEN_EXPIRY_DAYS=7
DOJAH_APP_ID=your-dojah-app-id
DOJAH_SECRET_KEY=your-dojah-secret
DOJAH_BASE_URL=https://api.dojah.io
PAYSTACK_SECRET_KEY=your-paystack-secret
PAYSTACK_PUBLIC_KEY=your-paystack-public
FCM_SERVER_KEY=your-firebase-key
ENVIRONMENT=development                  # development | staging | production
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:19006       # Comma-separated

# Frontend (.env or app.json extra)
API_URL=http://localhost:8000/v1
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key          # Public key only
```

### B. Error Codes Reference

```
AUTH_001  Invalid credentials
AUTH_002  Token expired
AUTH_003  Refresh token invalid
AUTH_004  Account not verified

BOOKING_001  Invalid service type
BOOKING_002  Past date not allowed
BOOKING_003  No janitors available
BOOKING_004  Booking conflict (time slot taken)
BOOKING_005  Cannot cancel (already in progress)

PRICING_001  Invalid room data
PRICING_002  Service type not supported
PRICING_003  CV model inference failed (fallback to heuristic)

TRUST_001  NIN format invalid
TRUST_002  Dojah API unavailable
TRUST_003  Face match failed
TRUST_004  Verification expired
TRUST_005  Trust score below minimum

DISPATCH_001  No eligible janitors
DISPATCH_002  All offers declined
DISPATCH_003  Acceptance timeout

CHAT_001  Not a participant
CHAT_002  Job not active

GENERAL_001  Rate limit exceeded
GENERAL_002  Invalid request format
GENERAL_003  Server error (retry)
```

### C. Status Machine (Job Lifecycle)

```
                    ┌──────────┐
                    │ pending  │ ← job created by customer
                    └────┬─────┘
                         │ janitor assigned (dispatch)
                    ┌────▼─────┐
              ┌─────│confirmed │
              │     └────┬─────┘
   customer   │          │ janitor arrives + starts
   cancels    │     ┌────▼──────┐
              │     │in_progress│
              │     └────┬──────┘
              │          │ janitor marks done
              │     ┌────▼─────┐
              │     │completed │ → triggers review prompt
              │     └──────────┘
              │
         ┌────▼─────┐
         │cancelled │ (only from pending or confirmed)
         └──────────┘

Valid transitions:
  pending    → confirmed, cancelled
  confirmed  → in_progress, cancelled
  in_progress → completed
  completed  → (terminal)
  cancelled  → (terminal)
```

### D. Third-Party Integration Checklist

```
[ ] Supabase: Project created, tables, RLS, Realtime enabled
[ ] Dojah: Account created, API keys obtained, sandbox tested
[ ] Paystack: Account created, API keys, webhook URL configured
[ ] Firebase: FCM set up, service account for backend
[ ] Cloudinary: Account created, upload presets configured
[ ] Expo: EAS build configured, push notification credentials
```

---

*End of PRD. This document is the single source of truth for JANCO development.*
