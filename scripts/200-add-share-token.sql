-- Migration: Add share_token column to content table for shareable links
SET search_path TO clarus, public, extensions;

ALTER TABLE content ADD COLUMN IF NOT EXISTS share_token varchar(16) UNIQUE;
CREATE INDEX IF NOT EXISTS content_share_token_idx ON content(share_token) WHERE share_token IS NOT NULL;
