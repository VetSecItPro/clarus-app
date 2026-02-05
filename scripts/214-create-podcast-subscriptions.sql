-- Migration: 214 - Create podcast subscriptions and episodes tables
-- Feature: Podcast RSS feed monitoring (#25)

-- 1. podcast_subscriptions table
CREATE TABLE IF NOT EXISTS clarus.podcast_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feed_url TEXT NOT NULL,
    podcast_name TEXT NOT NULL,
    podcast_image_url TEXT,
    last_checked_at TIMESTAMPTZ,
    last_episode_date TIMESTAMPTZ,
    check_frequency_hours INTEGER DEFAULT 6,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, feed_url)
);

-- 2. podcast_episodes table
CREATE TABLE IF NOT EXISTS clarus.podcast_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES clarus.podcast_subscriptions(id) ON DELETE CASCADE,
    episode_title TEXT NOT NULL,
    episode_url TEXT NOT NULL,
    episode_date TIMESTAMPTZ,
    duration_seconds INTEGER,
    description TEXT,
    is_notified BOOLEAN DEFAULT false,
    content_id UUID REFERENCES clarus.content(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(subscription_id, episode_url)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_podcast_subscriptions_user_id
    ON clarus.podcast_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_subscription_id
    ON clarus.podcast_episodes(subscription_id);

CREATE INDEX IF NOT EXISTS idx_podcast_episodes_is_notified
    ON clarus.podcast_episodes(is_notified)
    WHERE is_notified = false;

-- 4. Enable RLS
ALTER TABLE clarus.podcast_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarus.podcast_episodes ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for podcast_subscriptions
CREATE POLICY "Users can view own subscriptions"
    ON clarus.podcast_subscriptions FOR SELECT
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own subscriptions"
    ON clarus.podcast_subscriptions FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own subscriptions"
    ON clarus.podcast_subscriptions FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own subscriptions"
    ON clarus.podcast_subscriptions FOR DELETE
    USING (user_id = (SELECT auth.uid()));

-- 6. RLS policies for podcast_episodes
-- Users can view episodes for their own subscriptions
CREATE POLICY "Users can view episodes of own subscriptions"
    ON clarus.podcast_episodes FOR SELECT
    USING (
        subscription_id IN (
            SELECT id FROM clarus.podcast_subscriptions
            WHERE user_id = (SELECT auth.uid())
        )
    );

-- Users can update episodes (e.g., link content_id after analysis)
CREATE POLICY "Users can update episodes of own subscriptions"
    ON clarus.podcast_episodes FOR UPDATE
    USING (
        subscription_id IN (
            SELECT id FROM clarus.podcast_subscriptions
            WHERE user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        subscription_id IN (
            SELECT id FROM clarus.podcast_subscriptions
            WHERE user_id = (SELECT auth.uid())
        )
    );

-- Service role inserts episodes via cron (no user-level insert policy needed)
-- The cron route uses the service role key which bypasses RLS
