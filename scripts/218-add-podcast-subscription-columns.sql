-- Migration: 218 - Add missing podcast subscription columns
-- These columns are referenced in the codebase but were not in migration 214.
-- They may already exist in the live database (added manually).
-- This migration uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for safety.

-- 1. consecutive_failures: tracks feed check failures for auto-deactivation
ALTER TABLE clarus.podcast_subscriptions
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;

-- 2. last_error: stores the most recent feed check error message
ALTER TABLE clarus.podcast_subscriptions
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 3. feed_auth_header_encrypted: encrypted credentials for private/premium feeds
ALTER TABLE clarus.podcast_subscriptions
  ADD COLUMN IF NOT EXISTS feed_auth_header_encrypted TEXT;

-- 4. credentials_updated_at: when feed credentials were last updated
ALTER TABLE clarus.podcast_subscriptions
  ADD COLUMN IF NOT EXISTS credentials_updated_at TIMESTAMPTZ;
