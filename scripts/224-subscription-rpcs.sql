-- Migration 224: Subscription RPCs for due-check filtering + latest episode/video
-- Fixes: PERF-DB-008, PERF-DB-009, PERF-SCALE-002, PERF-SCALE-003
-- Pushes time-based filtering and DISTINCT ON to SQL instead of JS post-processing
SET search_path TO clarus, public, extensions;

-- Returns podcast subscriptions that are due for a feed check
-- Replaces: SELECT * WHERE is_active=true LIMIT 200 + JS filter by check_frequency_hours
CREATE OR REPLACE FUNCTION get_due_podcast_subscriptions(
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  feed_url text,
  podcast_name text,
  last_checked_at timestamptz,
  check_frequency_hours int,
  last_episode_date timestamptz,
  consecutive_failures int,
  feed_auth_header_encrypted text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.id, ps.user_id, ps.feed_url, ps.podcast_name,
    ps.last_checked_at, ps.check_frequency_hours,
    ps.last_episode_date, ps.consecutive_failures,
    ps.feed_auth_header_encrypted
  FROM podcast_subscriptions ps
  WHERE ps.is_active = true
    AND (
      ps.last_checked_at IS NULL
      OR ps.last_checked_at < NOW() - make_interval(hours => COALESCE(ps.check_frequency_hours, 24))
    )
  ORDER BY ps.last_checked_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = clarus, extensions;

-- Returns YouTube subscriptions that are due for a feed check
CREATE OR REPLACE FUNCTION get_due_youtube_subscriptions(
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  feed_url text,
  channel_name text,
  last_checked_at timestamptz,
  check_frequency_hours int,
  last_video_date timestamptz,
  consecutive_failures int
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ys.id, ys.user_id, ys.feed_url, ys.channel_name,
    ys.last_checked_at, ys.check_frequency_hours,
    ys.last_video_date, ys.consecutive_failures
  FROM youtube_subscriptions ys
  WHERE ys.is_active = true
    AND (
      ys.last_checked_at IS NULL
      OR ys.last_checked_at < NOW() - make_interval(hours => COALESCE(ys.check_frequency_hours, 24))
    )
  ORDER BY ys.last_checked_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = clarus, extensions;

-- Returns the latest episode per subscription using DISTINCT ON
-- Replaces: .limit(n*2) + JS first-per-group pattern
CREATE OR REPLACE FUNCTION get_latest_podcast_episodes(
  p_sub_ids uuid[]
)
RETURNS TABLE (
  subscription_id uuid,
  episode_title text,
  episode_date timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (pe.subscription_id)
    pe.subscription_id,
    pe.episode_title,
    pe.episode_date
  FROM podcast_episodes pe
  WHERE pe.subscription_id = ANY(p_sub_ids)
  ORDER BY pe.subscription_id, pe.episode_date DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = clarus, extensions;

-- Returns the latest video per subscription using DISTINCT ON
CREATE OR REPLACE FUNCTION get_latest_youtube_videos(
  p_sub_ids uuid[]
)
RETURNS TABLE (
  subscription_id uuid,
  video_title text,
  video_date timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (yv.subscription_id)
    yv.subscription_id,
    yv.video_title,
    yv.published_date AS video_date
  FROM youtube_videos yv
  WHERE yv.subscription_id = ANY(p_sub_ids)
  ORDER BY yv.subscription_id, yv.published_date DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = clarus, extensions;
