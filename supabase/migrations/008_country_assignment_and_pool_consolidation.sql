-- Country assignment + one-pool-per-user consolidation.
-- This is destructive by design: current auth users are pre-launch test data.

DELETE FROM auth.users;

DELETE FROM public.pools WHERE slug = 'all-offices';

CREATE TABLE public.tournament_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lock_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.tournament_settings (id, lock_at)
VALUES (1, TIMESTAMPTZ '2026-06-11 16:00:00+00')
ON CONFLICT (id) DO UPDATE SET lock_at = EXCLUDED.lock_at;

ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tournament settings"
  ON public.tournament_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can update tournament settings"
  ON public.tournament_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE OR REPLACE FUNCTION public.is_tournament_locked()
RETURNS BOOLEAN AS $$
  SELECT NOW() >= (SELECT lock_at FROM public.tournament_settings WHERE id = 1);
$$ LANGUAGE SQL STABLE;

ALTER TABLE public.profiles
  ADD COLUMN country TEXT NOT NULL
  CHECK (country IN ('spain', 'malta', 'nigeria', 'south-africa', 'zambia', 'uk'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  selected_country TEXT;
  selected_pool_id UUID;
BEGIN
  selected_country := NEW.raw_user_meta_data->>'country';

  IF selected_country NOT IN ('spain', 'malta', 'nigeria', 'south-africa', 'zambia', 'uk') THEN
    RAISE EXCEPTION 'A valid office country is required';
  END IF;

  SELECT id INTO selected_pool_id
  FROM public.pools
  WHERE slug = selected_country AND is_active = TRUE;

  IF selected_pool_id IS NULL THEN
    RAISE EXCEPTION 'Office pool is not available';
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    selected_country
  );

  INSERT INTO public.pool_members (pool_id, user_id, role)
  VALUES (selected_pool_id, NEW.id, 'member');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile (country immutable)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND country = (SELECT country FROM public.profiles WHERE id = auth.uid())
    AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can join pools" ON public.pool_members;
DROP POLICY IF EXISTS "Users can leave pools" ON public.pool_members;

DROP POLICY IF EXISTS "View group predictions within shared pool" ON public.group_predictions;
CREATE POLICY "View group predictions: same pool or after lock"
  ON public.group_predictions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pool_members pm
      WHERE pm.pool_id = group_predictions.pool_id AND pm.user_id = auth.uid()
    )
    OR public.is_tournament_locked()
  );

DROP POLICY IF EXISTS "View knockout predictions within shared pool" ON public.knockout_predictions;
CREATE POLICY "View knockout predictions: same pool or after lock"
  ON public.knockout_predictions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.pool_members pm
      WHERE pm.pool_id = knockout_predictions.pool_id AND pm.user_id = auth.uid()
    )
    OR public.is_tournament_locked()
  );
