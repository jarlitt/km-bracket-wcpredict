-- Allow anyone to see who has submitted (not their actual predictions).
CREATE POLICY "Anyone can view submissions"
  ON public.submissions FOR SELECT USING (true);

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own submission" ON public.submissions;
