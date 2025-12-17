-- This script changes the data type for several columns in the 'content' table
-- from VARCHAR(255) to TEXT to allow for longer content, such as full tweet
-- threads and detailed descriptions from scraped articles.

ALTER TABLE public.content
ALTER COLUMN title TYPE TEXT,
ALTER COLUMN description TYPE TEXT,
ALTER COLUMN author TYPE TEXT,
ALTER COLUMN thumbnail_url TYPE TEXT;
