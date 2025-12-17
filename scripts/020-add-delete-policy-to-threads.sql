-- Add a policy to allow users to delete their own chat threads.
CREATE POLICY "Users can delete their own chat threads"
ON public.chat_threads
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
