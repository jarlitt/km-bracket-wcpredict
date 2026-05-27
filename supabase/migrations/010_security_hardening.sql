-- Fix security advisor warnings: search_path, EXECUTE grants, and RLS lint.

-- 1. Pin search_path on both functions to prevent search-path injection.

CREATE OR REPLACE FUNCTION public.is_tournament_locked()
RETURNS BOOLEAN AS $$
  SELECT NOW() >= (SELECT lock_at FROM public.tournament_settings WHERE id = 1);
$$ LANGUAGE SQL STABLE SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Revoke direct EXECUTE on handle_new_user from API roles.
--    This function is a trigger on auth.users and should never be called via RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- 3. Add explicit deny-all policy on sync_metadata.
--    service_role bypasses RLS, so this table remains accessible to server-side code only.
CREATE POLICY "Deny all client access"
  ON public.sync_metadata FOR ALL
  USING (false);
