-- Drop the old, restrictive policy that only allowed users to see their own summaries.
-- This is necessary to allow summaries to be viewed on the /feed page.
DROP POLICY IF EXISTS "Enable read access for own summaries" ON public.summaries;

-- Create a new, more permissive policy that allows any authenticated user to read any summary.
-- This makes summaries public within the app, which is the desired behavior for the feed.
CREATE POLICY "Enable read access for all authenticated users"
ON public.summaries FOR SELECT
TO authenticated
USING (true);

-- Ensure RLS is enabled on the table. This command is idempotent.
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
