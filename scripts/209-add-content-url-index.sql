-- Add partial index on content URL for cross-user cache lookups
-- Only indexes rows with populated full_text (the exact query pattern used)
SET search_path TO clarus, public, extensions;

CREATE INDEX CONCURRENTLY IF NOT EXISTS content_url_fulltext_idx
  ON clarus.content (url)
  WHERE full_text IS NOT NULL;
