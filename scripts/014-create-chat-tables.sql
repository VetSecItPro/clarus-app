-- Create chat_threads table
CREATE TABLE IF NOT EXISTS public.chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    title TEXT NOT NULL
);

-- Add comments
COMMENT ON TABLE public.chat_threads IS 'Stores chat threads related to content items.';
COMMENT ON COLUMN public.chat_threads.title IS 'Title of the chat thread, likely from the first message.';

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.chat_messages IS 'Stores individual messages within a chat thread.';
COMMENT ON COLUMN public.chat_messages.role IS 'The role of the message sender.';
COMMENT ON COLUMN public.chat_messages.content IS 'The text content of the message.';

-- Enable RLS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_threads
DROP POLICY IF EXISTS "Users can view their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can view their own chat threads."
ON public.chat_threads FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can create their own chat threads."
ON public.chat_threads FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can update their own chat threads."
ON public.chat_threads FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own chat threads." ON public.chat_threads;
CREATE POLICY "Users can delete their own chat threads."
ON public.chat_threads FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for chat_messages
DROP POLICY IF EXISTS "Users can view messages in their own threads." ON public.chat_messages;
CREATE POLICY "Users can view messages in their own threads."
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_threads
    WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create messages in their own threads." ON public.chat_messages;
CREATE POLICY "Users can create messages in their own threads."
ON public.chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chat_threads
    WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.user_id = auth.uid()
  )
);
