-- Add ReliefWeb active-disaster enrichment columns to crisis_nodes.
-- These are purely additive — existing rows get empty defaults.

ALTER TABLE crisis_nodes
    ADD COLUMN IF NOT EXISTS active_disasters      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS reliefweb_last_updated TIMESTAMPTZ;
