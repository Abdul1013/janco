# JANCO AI Agent Directive — System Context & Engineering Standards

**Version:** 3.0 | **Updated:** March 15, 2026 | **Status:** Sprint 4 Complete (v1.0.0-beta)

> JANCO is an AI-powered gig-economy platform for domestic cleaning services in Nigeria.
> See `JANCO_PRD.md` for the full Product Requirements Document.
> See `backend/API.md` for complete endpoint documentation.

---

## 1. Architecture Overview

```
Frontend (React Native 0.81 + Expo SDK 54)
  → API Client (fetch wrapper with JWT auto-inject, 401 refresh, exponential backoff)
    → FastAPI Backend (routes → services → engines → repositories)
      → Supabase (PostgreSQL + RLS + Realtime)
      → External: Dojah (identity verification), Expo Push (notifications)
```

### Clean Architecture Layers
```
Routes (HTTP handlers)  →  parse request, call service, format response
Services (orchestration) →  business logic, cross-cutting concerns
Engines (pure compute)   →  pricing, dispatch, trust scoring (no I/O)
Repositories (data)      →  Supabase CRUD queries
```

---

## 2. Directory Structure (Final)

### Backend (`backend/app/`)
```
app/
├── main.py                          — FastAPI entry, CORS whitelist, 7 routers
├── config.py                        — Pydantic settings from .env
├── db/supabase_client.py            — Singleton Supabase client
├── engines/
│   ├── pricing_engine.py            — Fixed + dynamic pricing, floor/ceiling
│   ├── dispatch_engine.py           — Multi-objective scored ranking
│   └── trust_engine.py              — T = 0.4*I + 0.3*P + 0.3*R
├── middleware/
│   ├── auth.py                      — JWT verification dependency
│   ├── rate_limiter.py              — Token bucket: 100/min, 5/min auth
│   └── error_handler.py             — Structured errors, no stack trace leak
├── repositories/
│   ├── user_repo.py                 — Profiles CRUD
│   ├── job_repo.py                  — Jobs CRUD + status transitions
│   ├── janitor_repo.py              — Janitors CRUD + trust updates
│   └── message_repo.py             — Chat messages CRUD
├── routes/
│   ├── auth_routes.py               — 8 endpoints (signup, login, etc.)
│   ├── booking_routes.py            — 5 endpoints (create, list, status)
│   ├── pricing_routes.py            — 1 endpoint (estimate)
│   ├── janitor_routes.py            — 4 endpoints (nearby, register, etc.)
│   ├── chat_routes.py               — 2 endpoints (send, get messages)
│   ├── rating_routes.py             — 2 endpoints (submit, get ratings)
│   └── verification_routes.py       — 3 endpoints (initiate, liveness, status)
├── schema/
│   ├── user_schema.py               — UserCreate, ProfileUpdate, etc.
│   ├── job_schema.py                — JobCreate, JobStatus enum, transitions
│   └── chat_schema.py               — MessageCreate
├── services/
│   ├── booking_service.py           — Booking orchestration + notifications
│   ├── janitor_service.py           — Dispatch + registration + availability
│   ├── pricing_service.py           — Price estimate orchestration
│   ├── verification_service.py      — 3-step Dojah verification flow
│   └── notification_service.py      — Expo push + FCM integration
└── tests/
    ├── test_pricing_engine.py       — 12 tests
    ├── test_trust_engine.py         — 11 tests
    └── test_dispatch_engine.py      — 11 tests
```

### Frontend (`frontend/App/`)
```
App/
├── api/
│   ├── client.js                    — Fetch wrapper: JWT, 401 refresh, retry
│   ├── config.js                    — API_BASE_URL, timeouts
│   ├── authApi.js                   — Auth endpoints
│   ├── bookingApi.js                — Booking endpoints
│   ├── pricingApi.js                — Pricing endpoints
│   ├── janitorApi.js                — Janitor endpoints
│   ├── chatApi.js                   — Chat endpoints
│   ├── ratingApi.js                 — Rating endpoints
│   └── verificationApi.js           — Verification endpoints
├── store/
│   ├── authStore.js                 — Zustand: auth, tokens, profile
│   ├── bookingStore.js              — Zustand: multi-step booking state
│   └── networkStore.js              — NetInfo: online/offline, mutation queue
├── hooks/
│   ├── useAuth.js                   — Backward-compatible auth hook
│   ├── authContext.js               — Context wrapper for useAuth
│   ├── useJob.js                    — Job polling via bookingApi
│   ├── useJanitors.js               — Janitor data via janitorApi
│   ├── useChat.js                   — Chat + Supabase Realtime subscription
│   └── useNotifications.js          — Expo push registration + deep linking
├── constants/
│   ├── theme/
│   │   ├── colors.js                — MD3 light/dark palette
│   │   ├── typography.js            — MD3 type scale
│   │   ├── spacing.js               — 4px base grid
│   │   ├── elevation.js             — MD3 levels 0-5
│   │   └── ThemeContext.js           — ThemeProvider + useTheme() + AsyncStorage
│   └── services.js                  — SERVICE_TYPES definitions
├── components/ui/
│   ├── ScreenWrapper.jsx            — SafeAreaView + ScrollView + StatusBar
│   ├── AppButton.jsx                — MD3 filled/outlined/text, 48dp
│   ├── AppText.jsx                  — Theme-aware text with variant
│   ├── AppInput.jsx                 — MD3 outlined text field
│   ├── AppCard.jsx                  — MD3 elevated card
│   ├── Skeleton.jsx                 — Loading placeholders
│   ├── EmptyState.jsx               — Empty list states
│   ├── ErrorBoundary.jsx            — JS error boundary
│   └── OfflineBanner.jsx            — Animated offline indicator
├── components/job/
│   └── StatusTimeline.jsx           — Vertical job status steps
├── navigation/
│   ├── RootNavigator.jsx            — Auth/Main stack split + deep linking
│   └── TabNavigator.jsx             — Bottom tabs: Home, Clean, Profile
└── screens/
    ├── auth/
    │   ├── LoginScreen.jsx
    │   ├── SignupScreen.jsx
    │   ├── ForgetPasswordScreen.jsx
    │   ├── UpdatePasswordScreen.jsx
    │   └── RegistrationScreen.jsx
    ├── HomeScreen.jsx
    ├── BookingScreen.jsx            — 4-step progressive disclosure
    ├── PriceEstimateScreen.jsx
    ├── NearbyJanitorsScreen.jsx
    ├── JobStatusScreen.jsx
    ├── ChatScreen.jsx
    ├── ProfileScreen.jsx
    ├── RatingScreen.jsx             — 5-star rating + comment
    ├── SplashScreen.jsx
    ├── AuthCallbackScreen.jsx
    └── Janitor/
        ├── JanitorDashBoardScreen.jsx
        ├── JanitorRegistrationScreen.jsx
        ├── JanitorStatusScreen.jsx
        └── VerificationScreen.jsx   — 3-step ID verification
```

---

## 3. Three Core Engines (Pure Computation)

### Pricing Engine
- Fixed pricing: base rates per service type × room/toilet count + extras
- Dynamic pricing: surge multiplier based on demand (normal/peak/holiday)
- Floor: ₦5,000 | Ceiling: ₦200,000

### Dispatch Engine
- Score = 0.30×Distance + 0.35×Quality + 0.20×Fairness + 0.10×Skill + 0.05×Preference
- Haversine distance calculation, 30km max radius
- Filters: availability, verification status, service type match

### Trust Engine
- T = 0.40×Identity + 0.30×Punctuality + 0.30×Rating
- Tiers: Platinum (>0.90), Gold (0.75-0.90), Silver (0.50-0.75), Pending (<0.50)
- Recalculated on: new rating, verification completion

---

## 4. Security Posture (Audited)

- [x] CORS restricted to whitelist (no wildcard)
- [x] JWT required on all protected endpoints
- [x] Rate limiting: 100/min general, 5/min auth
- [x] No raw NIN/BVN stored (only Dojah reference + status)
- [x] .env not in version control
- [x] No supabase.from() mutations in frontend
- [x] Input validation (Pydantic) on all endpoints
- [x] Error responses never leak stack traces
- [x] Supabase RLS on all tables

---

## 5. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Zustand over Context | Simpler API, no provider nesting, selector-based re-renders |
| Offline-first queue | Nigerian infrastructure: 2G/3G, unreliable power |
| Backend-as-proxy | No frontend mutations; all writes through FastAPI |
| Supabase Realtime (chat only) | Read-only subscription; all message sends go through API |
| Progressive disclosure booking | 4-step wizard reduces cognitive load |
| MD3 + HIG | Material Design 3 tokens + Apple 48dp touch targets |
| Dojah mock mode | Sandbox for beta; production switch via env var |
| Expo Push over raw FCM | Simpler integration for React Native + Expo |

---

## 6. Resolved Issues

All 10 critical issues from the initial audit are resolved:

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | pricing.js in frontend (271 lines) | Deleted; logic in backend pricing_engine.py |
| 2 | Direct supabase.from() in screens | All replaced with API calls via api/ modules |
| 3 | CORS wildcard | Restricted to localhost origins |
| 4 | Duplicate Supabase clients | Single client in db/supabase_client.py |
| 5 | requirements.txt listed Django | Fixed to FastAPI + deps |
| 6 | .env credentials exposed | .gitignore updated, secrets via env vars |
| 7 | Job polling (10s interval) | Kept with push notification supplement |
| 8 | No input validation on status | JobStatus enum + VALID_TRANSITIONS map |
| 9 | Hardcoded dummy data | All screens fetch from API |
| 10 | No error boundaries | ErrorBoundary.jsx wraps app |

---

## 7. Job Status Lifecycle

```
pending → confirmed → in_progress → completed
pending → cancelled
confirmed → cancelled
```

Push notifications fire on every transition for both customer and janitor.

---

*v3.0 — Reflects completed Sprint 1-4 architecture. See API.md for endpoint docs.*
