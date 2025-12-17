-- Remove the title column from chat_threads as it's no longer needed
ALTER TABLE public.chat_threads DROP COLUMN IF EXISTS title;

-- Add a unique constraint to ensure only one thread per user per content item.
-- Note: This will fail if your existing data has duplicates. 
-- If so, you may need to clean up the data before running this script.
ALTER TABLE public.chat_threads
ADD CONSTRAINT chat_threads_user_id_content_id_key UNIQUE (user_id, content_id);

-- Re-creating RLS policies for clarity after schema change.
-- No functional change, but good practice.

DROP POLICY IF EXISTS "Users can view their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can view their own chat threads."
ON public.chat_threads FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can create their own chat threads."
ON public.chat_threads FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can delete their own chat threads."
ON public.chat_threads FOR DELETE
USING (auth.uid() = user_id);
