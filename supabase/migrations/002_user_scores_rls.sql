-- user_scores: service role writes, everyone reads
-- SELECT policy already exists from 001_schema.sql: "Anyone can view scores"

-- Allow service role (bypasses RLS) and admin users to insert/update
CREATE POLICY "Service and admins can insert scores"
  ON public.user_scores FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Service and admins can update scores"
  ON public.user_scores FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Allow all authenticated users to read submission status (needed for dashboard)
CREATE POLICY "Anyone can view submissions"
  ON public.submissions FOR SELECT
  USING (true);
