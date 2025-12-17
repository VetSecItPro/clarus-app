-- Drop any existing select policy on the summaries table to avoid conflicts.
-- Using IF EXISTS makes it safe to run even if the policy doesn't exist.
DROP POLICY IF EXISTS "Enable read access for own summaries" ON public.summaries;

-- Create the correct RLS policy on the 'summaries' table.
-- This policy allows a user to read a summary if they are the owner of the
-- parent content item that the summary is linked to. This is the key fix.
CREATE POLICY "Enable read access for own summaries"
ON public.summaries FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM content
    WHERE content.id = summaries.content_id AND content.user_id = auth.uid()
  )
);

-- Ensure RLS is enabled on the table. This command is safe to re-run.
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
