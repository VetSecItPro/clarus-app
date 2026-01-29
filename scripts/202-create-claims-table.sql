-- Migration: Create claims table with pg_trgm similarity matching
SET search_path TO clarus, public, extensions;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claim_text text NOT NULL,
    normalized_text text NOT NULL,
    status varchar(20) NOT NULL,
    severity varchar(10),
    sources jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claims_user_id_idx ON claims(user_id);
CREATE INDEX IF NOT EXISTS claims_content_id_idx ON claims(content_id);
CREATE INDEX IF NOT EXISTS claims_normalized_text_trgm_idx
  ON claims USING GIN (normalized_text extensions.gin_trgm_ops);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own claims" ON claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert claims" ON claims FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION find_similar_claims(
    p_user_id uuid,
    p_claim_text text,
    p_content_id uuid,
    p_threshold float DEFAULT 0.4,
    p_limit int DEFAULT 10
)
RETURNS TABLE (
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
        cl.id, cl.content_id, c.title::text,
        cl.claim_text, cl.status,
        extensions.similarity(
          cl.normalized_text,
          lower(regexp_replace(p_claim_text, '[^a-zA-Z0-9\s]', '', 'g'))
        )::float
    FROM claims cl
    JOIN content c ON c.id = cl.content_id
    WHERE cl.user_id = p_user_id
      AND cl.content_id != p_content_id
      AND extensions.similarity(
            cl.normalized_text,
            lower(regexp_replace(p_claim_text, '[^a-zA-Z0-9\s]', '', 'g'))
          ) > p_threshold
    ORDER BY similarity_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
