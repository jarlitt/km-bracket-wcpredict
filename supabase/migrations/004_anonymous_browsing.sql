-- Anonymous browsing: let signed-out visitors see pool lists and member counts
-- so they can preview pools and start predicting without an account.
-- They still can't view other users' predictions (those policies stay
-- pool-membership scoped) or write anything to the database.

-- ---------------------------------------------------------------------------
-- pools: public SELECT of active pools (replaces the authenticated-only policy)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can view active pools" ON public.pools;

CREATE POLICY "Anyone can view active pools"
  ON public.pools FOR SELECT
  USING (is_active = TRUE);

-- ---------------------------------------------------------------------------
-- pool_members: allow anyone to read so we can display member counts in the
-- pool pickers and on the /pools page even to signed-out visitors.
-- Insert/delete policies remain unchanged (auth.uid() = user_id only).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members can view other members in pools they belong to" ON public.pool_members;

CREATE POLICY "Anyone can view pool members"
  ON public.pool_members FOR SELECT
  USING (TRUE);
