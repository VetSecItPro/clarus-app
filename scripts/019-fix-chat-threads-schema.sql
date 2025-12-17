-- This script corrects the chat_threads table schema by definitively removing the 'title' column.
-- The presence of this column with a NOT NULL constraint was causing errors
-- when creating new chat threads after the feature was simplified to one-thread-per-item.
-- Running this ensures the database schema matches the application's expectations.

ALTER TABLE public.chat_threads
DROP COLUMN IF EXISTS title;
