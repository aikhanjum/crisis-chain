-- NGOs discovered by the scraper pipeline before they self-register.
-- Separate from `ngos` (which requires a wallet address).
-- When a discovered NGO registers on the platform, link via contact_email.
CREATE TABLE IF NOT EXISTS discovered_ngos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_name        TEXT NOT NULL,
    domain          TEXT NOT NULL,
    contact_email   TEXT,                    -- NULL if only MX-inferred
    email_source    TEXT NOT NULL DEFAULT 'scraped', -- 'scraped' | 'inferred' | 'manual'
    mx_host         TEXT,                    -- primary MX record host
    mail_provider   TEXT,                    -- 'google' | 'microsoft' | 'self-hosted' | 'bulk' | 'unknown'
    region_id       TEXT REFERENCES crisis_nodes(region_id) ON DELETE SET NULL,
    source_url      TEXT,                    -- ReliefWeb/HDX org page URL
    invite_sent_at  TIMESTAMPTZ,
    registered_at   TIMESTAMPTZ,             -- set when NGO completes wallet registration
    status          TEXT NOT NULL DEFAULT 'discovered', -- discovered | invited | registered
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (domain, region_id)               -- one entry per domain per region
);

CREATE INDEX IF NOT EXISTS discovered_ngos_region_idx  ON discovered_ngos (region_id);
CREATE INDEX IF NOT EXISTS discovered_ngos_status_idx  ON discovered_ngos (status);
CREATE INDEX IF NOT EXISTS discovered_ngos_email_idx   ON discovered_ngos (contact_email);

-- Extend registered ngos table with scraper-discovered metadata
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS domain          TEXT;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS email_source    TEXT;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS mx_host         TEXT;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS source_url      TEXT;
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS discovered_ngo_id UUID REFERENCES discovered_ngos(id);

-- ACLED raw event cache — avoids re-fetching on each cron tick
CREATE TABLE IF NOT EXISTS acled_events (
    event_id        TEXT PRIMARY KEY,
    event_date      DATE NOT NULL,
    event_type      TEXT NOT NULL,
    country         TEXT NOT NULL,
    iso3            TEXT,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    fatalities      INTEGER NOT NULL DEFAULT 0,
    notes           TEXT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS acled_events_country_idx    ON acled_events (country);
CREATE INDEX IF NOT EXISTS acled_events_event_date_idx ON acled_events (event_date DESC);
