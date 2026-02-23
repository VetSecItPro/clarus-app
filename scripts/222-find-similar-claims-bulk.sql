-- Migration 222: Bulk claims similarity RPC
-- Fixes: PERF-DB-002
-- Replaces 20 individual find_similar_claims RPCs with 1 bulk call
SET search_path TO clarus, public, extensions;

CREATE OR REPLACE FUNCTION find_similar_claims_bulk(
  p_user_id uuid,
  p_claim_texts text[],
  p_content_id uuid,
  p_threshold float DEFAULT 0.4,
  p_limit_per_claim int DEFAULT 5
)
RETURNS TABLE (
  source_claim_index int,
  source_claim_text text,
  claim_id uuid,
  content_id uuid,
  content_title text,
  claim_text text,
  status varchar,
  similarity_score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.idx::int AS source_claim_index,
    q.claim_text AS source_claim_text,
    ranked.claim_id,
    ranked.content_id,
    ranked.content_title,
    ranked.claim_text,
    ranked.status,
    ranked.similarity_score
  FROM unnest(p_claim_texts) WITH ORDINALITY AS q(claim_text, idx)
  CROSS JOIN LATERAL (
    SELECT
      cl.id AS claim_id,
      cl.content_id,
      c.title::text AS content_title,
      cl.claim_text,
      cl.status,
      extensions.similarity(
        cl.normalized_text,
        lower(regexp_replace(q.claim_text, '[^a-zA-Z0-9\s]', '', 'g'))
      )::float AS similarity_score
    FROM claims cl
    JOIN content c ON c.id = cl.content_id
    WHERE cl.user_id = p_user_id
      AND cl.content_id != p_content_id
      AND extensions.similarity(
            cl.normalized_text,
            lower(regexp_replace(q.claim_text, '[^a-zA-Z0-9\s]', '', 'g'))
          ) > p_threshold
    ORDER BY similarity_score DESC
    LIMIT p_limit_per_claim
  ) AS ranked;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = clarus, extensions;
