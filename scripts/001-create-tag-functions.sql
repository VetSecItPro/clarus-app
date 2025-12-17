-- Function to get all unique tags for a specific user's unrated content (Library)
CREATE OR REPLACE FUNCTION get_library_tags(p_user_id UUID)
RETURNS TABLE(tag TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT elem
    FROM content c
    JOIN summaries s ON c.id = s.content_id,
         jsonb_array_elements_text(s.tags) AS elem
    WHERE c.user_id = p_user_id
      AND c.id NOT IN (SELECT content_id FROM content_ratings WHERE user_id = p_user_id)
    ORDER BY elem;
END;
$$ LANGUAGE plpgsql;

-- Function to get all unique tags for a specific user's rated content (Brain)
CREATE OR REPLACE FUNCTION get_brain_tags(p_user_id UUID)
RETURNS TABLE(tag TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT elem
    FROM content_ratings cr
    JOIN summaries s ON cr.content_id = s.content_id,
         jsonb_array_elements_text(s.tags) AS elem
    WHERE cr.user_id = p_user_id
    ORDER BY elem;
END;
$$ LANGUAGE plpgsql;

-- Function to get all unique tags for content in the feed
CREATE OR REPLACE FUNCTION get_feed_tags(p_user_id UUID)
RETURNS TABLE(tag TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT elem
    FROM content_ratings cr
    JOIN summaries s ON cr.content_id = s.content_id,
         jsonb_array_elements_text(s.tags) AS elem
    WHERE cr.user_id != p_user_id
      AND cr.signal_score > 0
    ORDER BY elem;
END;
$$ LANGUAGE plpgsql;
