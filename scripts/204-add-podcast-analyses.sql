-- Migration: Add podcast analysis support
-- Adds podcast_analyses_count to usage_tracking and podcast_transcript_id to content

-- 1. Add podcast_analyses_count to usage_tracking (independent from analyses_count)
ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS podcast_analyses_count INTEGER NOT NULL DEFAULT 0;

-- 2. Add podcast_transcript_id to content (stores AssemblyAI transcript job ID)
ALTER TABLE content
  ADD COLUMN IF NOT EXISTS podcast_transcript_id TEXT NULL;

-- 3. Update increment_usage function to handle the new field
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id UUID,
  p_period TEXT,
  p_field TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Upsert the usage tracking row
  INSERT INTO usage_tracking (user_id, period, analyses_count, chat_messages_count, share_links_count, exports_count, bookmarks_count, podcast_analyses_count)
  VALUES (p_user_id, p_period, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id, period) DO NOTHING;

  -- Increment the specified field
  IF p_field = 'analyses_count' THEN
    UPDATE usage_tracking SET analyses_count = analyses_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period
    RETURNING analyses_count INTO v_new_count;
  ELSIF p_field = 'chat_messages_count' THEN
    UPDATE usage_tracking SET chat_messages_count = chat_messages_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period
    RETURNING chat_messages_count INTO v_new_count;
  ELSIF p_field = 'share_links_count' THEN
    UPDATE usage_tracking SET share_links_count = share_links_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period
    RETURNING share_links_count INTO v_new_count;
  ELSIF p_field = 'exports_count' THEN
    UPDATE usage_tracking SET exports_count = exports_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period
    RETURNING exports_count INTO v_new_count;
  ELSIF p_field = 'bookmarks_count' THEN
    UPDATE usage_tracking SET bookmarks_count = bookmarks_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period
    RETURNING bookmarks_count INTO v_new_count;
  ELSIF p_field = 'podcast_analyses_count' THEN
    UPDATE usage_tracking SET podcast_analyses_count = podcast_analyses_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period
    RETURNING podcast_analyses_count INTO v_new_count;
  ELSE
    RAISE EXCEPTION 'Unknown usage field: %', p_field;
  END IF;

  RETURN v_new_count;
END;
$$;
