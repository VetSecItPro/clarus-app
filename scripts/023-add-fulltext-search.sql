-- Full-text search indexes for Knowledge Library
-- This enables fast, relevance-ranked search across content

-- Add a generated tsvector column for full-text search on content table
-- Combines title and full_text with different weights (title gets higher weight)
ALTER TABLE content ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(full_text, '')), 'B')
  ) STORED;

-- Create GIN index on the search_vector for fast full-text queries
CREATE INDEX IF NOT EXISTS content_search_idx ON content USING GIN (search_vector);

-- Also create indexes on summaries for searching analysis content
-- Add search_vector to summaries table
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(brief_overview, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(detailed_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(mid_length_summary, '')), 'C')
  ) STORED;

-- Create GIN index on summaries search_vector
CREATE INDEX IF NOT EXISTS summaries_search_idx ON summaries USING GIN (search_vector);

-- Create a function to search content with full-text search
-- Returns content matching the search query with relevance ranking
CREATE OR REPLACE FUNCTION search_user_content(
  p_user_id uuid,
  p_query text,
  p_content_type text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
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
  ORDER BY relevance DESC, c.date_added DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_user_content TO authenticated;

-- Create a simpler function for autocomplete/suggestions
-- Returns just titles matching the query prefix
CREATE OR REPLACE FUNCTION search_content_suggestions(
  p_user_id uuid,
  p_query text,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (c.title)
    c.id,
    c.title,
    c.type
  FROM content c
  WHERE c.user_id = p_user_id
    AND (
      c.title ILIKE p_query || '%'
      OR c.search_vector @@ to_tsquery('english', p_query || ':*')
    )
  ORDER BY c.title, c.date_added DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_content_suggestions TO authenticated;
