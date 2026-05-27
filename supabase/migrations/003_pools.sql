-- Phase 1 pools: manually-joined office competitions with per-pool predictions,
-- per-pool submission locks, and per-pool scores. Phase 2 will extend this with
-- user-created public/private pools; for now we hard-code the office set in
-- the seed at the bottom.

-- ---------------------------------------------------------------------------
-- pools
-- ---------------------------------------------------------------------------

CREATE TABLE public.pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('office')) DEFAULT 'office',
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')) DEFAULT 'public',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active pools"
  ON public.pools FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage pools"
  ON public.pools FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- ---------------------------------------------------------------------------
-- pool_members
-- ---------------------------------------------------------------------------

CREATE TABLE public.pool_members (
  pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('member', 'admin')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pool_id, user_id)
);

CREATE INDEX pool_members_user_idx ON public.pool_members(user_id);

ALTER TABLE public.pool_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view other members in pools they belong to"
  ON public.pool_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pool_members pm
      WHERE pm.pool_id = pool_members.pool_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users can join pools"
  ON public.pool_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave pools"
  ON public.pool_members FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Per-pool predictions: add pool_id and swap uniqueness to (pool, user, match)
-- ---------------------------------------------------------------------------

ALTER TABLE public.group_predictions
  ADD COLUMN pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE;
ALTER TABLE public.group_predictions
  DROP CONSTRAINT IF EXISTS group_predictions_user_id_match_id_key;
ALTER TABLE public.group_predictions
  ADD CONSTRAINT group_predictions_pool_user_match_unique UNIQUE (pool_id, user_id, match_id);

ALTER TABLE public.knockout_predictions
  ADD COLUMN pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE;
ALTER TABLE public.knockout_predictions
  DROP CONSTRAINT IF EXISTS knockout_predictions_user_id_match_id_key;
ALTER TABLE public.knockout_predictions
  ADD CONSTRAINT knockout_predictions_pool_user_match_unique UNIQUE (pool_id, user_id, match_id);

-- Lower row-level visibility so pool members can see each other's picks for
-- the same pool (needed for the "see predictions" sheet on /matches).
DROP POLICY IF EXISTS "Users can view own group predictions" ON public.group_predictions;
CREATE POLICY "View group predictions within shared pool"
  ON public.group_predictions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pool_members pm
      WHERE pm.pool_id = group_predictions.pool_id AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own knockout predictions" ON public.knockout_predictions;
CREATE POLICY "View knockout predictions within shared pool"
  ON public.knockout_predictions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pool_members pm
      WHERE pm.pool_id = knockout_predictions.pool_id AND pm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Per-pool submissions and scores
-- ---------------------------------------------------------------------------

ALTER TABLE public.submissions
  ADD COLUMN pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE;

-- Swap the primary key from (user_id) to (pool_id, user_id) so a user can
-- have one locked submission per pool.
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_pkey;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_pkey PRIMARY KEY (pool_id, user_id);

ALTER TABLE public.user_scores
  ADD COLUMN pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE;

ALTER TABLE public.user_scores DROP CONSTRAINT IF EXISTS user_scores_pkey;
ALTER TABLE public.user_scores
  ADD CONSTRAINT user_scores_pkey PRIMARY KEY (pool_id, user_id);

-- ---------------------------------------------------------------------------
-- Seed Phase 1 office pools
-- ---------------------------------------------------------------------------

INSERT INTO public.pools (name, slug, type, visibility) VALUES
  ('All Offices',         'all-offices',  'office', 'public'),
  ('Spain Office',        'spain',        'office', 'public'),
  ('Malta Office',        'malta',        'office', 'public'),
  ('Nigeria Office',      'nigeria',      'office', 'public'),
  ('South Africa Office', 'south-africa', 'office', 'public'),
  ('Zambia Office',       'zambia',       'office', 'public'),
  ('UK Office',           'uk',           'office', 'public')
ON CONFLICT (slug) DO NOTHING;
