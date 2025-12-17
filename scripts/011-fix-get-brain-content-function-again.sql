CREATE OR REPLACE FUNCTION get_user_brain_content(
    p_user_id UUID,
    p_search_query TEXT,
    p_content_type_filter TEXT,
    p_sort_key TEXT,
    p_sort_direction TEXT
)
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    url TEXT,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    type TEXT,
    created_at TIMESTAMPTZ,
    content_body TEXT,
    raw_content JSONB,
    date_added TIMESTAMPTZ,
    model_name TEXT,
    summaries JSONB,
    content_ratings JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH brain_items AS (
        SELECT
            c.id,
            c.user_id,
            c.url,
            c.title,
            c.description,
            c.thumbnail_url,
            c.type,
            c.content_body,
            c.raw_content,
            c.date_added,
            c.model_name,
            c.date_added as created_at, -- Explicitly alias date_added to created_at
            (SELECT jsonb_agg(s) FROM summaries s WHERE s.content_id = c.id) as summaries,
            (SELECT jsonb_agg(cr) FROM content_ratings cr WHERE cr.content_id = c.id AND cr.signal_score IS NOT NULL AND cr.signal_score != 0) as content_ratings
        FROM content c
        WHERE c.user_id = p_user_id
    )
    SELECT
        bi.id,
        bi.user_id,
        bi.url,
        bi.title,
        bi.description,
        bi.thumbnail_url,
        bi.type,
        bi.created_at, -- Now this column exists in the CTE result
        bi.content_body,
        bi.raw_content,
        bi.date_added,
        bi.model_name,
        bi.summaries,
        bi.content_ratings
    FROM brain_items bi
    WHERE
        bi.content_ratings IS NOT NULL
        AND (p_search_query IS NULL OR p_search_query = '' OR bi.title ILIKE ('%' || p_search_query || '%'))
        AND (p_content_type_filter = 'all' OR bi.type = p_content_type_filter)
    ORDER BY
        CASE WHEN p_sort_key = 'signal_score' AND p_sort_direction = 'desc' THEN (bi.content_ratings->0->>'signal_score')::numeric END DESC NULLS LAST,
        CASE WHEN p_sort_key = 'signal_score' AND p_sort_direction = 'asc' THEN (bi.content_ratings->0->>'signal_score')::numeric END ASC NULLS LAST,
        CASE WHEN p_sort_key = 'date_added' AND p_sort_direction = 'desc' THEN bi.date_added END DESC NULLS LAST,
        CASE WHEN p_sort_key = 'date_added' AND p_sort_direction = 'asc' THEN bi.date_added END ASC NULLS LAST,
        bi.date_added DESC; -- Default sort
END;
$$;
