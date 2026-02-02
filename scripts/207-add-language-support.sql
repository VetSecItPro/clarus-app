SET search_path TO clarus, public, extensions;

-- Add language column to summaries (existing rows default to 'en')
ALTER TABLE clarus.summaries
  ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'en';

-- Drop the old unique constraint on content_id alone
ALTER TABLE clarus.summaries
  DROP CONSTRAINT IF EXISTS summaries_content_id_unique;

-- Create new unique index on (content_id, language) to allow one summary per language per content
CREATE UNIQUE INDEX IF NOT EXISTS summaries_content_id_language_unique
  ON clarus.summaries (content_id, language);

-- Track which language the content was last analyzed in
ALTER TABLE clarus.content
  ADD COLUMN IF NOT EXISTS analysis_language VARCHAR(5) DEFAULT 'en';
