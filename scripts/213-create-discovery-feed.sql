-- Migration: 213-create-discovery-feed.sql
-- Description: Add discovery feed with voting and public content opt-in
-- Tables: clarus.content_votes (new), clarus.content (alter)

-- 1. Add is_public and vote_score columns to content
ALTER TABLE clarus.content
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vote_score INTEGER DEFAULT 0;

-- 2. Create content_votes table
CREATE TABLE IF NOT EXISTS clarus.content_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES clarus.content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(content_id, user_id)
);

-- 3. Enable RLS on content_votes
ALTER TABLE clarus.content_votes ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for content_votes
-- Anyone authenticated can read votes
CREATE POLICY "content_votes_select_authenticated"
  ON clarus.content_votes
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own votes
CREATE POLICY "content_votes_insert_own"
  ON clarus.content_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can update their own votes
CREATE POLICY "content_votes_update_own"
  ON clarus.content_votes
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete their own votes
CREATE POLICY "content_votes_delete_own"
  ON clarus.content_votes
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Service role full access
CREATE POLICY "content_votes_service_role"
  ON clarus.content_votes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. RLS policy for public content visibility (on clarus.content)
-- Authenticated users can view public content from any user
CREATE POLICY "content_select_public"
  ON clarus.content
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_public_vote_score
  ON clarus.content (is_public, vote_score DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_content_votes_content_id
  ON clarus.content_votes (content_id);

CREATE INDEX IF NOT EXISTS idx_content_votes_user_id
  ON clarus.content_votes (user_id);
