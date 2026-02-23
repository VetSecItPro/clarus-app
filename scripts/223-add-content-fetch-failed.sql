-- Migration 223: Add fetch_failed column to content
-- Fixes: PERF-DB-001
-- Allows library SELECT to exclude full_text (50-100KB/row) by checking fetch_failed instead
SET search_path TO clarus, public, extensions;

-- Add columns
ALTER TABLE content ADD COLUMN IF NOT EXISTS fetch_failed boolean DEFAULT false;
ALTER TABLE content ADD COLUMN IF NOT EXISTS fetch_failure_reason text;

-- Backfill from existing PROCESSING_FAILED entries
UPDATE content
SET fetch_failed = true,
    fetch_failure_reason = full_text
WHERE full_text LIKE 'PROCESSING_FAILED::%';

-- Partial index for efficient lookup of failed content per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_user_fetch_failed
  ON content (user_id, fetch_failed) WHERE fetch_failed = true;
