-- Migration 219: Add topic_segments column to summaries table
-- Stores LLM-generated topic/chapter segments for podcast and YouTube content.
-- Each entry is a JSON array of { title, start_time, end_time, summary, speakers? }

ALTER TABLE clarus.summaries
ADD COLUMN IF NOT EXISTS topic_segments jsonb;

COMMENT ON COLUMN clarus.summaries.topic_segments IS 'JSON array of topic segments with timestamps — podcast/youtube content only';
