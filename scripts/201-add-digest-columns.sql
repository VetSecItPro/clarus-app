-- Migration: Add digest preference columns to users table
SET search_path TO clarus, public, extensions;

ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_at timestamptz;
