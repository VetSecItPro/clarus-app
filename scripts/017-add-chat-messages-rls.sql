-- Enable RLS for the chat_messages table if it's not already enabled.
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to view messages in their own chat threads.
DROP POLICY IF EXISTS "Users can view messages in their own threads." ON public.chat_messages;
CREATE POLICY "Users can view messages in their own threads."
ON public.chat_messages FOR SELECT
USING (
  auth.uid() = (
    SELECT user_id FROM public.chat_threads WHERE id = chat_messages.thread_id
  )
);

-- Allow users to insert messages into their own chat threads.
DROP POLICY IF EXISTS "Users can insert messages into their own threads." ON public.chat_messages;
CREATE POLICY "Users can insert messages into their own threads."
ON public.chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM public.chat_threads WHERE id = chat_messages.thread_id
  )
);

-- Allow users to delete messages from their own chat threads.
-- This is the policy that fixes the "Clear Chat" functionality.
DROP POLICY IF EXISTS "Users can delete messages from their own threads." ON public.chat_messages;
CREATE POLICY "Users can delete messages from their own threads."
ON public.chat_messages FOR DELETE
USING (
  auth.uid() = (
    SELECT user_id FROM public.chat_threads WHERE id = chat_messages.thread_id
  )
);
