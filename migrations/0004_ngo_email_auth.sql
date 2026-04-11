-- Add email/password auth support to NGO accounts
ALTER TABLE ngos ADD COLUMN IF NOT EXISTS password_hash TEXT;
