"""
Auto-migration runner.

Executes CREATE TABLE IF NOT EXISTS for every table on startup.
Safe to run on every boot — IF NOT EXISTS is a no-op when tables exist.
"""

from app.db.pool import get_pool

_SCHEMA = """
CREATE TABLE IF NOT EXISTS profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT,
    full_name       TEXT,
    phone           TEXT,
    avatar_url      TEXT,
    role            TEXT NOT NULL DEFAULT 'customer'
                        CHECK (role IN ('customer', 'janitor', 'admin')),
    address         TEXT,
    landmark        TEXT,
    lat             DOUBLE PRECISION,
    lng             DOUBLE PRECISION,
    push_token      TEXT,
    is_registered   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email      ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role       ON profiles(role);
-- Composite index for admin stats: role + created_at for monthly new-customer counts
CREATE INDEX IF NOT EXISTS idx_profiles_role_created
  ON profiles (role, created_at DESC);

CREATE TABLE IF NOT EXISTS janitors (
    id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    phone           TEXT,
    address         TEXT,
    service_types   TEXT[]      NOT NULL DEFAULT '{}',
    experience      TEXT,
    bio             TEXT,
    availability    BOOLEAN     NOT NULL DEFAULT FALSE,
    is_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMPTZ,
    trust_score     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    trust_tier      TEXT        NOT NULL DEFAULT 'Pending',
    avg_rating      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    punctuality_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    approval_status TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE janitors ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_janitors_availability ON janitors(availability);
CREATE INDEX IF NOT EXISTS idx_janitors_is_verified  ON janitors(is_verified);
CREATE INDEX IF NOT EXISTS idx_janitors_approval     ON janitors(approval_status);

-- Composite index for the dispatch query: covers availability + verification + service filter
CREATE INDEX IF NOT EXISTS idx_janitors_dispatch
  ON janitors (availability, is_verified, approval_status);

CREATE TABLE IF NOT EXISTS jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id),
    janitor_id      UUID REFERENCES janitors(id),
    service_type    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
    payment_status  TEXT NOT NULL DEFAULT 'unpaid'
                        CHECK (payment_status IN ('unpaid','pending','paid','refunded')),
    scheduled_date  TEXT,
    scheduled_time  TEXT,
    address         TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    rooms           INTEGER NOT NULL DEFAULT 1,
    toilets         INTEGER NOT NULL DEFAULT 0,
    extras          JSONB,
    notes           TEXT,
    price           INTEGER,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id    ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_janitor_id ON jobs(janitor_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Composite indexes for paginated queries with status filter + ordering
CREATE INDEX IF NOT EXISTS idx_jobs_user_status_date
  ON jobs (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_janitor_status_date
  ON jobs (janitor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created
  ON jobs (status, created_at DESC);

-- Double-booking prevention: a janitor can have at most ONE active job.
-- "Active" = confirmed or in_progress. Multiple pending assignments are
-- allowed (janitor reviews queue); only one can be confirmed at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_janitor_one_active
  ON jobs (janitor_id)
  WHERE janitor_id IS NOT NULL
    AND status IN ('confirmed', 'in_progress');

CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES profiles(id),
    content     TEXT NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_job_id     ON messages(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id  ON messages(sender_id);

CREATE TABLE IF NOT EXISTS ratings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL REFERENCES jobs(id),
    janitor_id  UUID NOT NULL REFERENCES janitors(id),
    user_id     UUID NOT NULL REFERENCES profiles(id),
    score       INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    comment     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_janitor_id ON ratings(janitor_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id    ON ratings(user_id);

CREATE TABLE IF NOT EXISTS verifications (
    janitor_id  UUID PRIMARY KEY REFERENCES janitors(id) ON DELETE CASCADE,
    id_type     TEXT,
    dojah_ref   TEXT,
    status      TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started','id_verified','id_failed','liveness_failed','verified')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_scans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id),
    job_id          UUID REFERENCES jobs(id),
    estimated_area  DOUBLE PRECISION NOT NULL,
    room_size       TEXT NOT NULL
                        CHECK (room_size IN ('small','medium','large','xl')),
    clutter_level   TEXT NOT NULL
                        CHECK (clutter_level IN ('minimal','moderate','heavy','extreme')),
    clutter_score   DOUBLE PRECISION NOT NULL,
    price_modifier  DOUBLE PRECISION NOT NULL,
    confidence      DOUBLE PRECISION NOT NULL,
    analysis_mode   TEXT NOT NULL DEFAULT 'heuristic'
                        CHECK (analysis_mode IN ('heuristic','heuristic_fallback','photo_estimate','ai','dimensions')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transport_fee INTEGER NOT NULL DEFAULT 0;

-- Account suspension support (added in account-management feature)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_inactive ON profiles (id) WHERE is_active = FALSE;

-- Tiered admin authorization: super_admin / admin / viewer (NULL for non-admins).
-- role stays 'admin' for all three tiers so existing role checks keep working.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_level TEXT
    CHECK (admin_level IN ('super_admin','admin','viewer'));
-- Bootstrap: promote any pre-existing admin lacking a level to super_admin
-- so the first/legacy admin retains full access after this migration.
UPDATE profiles SET admin_level = 'super_admin'
    WHERE role = 'admin' AND admin_level IS NULL;

-- Legal acceptance (Terms & Privacy) captured at signup
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS terms_version TEXT;

-- Broadcast messaging log (admin → users/janitors email + push) for audit/transparency
CREATE TABLE IF NOT EXISTS broadcasts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel     TEXT NOT NULL CHECK (channel IN ('email','push','both')),
    audience    TEXT NOT NULL,           -- all_customers | all_janitors | all_users | specific_user
    target_id   UUID,                    -- set when audience = specific_user
    subject     TEXT,                    -- email subject / push title
    body        TEXT NOT NULL,
    sent_count  INTEGER NOT NULL DEFAULT 0,
    sent_by     UUID NOT NULL REFERENCES profiles(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts (created_at DESC);

-- Manual expense ledger for the financial dashboard (janitor payouts are auto-derived,
-- not stored here — this tracks non-payout costs: marketing, salary, operations, etc.)
CREATE TABLE IF NOT EXISTS expenses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category     TEXT NOT NULL CHECK (category IN ('marketing','salary','operations','refund','other')),
    description  TEXT NOT NULL,
    amount       INTEGER NOT NULL,        -- Naira, same unit as jobs.price
    incurred_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by  UUID NOT NULL REFERENCES profiles(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_incurred ON expenses (incurred_on DESC);

CREATE TABLE IF NOT EXISTS pricing_config (
    key         TEXT PRIMARY KEY,
    value       NUMERIC NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pricing_config (key, value, description)
SELECT * FROM (VALUES
    ('room_rate',               1000,  'Standard cleaning: ₦ per room'),
    ('toilet_rate',              500,  'Standard cleaning: ₦ per toilet'),
    ('deep_cleaning_room_rate', 3000,  'Deep cleaning: ₦ per room'),
    ('kitchen_extra',           2000,  'Add-on: kitchen'),
    ('living_room_extra',       1500,  'Add-on: living room'),
    ('window_cleaning_extra',   1000,  'Add-on: window cleaning'),
    ('laundry_per_item',         300,  'Laundry: ₦ per item'),
    ('laundry_ironing',          500,  'Laundry: ₦ per ironing item'),
    ('laundry_delicates',        100,  'Laundry: delicates surcharge per item'),
    ('fumigation_flat',        10000,  'Fumigation: flat rate'),
    ('scan_rate_per_sqm',        100,  'Scan mode: ₦ per m² of room area'),
    ('transport_threshold_km',     5,  'Distance (km) before transport fee kicks in'),
    ('transport_band_km',          5,  'km interval per transport band'),
    ('transport_band_fee',      1000,  '₦ added per transport band'),
    ('surge_peak',               1.2,  'Surge multiplier: weekends/evenings'),
    ('surge_holiday',            1.5,  'Surge multiplier: public holidays'),
    ('price_floor',             5000,  'Minimum charge (set to 0 to disable)'),
    ('price_ceiling',         200000,  'Maximum charge')
) AS t(key, value, description)
WHERE NOT EXISTS (SELECT 1 FROM pricing_config LIMIT 1);

-- Platform commission rate (added with the financial dashboard). Inserted
-- idempotently so it lands even when pricing_config was seeded earlier.
INSERT INTO pricing_config (key, value, description)
VALUES ('platform_commission_rate', 0.20,
        'Platform commission on completed jobs (0.20 = 20%; janitor keeps the rest)')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_room_scans_user_id ON room_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_room_scans_job_id  ON room_scans(job_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    family_id   UUID NOT NULL,
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    user_agent  TEXT,
    ip_address  INET
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id   ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id ON refresh_tokens(family_id);

CREATE TABLE IF NOT EXISTS password_resets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

-- Scheduled-reminder idempotency log. The UNIQUE(job_id, kind) constraint lets
-- the reminder loop "claim" a slot atomically (INSERT ... ON CONFLICT DO NOTHING)
-- so each reminder is sent exactly once, even across multiple worker processes.
CREATE TABLE IF NOT EXISTS notification_log (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id    UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    kind      TEXT NOT NULL,              -- '24h' | 'same_day_morning' | 'same_day_soon'
    sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_notification_log_job ON notification_log(job_id);
"""


async def run_migrations() -> None:
    """Run CREATE TABLE IF NOT EXISTS for all tables. Safe to call on every startup."""
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(_SCHEMA)
