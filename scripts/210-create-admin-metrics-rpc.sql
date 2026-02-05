-- Migration: Create get_admin_metrics() RPC function
-- Consolidates 22 individual Supabase queries from /api/admin/metrics into a single DB call
-- Applied via: mcp__supabase__apply_migration (name: "create_admin_metrics_rpc")
-- Date: 2026-02-04

SET search_path TO clarus, public, extensions;

CREATE OR REPLACE FUNCTION clarus.get_admin_metrics(p_time_range_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = clarus, extensions
AS $$
DECLARE
  result JSONB;
  v_now TIMESTAMPTZ := now();
  v_today TIMESTAMPTZ := date_trunc('day', v_now);
  v_range_start TIMESTAMPTZ := v_now - (p_time_range_days || ' days')::INTERVAL;
  v_prev_start TIMESTAMPTZ := v_now - (p_time_range_days * 2 || ' days')::INTERVAL;
  v_prev_end TIMESTAMPTZ := v_now - (p_time_range_days || ' days')::INTERVAL;
  v_7days_ago TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_90days_ago TIMESTAMPTZ := v_now - INTERVAL '90 days';
BEGIN
  SELECT jsonb_build_object(
    -- ===== USER METRICS =====
    'total_users', (SELECT count(*) FROM users),
    'new_users_today', (SELECT count(*) FROM users WHERE created_at >= v_today),
    'active_users', (SELECT count(DISTINCT user_id) FROM content WHERE date_added >= v_range_start),

    'users_by_tier', (
      SELECT jsonb_build_object(
        'free', count(*) FILTER (WHERE tier IS NULL OR tier = 'free'),
        'starter', count(*) FILTER (WHERE tier = 'starter'),
        'pro', count(*) FILTER (WHERE tier = 'pro'),
        'day_pass', count(*) FILTER (WHERE tier = 'day_pass')
      ) FROM users
    ),

    'subscriptions', (
      SELECT jsonb_build_object(
        'active', count(*) FILTER (WHERE subscription_status = 'active'),
        'trialing', count(*) FILTER (WHERE subscription_status = 'trialing'),
        'canceled', count(*) FILTER (WHERE subscription_status = 'canceled')
      ) FROM users
    ),

    -- ===== CONTENT METRICS =====
    'total_content', (SELECT count(*) FROM content),
    'content_today', (SELECT count(*) FROM content WHERE date_added >= v_today),

    'content_by_type', (
      SELECT jsonb_build_object(
        'youtube', count(*) FILTER (WHERE type = 'youtube'),
        'article', count(*) FILTER (WHERE type = 'article'),
        'x_post', count(*) FILTER (WHERE type = 'x_post'),
        'pdf', count(*) FILTER (WHERE type = 'pdf'),
        'podcast', count(*) FILTER (WHERE type = 'podcast')
      ) FROM content
    ),

    -- ===== CHAT METRICS =====
    'chat_threads', (SELECT count(*) FROM chat_threads),
    'chat_messages', (SELECT count(*) FROM chat_messages),

    -- ===== SIGNUP TREND (daily, within time range) =====
    'signup_trend', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', d, 'count', cnt)
        ORDER BY d
      ), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS d, count(*) AS cnt
        FROM users
        WHERE created_at >= v_range_start
        GROUP BY 1
      ) t
    ),

    -- ===== CONTENT TREND (daily, within time range) =====
    'content_trend', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', d, 'count', cnt)
        ORDER BY d
      ), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', date_added)::date AS d, count(*) AS cnt
        FROM content
        WHERE date_added >= v_range_start
        GROUP BY 1
      ) t
    ),

    -- ===== TOP DOMAINS (top 10 by analyses) =====
    'top_domains', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'domain', domain,
          'count', total_analyses,
          'avg_score', COALESCE(avg_quality_score, 0)
        )
      ), '[]'::jsonb)
      FROM (
        SELECT domain, total_analyses, avg_quality_score
        FROM domains
        ORDER BY total_analyses DESC
        LIMIT 10
      ) t
    ),

    -- ===== TRUTH RATING DISTRIBUTION =====
    'truth_rating_distribution', (
      SELECT jsonb_build_object(
        'Accurate', count(*) FILTER (WHERE truth_check->>'overall_rating' = 'Accurate'),
        'Mostly Accurate', count(*) FILTER (WHERE truth_check->>'overall_rating' = 'Mostly Accurate'),
        'Mixed', count(*) FILTER (WHERE truth_check->>'overall_rating' = 'Mixed'),
        'Questionable', count(*) FILTER (WHERE truth_check->>'overall_rating' = 'Questionable'),
        'Unreliable', count(*) FILTER (WHERE truth_check->>'overall_rating' = 'Unreliable')
      ) FROM summaries
    ),

    -- ===== PROCESSING METRICS (within time range) =====
    'processing_metrics', (
      SELECT jsonb_build_object(
        'total', count(*),
        'success_count', count(*) FILTER (WHERE status = 'success'),
        'success_rate', CASE WHEN count(*) > 0
          THEN round((count(*) FILTER (WHERE status = 'success')::numeric / count(*)) * 100, 1)
          ELSE 100 END,
        'avg_processing_time_ms', COALESCE(round(avg(processing_time_ms)::numeric), 0)
      ) FROM processing_metrics
      WHERE created_at >= v_range_start
    ),

    -- ===== PROCESSING TIME BY SECTION (within time range) =====
    'processing_time_by_section', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'section', section_type,
          'avg_time', avg_time,
          'count', cnt
        )
        ORDER BY avg_time DESC
      ), '[]'::jsonb)
      FROM (
        SELECT section_type, round(avg(processing_time_ms)::numeric) AS avg_time, count(*) AS cnt
        FROM processing_metrics
        WHERE created_at >= v_range_start
        GROUP BY section_type
      ) t
    ),

    -- ===== API USAGE TODAY =====
    'api_usage_today', (
      SELECT jsonb_build_object(
        'total_cost', COALESCE(round(sum(estimated_cost_usd)::numeric, 4), 0),
        'total_calls', count(*),
        'error_count', count(*) FILTER (WHERE status = 'error'),
        'error_rate', CASE WHEN count(*) > 0
          THEN round((count(*) FILTER (WHERE status = 'error')::numeric / count(*)) * 100, 1)
          ELSE 0 END
      ) FROM api_usage
      WHERE created_at >= v_today
    ),

    -- ===== API COST BREAKDOWN TODAY (by api_name) =====
    'api_cost_breakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'api', api_name,
          'cost', cost,
          'calls', calls
        )
        ORDER BY cost DESC
      ), '[]'::jsonb)
      FROM (
        SELECT api_name, round(sum(estimated_cost_usd)::numeric, 4) AS cost, count(*) AS calls
        FROM api_usage
        WHERE created_at >= v_today
        GROUP BY api_name
      ) t
    ),

    -- ===== API STATUS (last 24h by service) =====
    'api_statuses', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'name', api_name,
          'total_calls', total,
          'error_count', errors,
          'error_rate', CASE WHEN total > 0
            THEN round((errors::numeric / total) * 100, 1)
            ELSE 0 END
        )
      ), '[]'::jsonb)
      FROM (
        SELECT api_name,
               count(*) AS total,
               count(*) FILTER (WHERE status = 'error') AS errors
        FROM api_usage
        WHERE created_at >= v_today
        GROUP BY api_name
      ) t
    ),

    -- ===== RECENT ERRORS (today, max 10) =====
    'recent_errors', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'timestamp', created_at,
          'api', api_name,
          'message', error_message
        )
      ), '[]'::jsonb)
      FROM (
        SELECT created_at, api_name, error_message
        FROM api_usage
        WHERE created_at >= v_today AND status = 'error' AND error_message IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    ),

    -- ===== 7-DAY COST TREND =====
    'cost_trend_7d', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', d, 'cost', cost)
        ORDER BY d
      ), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS d,
               round(sum(estimated_cost_usd)::numeric, 4) AS cost
        FROM api_usage
        WHERE created_at >= v_7days_ago
        GROUP BY 1
      ) t
    ),

    -- ===== MODEL COST BREAKDOWN (7 days, openrouter only) =====
    'model_cost_breakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'model', model,
          'cost', cost,
          'calls', calls,
          'tokens_input', tokens_in,
          'tokens_output', tokens_out
        )
        ORDER BY cost DESC
      ), '[]'::jsonb)
      FROM (
        SELECT
          COALESCE(metadata->>'model', 'unknown') AS model,
          round(sum(estimated_cost_usd)::numeric, 4) AS cost,
          count(*) AS calls,
          COALESCE(sum(tokens_input), 0) AS tokens_in,
          COALESCE(sum(tokens_output), 0) AS tokens_out
        FROM api_usage
        WHERE created_at >= v_7days_ago AND api_name = 'openrouter'
        GROUP BY 1
      ) t
    ),

    -- ===== 7-DAY ERROR TREND =====
    'error_trend_7d', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', d,
          'error_rate', CASE WHEN total > 0
            THEN round((errors::numeric / total) * 100, 1)
            ELSE 0 END,
          'error_count', errors,
          'total_count', total
        )
        ORDER BY d
      ), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS d,
               count(*) AS total,
               count(*) FILTER (WHERE status = 'error') AS errors
        FROM api_usage
        WHERE created_at >= v_7days_ago
        GROUP BY 1
      ) t
    ),

    -- ===== ERRORS BY TYPE (7 days) =====
    'errors_by_type', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('type', error_type, 'count', cnt)
        ORDER BY cnt DESC
      ), '[]'::jsonb)
      FROM (
        SELECT
          CASE
            WHEN lower(error_message) LIKE '%timeout%' THEN 'Timeout'
            WHEN lower(error_message) LIKE '%rate limit%' OR lower(error_message) LIKE '%429%' THEN 'Rate Limit'
            WHEN lower(error_message) LIKE '%unauthorized%' OR lower(error_message) LIKE '%401%' THEN 'Auth Error'
            WHEN lower(error_message) LIKE '%not found%' OR lower(error_message) LIKE '%404%' THEN 'Not Found'
            WHEN lower(error_message) LIKE '%server%' OR lower(error_message) LIKE '%500%' THEN 'Server Error'
            WHEN lower(error_message) LIKE '%network%' OR lower(error_message) LIKE '%connection%' THEN 'Network Error'
            ELSE 'Other'
          END AS error_type,
          count(*) AS cnt
        FROM api_usage
        WHERE created_at >= v_7days_ago AND status = 'error' AND error_message IS NOT NULL
        GROUP BY 1
      ) t
    ),

    -- ===== PROCESSING TIME TREND (7 days, success only) =====
    'processing_time_trend_7d', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', d,
          'avg_time', avg_time,
          'count', cnt
        )
        ORDER BY d
      ), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS d,
               round(avg(processing_time_ms)::numeric) AS avg_time,
               count(*) AS cnt
        FROM processing_metrics
        WHERE created_at >= v_7days_ago AND status = 'success'
        GROUP BY 1
      ) t
    ),

    -- ===== CONTENT BY TYPE MONTHLY (last 90 days) =====
    'content_by_type_monthly', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'month', TO_CHAR(m, 'Mon YY'),
          'youtube', youtube,
          'article', article,
          'x_post', x_post,
          'pdf', pdf
        )
        ORDER BY m
      ), '[]'::jsonb)
      FROM (
        SELECT date_trunc('month', date_added)::date AS m,
               count(*) FILTER (WHERE type = 'youtube') AS youtube,
               count(*) FILTER (WHERE type = 'article') AS article,
               count(*) FILTER (WHERE type = 'x_post') AS x_post,
               count(*) FILTER (WHERE type = 'pdf') AS pdf
        FROM content
        WHERE date_added >= v_90days_ago
        GROUP BY 1
      ) t
    ),

    -- ===== GROWTH CALCULATIONS =====
    'previous_period_users', (
      SELECT count(*) FROM users
      WHERE created_at >= v_prev_start AND created_at < v_prev_end
    ),
    'previous_period_content', (
      SELECT count(*) FROM content
      WHERE date_added >= v_prev_start AND date_added < v_prev_end
    ),
    'current_period_users', (
      SELECT count(*) FROM users
      WHERE created_at >= v_range_start
    ),
    'current_period_content', (
      SELECT count(*) FROM content
      WHERE date_added >= v_range_start
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to service_role (admin only function)
GRANT EXECUTE ON FUNCTION clarus.get_admin_metrics(INTEGER) TO service_role;
-- Revoke from public/anon/authenticated since this is admin-only
REVOKE EXECUTE ON FUNCTION clarus.get_admin_metrics(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION clarus.get_admin_metrics(INTEGER) FROM authenticated;
