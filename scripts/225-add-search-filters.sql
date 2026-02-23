-- Migration 225: Add bookmark + tag filters to full-text search RPC
-- Fixes: PERF-API-002
-- Eliminates client-side post-filtering in search mode
SET search_path TO clarus, public, extensions;

CREATE OR REPLACE FUNCTION search_user_content(
  p_user_id uuid,
  p_query text,
  p_content_type text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_bookmark_only boolean DEFAULT false,
  p_tags text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  url text,
  type text,
  thumbnail_url text,
  date_added timestamptz,
  is_bookmarked boolean,
  tags text[],
  brief_overview text,
  triage jsonb,
  relevance real
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title::text,
    c.url::text,
    c.type::text,
    c.thumbnail_url::text,
    c.date_added,
    c.is_bookmarked,
    c.tags,
    s.brief_overview,
    s.triage,
    ts_rank(c.search_vector, websearch_to_tsquery('english', p_query)) +
    COALESCE(ts_rank(s.search_vector, websearch_to_tsquery('english', p_query)), 0) AS relevance
  FROM content c
  LEFT JOIN summaries s ON s.content_id = c.id
  WHERE c.user_id = p_user_id
    AND (
      c.search_vector @@ websearch_to_tsquery('english', p_query)
      OR s.search_vector @@ websearch_to_tsquery('english', p_query)
    )
    AND (p_content_type IS NULL OR c.type = p_content_type)
    AND (NOT p_bookmark_only OR c.is_bookmarked = true)
    AND (p_tags IS NULL OR c.tags && p_tags)
  ORDER BY relevance DESC, c.date_added DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = clarus, extensions;
