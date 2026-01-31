-- Migration: Create flagged_content table for content moderation
-- Stores content that was flagged by pre-screening or AI refusal
-- Required for NCMEC reporting under 18 U.S.C. § 2258A
-- Date: 2026-01-31

SET search_path TO clarus, public, extensions;

CREATE TABLE IF NOT EXISTS flagged_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was flagged
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  content_type TEXT,                -- youtube, article, pdf, x_post

  -- How it was flagged
  flag_source TEXT NOT NULL,        -- url_screening, keyword_screening, ai_refusal
  flag_reason TEXT NOT NULL,        -- Human-readable description of why
  flag_categories TEXT[] NOT NULL DEFAULT '{}', -- csam, terrorism, weapons, trafficking
  severity TEXT NOT NULL,           -- critical (CSAM), high (terrorism/weapons), medium (other)

  -- Evidence preservation (required for CSAM reporting)
  user_ip TEXT,                     -- IP of the submitting user
  content_hash TEXT,                -- SHA-256 of scraped content (if available)
  scraped_text_preview TEXT,        -- First 500 chars of flagged text (for review)

  -- Review workflow
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, reviewed, reported, dismissed
  review_notes TEXT,
  reviewed_by TEXT,                 -- Admin user ID who reviewed
  reviewed_at TIMESTAMPTZ,

  -- Reporting (NCMEC / law enforcement)
  reported_to TEXT,                 -- ncmec, fbi_ic3, other
  report_reference TEXT,            -- CyberTipline report ID or reference number
  reported_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flagged_content_status ON flagged_content(status);
CREATE INDEX IF NOT EXISTS idx_flagged_content_severity ON flagged_content(severity);
CREATE INDEX IF NOT EXISTS idx_flagged_content_created ON flagged_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flagged_content_user ON flagged_content(user_id);

-- RLS: Only admins can access flagged content (via service role key in API)
ALTER TABLE flagged_content ENABLE ROW LEVEL SECURITY;

-- No public policies — this table is only accessed via service role key
-- This ensures no user can see flagged content through the client SDK
