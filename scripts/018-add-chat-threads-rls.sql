-- Enable Row Level Security for the chat_threads table if it's not already enabled.
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: Allow users to view their own chat threads.
-- This ensures users can fetch their existing chat sessions.
DROP POLICY IF EXISTS "Users can view their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can view their own chat threads."
ON public.chat_threads FOR SELECT
USING (auth.uid() = user_id);

-- 2. INSERT Policy: Allow users to create new chat threads for themselves.
-- This is the crucial policy that fixes the bug you're experiencing.
-- It allows a new row to be inserted into chat_threads as long as the user_id matches the logged-in user.
DROP POLICY IF EXISTS "Users can create their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can create their own chat threads."
ON public.chat_threads FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. DELETE Policy: Allow users to delete their own chat threads.
-- While not used in the UI yet, this is good practice for future features.
DROP POLICY IF EXISTS "Users can delete their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can delete their own chat threads."
ON public.chat_threads FOR DELETE
USING (auth.uid() = user_id);
