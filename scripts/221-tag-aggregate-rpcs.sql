-- Migration 221: Tag aggregate RPCs
-- Fixes: PERF-DB-003, PERF-DB-004, PERF-SCALE-004
-- Replaces 500-row and 5000-row JS aggregation with single-query SQL using unnest(tags)
SET search_path TO clarus, public, extensions;

-- Returns tag counts for a user's content (replaces /api/tags JS aggregation)
CREATE OR REPLACE FUNCTION get_user_tag_counts(
  p_user_id uuid,
  p_limit int DEFAULT 50
)
RETURNS TABLE (tag text, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT t.tag, COUNT(*)::bigint AS count
  FROM content c,
       unnest(c.tags) AS t(tag)
  WHERE c.user_id = p_user_id
    AND c.tags IS NOT NULL
    AND array_length(c.tags, 1) > 0
  GROUP BY t.tag
  ORDER BY count DESC, t.tag ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = clarus, extensions;

-- Returns count of unique tags across a user's library (replaces 5000-row fetch + JS Set)
CREATE OR REPLACE FUNCTION count_unique_user_tags(
  p_user_id uuid
)
RETURNS int AS $$
DECLARE
  tag_count int;
BEGIN
  SELECT COUNT(DISTINCT t.tag)::int INTO tag_count
  FROM content c,
       unnest(c.tags) AS t(tag)
  WHERE c.user_id = p_user_id
    AND c.tags IS NOT NULL
    AND array_length(c.tags, 1) > 0;

  RETURN COALESCE(tag_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = clarus, extensions;
