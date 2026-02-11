-- Migration 216: Atomic usage enforcement
-- Replaces TOCTOU two-step (check → increment) with single atomic operation.
-- The UPDATE ... WHERE count < limit ensures no concurrent requests can both
-- pass the limit check — the row-level lock serializes them.

SET search_path TO clarus, public;

CREATE OR REPLACE FUNCTION increment_usage_if_allowed(
  p_user_id UUID,
  p_period TEXT,
  p_field TEXT,
  p_limit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clarus, public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Upsert the tracking row (creates if first action this period)
  INSERT INTO usage_tracking (user_id, period, analyses_count, chat_messages_count, share_links_count, exports_count, bookmarks_count, podcast_analyses_count)
  VALUES (p_user_id, p_period, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id, period) DO NOTHING;

  -- Atomically check limit AND increment in one UPDATE.
  -- If count >= limit, WHERE clause fails, zero rows update, v_new_count stays NULL.
  IF p_field = 'analyses_count' THEN
    UPDATE usage_tracking SET analyses_count = analyses_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period AND analyses_count < p_limit
    RETURNING analyses_count INTO v_new_count;
  ELSIF p_field = 'chat_messages_count' THEN
    UPDATE usage_tracking SET chat_messages_count = chat_messages_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period AND chat_messages_count < p_limit
    RETURNING chat_messages_count INTO v_new_count;
  ELSIF p_field = 'share_links_count' THEN
    UPDATE usage_tracking SET share_links_count = share_links_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period AND share_links_count < p_limit
    RETURNING share_links_count INTO v_new_count;
  ELSIF p_field = 'exports_count' THEN
    UPDATE usage_tracking SET exports_count = exports_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period AND exports_count < p_limit
    RETURNING exports_count INTO v_new_count;
  ELSIF p_field = 'bookmarks_count' THEN
    UPDATE usage_tracking SET bookmarks_count = bookmarks_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period AND bookmarks_count < p_limit
    RETURNING bookmarks_count INTO v_new_count;
  ELSIF p_field = 'podcast_analyses_count' THEN
    UPDATE usage_tracking SET podcast_analyses_count = podcast_analyses_count + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND period = p_period AND podcast_analyses_count < p_limit
    RETURNING podcast_analyses_count INTO v_new_count;
  ELSE
    RAISE EXCEPTION 'Unknown usage field: %', p_field;
  END IF;

  -- NULL means the WHERE clause didn't match (at or over limit)
  IF v_new_count IS NULL THEN
    RETURN -1;
  END IF;

  RETURN v_new_count;
END;
$$;

-- Restrict access: only service_role can call this
REVOKE EXECUTE ON FUNCTION increment_usage_if_allowed(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_usage_if_allowed(UUID, TEXT, TEXT, INTEGER) TO service_role;
