-- Migration: Add tier column to users + usage tracking table
SET search_path TO clarus, public, extensions;

-- Add tier column to users (free by default)
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier varchar(20) DEFAULT 'free';

-- Monthly usage tracking
CREATE TABLE IF NOT EXISTS usage_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period varchar(7) NOT NULL, -- '2026-01' format (YYYY-MM)
    analyses_count integer DEFAULT 0,
    chat_messages_count integer DEFAULT 0,
    share_links_count integer DEFAULT 0,
    exports_count integer DEFAULT 0,
    bookmarks_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, period)
);

CREATE INDEX IF NOT EXISTS usage_tracking_user_period_idx ON usage_tracking(user_id, period);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage usage" ON usage_tracking FOR ALL WITH CHECK (true);

-- Function to increment usage counter atomically
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id uuid,
    p_period varchar,
    p_field varchar
)
RETURNS integer AS $$
DECLARE
    new_count integer;
BEGIN
    INSERT INTO usage_tracking (user_id, period)
    VALUES (p_user_id, p_period)
    ON CONFLICT (user_id, period) DO NOTHING;

    IF p_field = 'analyses_count' THEN
        UPDATE usage_tracking SET analyses_count = analyses_count + 1, updated_at = now()
        WHERE user_id = p_user_id AND period = p_period
        RETURNING analyses_count INTO new_count;
    ELSIF p_field = 'chat_messages_count' THEN
        UPDATE usage_tracking SET chat_messages_count = chat_messages_count + 1, updated_at = now()
        WHERE user_id = p_user_id AND period = p_period
        RETURNING chat_messages_count INTO new_count;
    ELSIF p_field = 'share_links_count' THEN
        UPDATE usage_tracking SET share_links_count = share_links_count + 1, updated_at = now()
        WHERE user_id = p_user_id AND period = p_period
        RETURNING share_links_count INTO new_count;
    ELSIF p_field = 'exports_count' THEN
        UPDATE usage_tracking SET exports_count = exports_count + 1, updated_at = now()
        WHERE user_id = p_user_id AND period = p_period
        RETURNING exports_count INTO new_count;
    ELSIF p_field = 'bookmarks_count' THEN
        UPDATE usage_tracking SET bookmarks_count = bookmarks_count + 1, updated_at = now()
        WHERE user_id = p_user_id AND period = p_period
        RETURNING bookmarks_count INTO new_count;
    ELSE
        RAISE EXCEPTION 'Unknown field: %', p_field;
    END IF;

    RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
