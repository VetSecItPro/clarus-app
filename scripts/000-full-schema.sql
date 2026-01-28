-- Vajra Truth Checker - Full Database Schema
-- This file contains everything needed to set up a fresh Supabase database
-- Run this ONCE on a new database, then run the numbered migrations in order

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- =============================================================================
-- TABLES
-- =============================================================================

-- Users table (synced with Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email varchar,
    name varchar,
    level integer DEFAULT 1,
    xp integer DEFAULT 0,
    reputation integer DEFAULT 0,
    is_admin boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    global_knowledge text,
    global_secret_sauce text,
    stripe_customer_id text,
    subscription_status text DEFAULT 'none',
    subscription_id text,
    subscription_ends_at timestamptz,
    CONSTRAINT users_name_key UNIQUE (name)
);

-- Content table (URLs submitted for analysis)
CREATE TABLE IF NOT EXISTS content (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    url varchar NOT NULL,
    type varchar,
    title text,
    full_text text,
    date_added timestamptz DEFAULT now(),
    author text,
    duration integer,
    thumbnail_url text,
    description text,
    raw_youtube_metadata jsonb,
    upload_date timestamptz,
    view_count bigint,
    like_count bigint,
    channel_id text,
    transcript_languages text[],
    status text NOT NULL DEFAULT 'pending',
    is_bookmarked boolean DEFAULT false,
    tags text[] DEFAULT '{}',
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(full_text, '')), 'B')
    ) STORED
);

-- Summaries table (AI-generated analysis)
CREATE TABLE IF NOT EXISTS summaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    mid_length_summary text,
    brief_overview text,
    triage jsonb,
    truth_check jsonb,
    detailed_summary text,
    processing_status text DEFAULT 'pending',
    updated_at timestamptz DEFAULT now(),
    action_items jsonb,
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(brief_overview, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(detailed_summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(mid_length_summary, '')), 'C')
    ) STORED
);

-- Content ratings (user feedback on content quality)
CREATE TABLE IF NOT EXISTS content_ratings (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    content_id uuid REFERENCES content(id) ON DELETE CASCADE,
    signal_score integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, content_id)
);

-- Chat threads (per content item, per user)
CREATE TABLE IF NOT EXISTS chat_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(content_id, user_id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Hidden content (user-hidden items)
CREATE TABLE IF NOT EXISTS hidden_content (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, content_id)
);

-- Domain statistics
CREATE TABLE IF NOT EXISTS domains (
    domain text PRIMARY KEY,
    total_analyses integer DEFAULT 0,
    total_quality_score double precision DEFAULT 0,
    avg_quality_score double precision,
    accurate_count integer DEFAULT 0,
    mostly_accurate_count integer DEFAULT 0,
    mixed_count integer DEFAULT 0,
    questionable_count integer DEFAULT 0,
    unreliable_count integer DEFAULT 0,
    first_seen timestamptz DEFAULT now(),
    last_seen timestamptz DEFAULT now()
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    content_id varchar,
    api_name varchar NOT NULL,
    operation varchar,
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    estimated_cost_usd numeric DEFAULT 0,
    response_time_ms integer,
    status varchar DEFAULT 'success',
    error_message text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Processing metrics
CREATE TABLE IF NOT EXISTS processing_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_id uuid REFERENCES summaries(id) ON DELETE CASCADE,
    content_id varchar,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    section_type varchar NOT NULL,
    model_name varchar,
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    processing_time_ms integer,
    retry_count integer DEFAULT 0,
    status varchar DEFAULT 'success',
    error_message text,
    created_at timestamptz DEFAULT now()
);

-- Active chat prompt (singleton config)
CREATE TABLE IF NOT EXISTS active_chat_prompt (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    system_content text NOT NULL,
    model_name text NOT NULL,
    temperature numeric,
    top_p numeric,
    max_tokens integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Active summarizer prompt (singleton config)
CREATE TABLE IF NOT EXISTS active_summarizer_prompt (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    system_content text NOT NULL,
    user_content_template text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    temperature double precision,
    top_p double precision,
    max_tokens integer,
    model_name text NOT NULL DEFAULT 'anthropic/claude-3.5-sonnet'
);

-- Analysis prompts (per-section AI prompts)
CREATE TABLE IF NOT EXISTS analysis_prompts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_type text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    system_content text NOT NULL,
    user_content_template text NOT NULL,
    model_name text NOT NULL DEFAULT 'anthropic/claude-3.5-sonnet',
    temperature double precision DEFAULT 0.7,
    max_tokens integer DEFAULT 2000,
    expect_json boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    use_web_search boolean DEFAULT true
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Content indexes
CREATE INDEX IF NOT EXISTS content_user_id_idx ON content(user_id);
CREATE INDEX IF NOT EXISTS content_date_added_idx ON content(date_added DESC);
CREATE INDEX IF NOT EXISTS content_search_idx ON content USING GIN (search_vector);

-- Summaries indexes
CREATE INDEX IF NOT EXISTS summaries_content_id_idx ON summaries(content_id);
CREATE INDEX IF NOT EXISTS summaries_user_id_idx ON summaries(user_id);
CREATE INDEX IF NOT EXISTS summaries_search_idx ON summaries USING GIN (search_vector);

-- Chat indexes
CREATE INDEX IF NOT EXISTS chat_threads_content_id_idx ON chat_threads(content_id);
CREATE INDEX IF NOT EXISTS chat_threads_user_id_idx ON chat_threads(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_thread_id_idx ON chat_messages(thread_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_content ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Content policies
CREATE POLICY "Users can view their own content" ON content FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own content" ON content FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own content" ON content FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own content" ON content FOR DELETE USING (auth.uid() = user_id);

-- Summaries policies (public read for shared content)
CREATE POLICY "Anyone can view summaries" ON summaries FOR SELECT USING (true);
CREATE POLICY "Users can insert summaries for their content" ON summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own summaries" ON summaries FOR UPDATE USING (auth.uid() = user_id);

-- Content ratings policies
CREATE POLICY "Users can view all ratings" ON content_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert their own ratings" ON content_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ratings" ON content_ratings FOR UPDATE USING (auth.uid() = user_id);

-- Chat threads policies
CREATE POLICY "Users can view their own threads" ON chat_threads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own threads" ON chat_threads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own threads" ON chat_threads FOR DELETE USING (auth.uid() = user_id);

-- Chat messages policies (through thread ownership)
CREATE POLICY "Users can view messages in their threads" ON chat_messages FOR SELECT
    USING (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = auth.uid()));
CREATE POLICY "Users can insert messages in their threads" ON chat_messages FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = auth.uid()));

-- Hidden content policies
CREATE POLICY "Users can view their hidden list" ON hidden_content FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can hide content" ON hidden_content FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unhide content" ON hidden_content FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to get user's analyzed content with summaries (for chat context)
CREATE OR REPLACE FUNCTION get_brain_content(p_user_id uuid, p_content_id uuid)
RETURNS TABLE (
    content_id uuid,
    content_title text,
    content_url text,
    content_type text,
    content_full_text text,
    summary_brief_overview text,
    summary_mid_length text,
    summary_detailed text,
    summary_triage jsonb,
    summary_truth_check jsonb,
    summary_action_items jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.title,
        c.url,
        c.type,
        c.full_text,
        s.brief_overview,
        s.mid_length_summary,
        s.detailed_summary,
        s.triage,
        s.truth_check,
        s.action_items
    FROM content c
    LEFT JOIN summaries s ON s.content_id = c.id
    WHERE c.id = p_content_id AND c.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for full-text search
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

-- Function for search suggestions
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

-- Function to upsert domain statistics
CREATE OR REPLACE FUNCTION upsert_domain_stats(
    p_domain text,
    p_quality_score double precision,
    p_truth_rating text
)
RETURNS void AS $$
BEGIN
    INSERT INTO domains (domain, total_analyses, total_quality_score, avg_quality_score,
        accurate_count, mostly_accurate_count, mixed_count, questionable_count, unreliable_count)
    VALUES (
        p_domain,
        1,
        p_quality_score,
        p_quality_score,
        CASE WHEN p_truth_rating = 'Accurate' THEN 1 ELSE 0 END,
        CASE WHEN p_truth_rating = 'Mostly Accurate' THEN 1 ELSE 0 END,
        CASE WHEN p_truth_rating = 'Mixed' THEN 1 ELSE 0 END,
        CASE WHEN p_truth_rating = 'Questionable' THEN 1 ELSE 0 END,
        CASE WHEN p_truth_rating = 'Unreliable' THEN 1 ELSE 0 END
    )
    ON CONFLICT (domain) DO UPDATE SET
        total_analyses = domains.total_analyses + 1,
        total_quality_score = domains.total_quality_score + p_quality_score,
        avg_quality_score = (domains.total_quality_score + p_quality_score) / (domains.total_analyses + 1),
        accurate_count = domains.accurate_count + CASE WHEN p_truth_rating = 'Accurate' THEN 1 ELSE 0 END,
        mostly_accurate_count = domains.mostly_accurate_count + CASE WHEN p_truth_rating = 'Mostly Accurate' THEN 1 ELSE 0 END,
        mixed_count = domains.mixed_count + CASE WHEN p_truth_rating = 'Mixed' THEN 1 ELSE 0 END,
        questionable_count = domains.questionable_count + CASE WHEN p_truth_rating = 'Questionable' THEN 1 ELSE 0 END,
        unreliable_count = domains.unreliable_count + CASE WHEN p_truth_rating = 'Unreliable' THEN 1 ELSE 0 END,
        last_seen = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tag management functions
CREATE OR REPLACE FUNCTION add_tag_to_content(p_content_id uuid, p_tag text)
RETURNS void AS $$
BEGIN
    UPDATE content
    SET tags = array_append(COALESCE(tags, '{}'), lower(trim(p_tag)))
    WHERE id = p_content_id
    AND NOT (COALESCE(tags, '{}') @> ARRAY[lower(trim(p_tag))]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION remove_tag_from_content(p_content_id uuid, p_tag text)
RETURNS void AS $$
BEGIN
    UPDATE content
    SET tags = array_remove(COALESCE(tags, '{}'), lower(trim(p_tag)))
    WHERE id = p_content_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION get_brain_content TO authenticated;
GRANT EXECUTE ON FUNCTION search_user_content TO authenticated;
GRANT EXECUTE ON FUNCTION search_content_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_domain_stats TO authenticated;
GRANT EXECUTE ON FUNCTION add_tag_to_content TO authenticated;
GRANT EXECUTE ON FUNCTION remove_tag_from_content TO authenticated;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-create user record on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger should be created on auth.users, which requires running in Supabase dashboard:
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert default chat prompt
INSERT INTO active_chat_prompt (id, system_content, model_name, temperature, max_tokens)
VALUES (1,
'You are Vajra, an AI assistant helping users understand content they''ve analyzed. You have access to the full analysis including overview, key takeaways, truth check, and action items. Be helpful, accurate, and cite specific sections when relevant.',
'anthropic/claude-sonnet-4',
0.7,
2000
) ON CONFLICT (id) DO NOTHING;

-- Note: Analysis prompts and summarizer prompt should be inserted using backup-prompts-pre-rewrite.sql
-- or by running the prompt update scripts separately
