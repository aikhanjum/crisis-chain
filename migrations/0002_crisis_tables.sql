-- Crisis regions populated by the crisis-intelligence service
CREATE TABLE IF NOT EXISTS crisis_nodes (
    region_id       TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    country         TEXT NOT NULL,
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    severity_score  NUMERIC(5, 1) NOT NULL DEFAULT 0,
    severity_level  TEXT NOT NULL DEFAULT 'low',  -- low | medium | high | critical
    summary         TEXT NOT NULL DEFAULT '',      -- AI-generated, set by ai-summary service
    donate_copy     TEXT NOT NULL DEFAULT '',      -- "Your donation funds..." copy
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_links    TEXT[] NOT NULL DEFAULT '{}',
    active_ngos     INTEGER NOT NULL DEFAULT 0,
    pool_id         NUMERIC(78, 0),               -- blockchain pool ID, NULL until deployed
    pool_address    TEXT                           -- deployed contract address
);

CREATE INDEX IF NOT EXISTS crisis_nodes_severity_idx ON crisis_nodes (severity_score DESC);
CREATE INDEX IF NOT EXISTS crisis_nodes_country_idx ON crisis_nodes (country);

-- NGOs approved for reimbursement in a region
CREATE TABLE IF NOT EXISTS ngos (
    wallet_address   TEXT PRIMARY KEY,
    org_name         TEXT NOT NULL,
    country          TEXT,
    reg_number       TEXT,
    operated_regions TEXT[] NOT NULL DEFAULT '{}', -- region_ids they operate in
    contact_email    TEXT,
    status           TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | suspended
    approved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reimbursement requests submitted by NGOs
CREATE TABLE IF NOT EXISTS receipt_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ngo_wallet      TEXT NOT NULL REFERENCES ngos(wallet_address),
    region_id       TEXT NOT NULL REFERENCES crisis_nodes(region_id),
    requested_amount NUMERIC(20, 6) NOT NULL,  -- in USDC
    approved_amount  NUMERIC(20, 6),
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | paid
    item_notes      TEXT NOT NULL DEFAULT '',   -- e.g. "42x water filters, 10x first aid kits"
    receipt_ipfs    TEXT,                        -- IPFS CID of receipt image
    raw_ocr_text    TEXT,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at    TIMESTAMPTZ,
    payout_tx_hash  TEXT                         -- on-chain tx hash when paid
);

CREATE INDEX IF NOT EXISTS receipt_requests_ngo_idx ON receipt_requests (ngo_wallet);
CREATE INDEX IF NOT EXISTS receipt_requests_region_idx ON receipt_requests (region_id);
CREATE INDEX IF NOT EXISTS receipt_requests_status_idx ON receipt_requests (status);

-- Approved items list — admin-editable without code deploys
CREATE TABLE IF NOT EXISTS approved_items (
    id          SERIAL PRIMARY KEY,
    keyword     TEXT NOT NULL UNIQUE,
    category    TEXT NOT NULL,    -- food | water_sanitation | medicine | shelter_materials | hygiene_supplies
    approved    BOOLEAN NOT NULL DEFAULT TRUE,
    notes       TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
