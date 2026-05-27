# Country Assignment & Pool Consolidation

**Date:** 2026-05-27
**Status:** Approved
**Approach:** One-pool-per-user keyed by office country; country-agnostic predict flow; aggregate leaderboard replaces "All Offices"

## Problem

Today users can join any number of office pools (`spain`, `malta`, `nigeria`, `south-africa`, `zambia`, `uk`, `all-offices`) and make independent predictions in each. This conflicts with the product intent:

- A KingMakers employee should only compete in **their own office's** pool.
- "All Offices" should consolidate every country's submissions into a single global ranking and a country-vs-country competition — not be a separate prediction set.
- Anonymous users can already start predicting before signing up, but the current flow doesn't define what happens to those drafts when the user signs up under a country that differs from the pool they were predicting in.

## Goal

Make a user's identity (their office country) determine where they compete, with a single source of truth (`profiles.country`). Eliminate the "many pools per user" mental model, replace `all-offices` with a dedicated aggregate page, and define a deterministic anonymous → authenticated reassignment flow.

## Decisions

| Decision | Choice |
|---|---|
| `All Offices` model | Removed as a pool. Replaced by `/leaderboard` aggregate page. |
| Country picker timing | At signup. Country is stored on `profiles.country`. |
| Country mutability | Locked-once. Admin-only override (out of scope for this spec). |
| Country options | Exactly the 6 office countries. |
| Existing user data | Wiped. All `auth.users` rows are deleted in the migration (test data only, pre-launch). |
| Anonymous predict flow | Single country-agnostic `/predict/*` flow. Drafts in `localStorage` migrate to the user's country pool on signup. |
| Cross-country visibility | Same-country members see each other's predictions before lock. Anyone signed in can view any country's individual brackets after `tournament_settings.lock_at`. |
| Country-vs-country ranking | Average score per submitted member, with total points and headcount as secondary stats. No minimum-submission floor. |

## Solution

### Identity & data model

`profiles` gains a required `country TEXT NOT NULL` column with a `CHECK` constraint covering exactly six values: `'spain'`, `'malta'`, `'nigeria'`, `'south-africa'`, `'zambia'`, `'uk'`. Stored as the existing pool slug so we can join `profiles.country = pools.slug` directly.

The `handle_new_user` Postgres trigger is rewritten to validate `raw_user_meta_data->>'country'` against the six valid values, insert into `profiles` with the country, and **atomically insert a `pool_members` row matching that country**. Signup is now a single transaction that produces a fully-formed user (auth row + profile + pool membership) — no client-side auto-join logic needed.

`profiles` row-level security is tightened so the `country` column is immutable post-creation:

```sql
DROP POLICY "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile (country immutable)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND country = (SELECT country FROM public.profiles WHERE id = auth.uid())
  );
```

`pool_members` user-initiated INSERT/DELETE policies are dropped entirely. Membership is now trigger-managed; users can't join, leave, or move pools.

### Tournament lock as a first-class concept

A new single-row `tournament_settings` table holds `lock_at TIMESTAMPTZ` as the source of truth, and a `is_tournament_locked()` SQL function reads from it. This lets RLS policies check the lock state without hard-coded timestamps:

```sql
CREATE OR REPLACE FUNCTION public.is_tournament_locked()
RETURNS BOOLEAN AS $$
  SELECT NOW() >= (SELECT lock_at FROM public.tournament_settings WHERE id = 1);
$$ LANGUAGE SQL STABLE;
```

The application's `src/lib/matches/lock.ts` is refactored to async, reads `tournament_settings` (cached via React's `cache()` server-side, exposed through context client-side). The JS-derived `FIRST_MATCH_KICKOFF_UTC` becomes a fallback only, with a vitest assertion that the seed value matches it.

Refactoring all sync callers of `isTournamentLocked()` is a sub-task within this spec. It touches the predictions context, leave-pool button (which is being removed anyway), copy-predictions dialog (being removed), the `/pools` page (being repurposed), and the predict layout chrome.

### Cross-country prediction visibility

Prediction RLS becomes "same pool member, OR tournament locked":

```sql
DROP POLICY "View group predictions within shared pool" ON public.group_predictions;
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
```

Same shape for `knockout_predictions`. Country pool leaderboards (member counts, total scores, ranks) are already publicly readable thanks to migration 004.

### Country-agnostic predict flow

Predict pages move from `/pools/[slug]/predict/*` to top-level `/predict/*`:

- `/predict/groups` — group stage scores
- `/predict/thirds` — best-third standings + tie-breaker UI (renamed from the existing `predict/standings` for clarity)
- `/predict/bracket` — knockout picks
- `/predict/summary` — review and submit

Anonymous users' drafts live under a single `anon:draft` localStorage key — there is no per-pool fan-out, because there is no pool yet. `PredictionsContext` is refactored to drop its dependency on `usePools().activePool`. For authenticated users, the pool ID is derived server-side from `profiles.country`; the client never names a pool ID. Server actions (`submitPredictionsToDb`, `loadPredictions`) drop their `poolId` parameter — there's only one valid pool per user.

### Anonymous → authenticated reassignment

When an anonymous user signs up:

1. `auth.signUp()` fires with `country` in `user_metadata`. The trigger creates the profile + pool membership atomically.
2. On success, `auth-context.tsx`'s `signup()` runs `migrateAnonDraftToCountryPool(userId, countryPoolId)`:
    - Reads `localStorage.getItem('anon:draft')`.
    - If present: strips any stray `submitted: true` (defensive — anon can't actually submit), re-keys it under `<userId>:<countryPoolId>`, removes the `anon:draft` key.
    - As cleanup, also clears any legacy `anon:<poolId>` keys left over from the previous data model so they don't accumulate.
    - If no draft is present: no-op.
3. Redirects to `/predict/summary` if the migrated draft has 72 group predictions, otherwise `/predict/groups`. The user reviews and clicks Submit themselves — we don't auto-submit on their behalf.

A toast confirms: *"Welcome! We saved your predictions to the {country} pool. Review them before submitting."*

The single-draft model is what makes this flow predictable: there's nothing to merge, no precedence rule to explain, no "you lost your other draft" surprise.

### Pages and information architecture

#### Top-level navigation

**Anon:** Home, Rules, Live Score, Sign up, Log in
**Signed-in:** Home, Predict, Leaderboard, My Office (e.g. 🇪🇸 Spain), Rules, Live Score, avatar menu

The Live Score button is unchanged — same red-accented button targeting `/matches`.

#### `/` (Home)

Three states for signed-in users:

1. **Not started** (no group predictions) — Hero with "Make your bracket" CTA.
2. **In progress** — "47/72 groups predicted [Continue →]" with progress bar.
3. **Submitted** — "Submitted ✓ Rank: #12 in Spain · #84 globally [View leaderboard →]" with a bracket preview.

Anon users see the existing landing page hero with the "Start your bracket" CTA pointing at `/predict/groups`.

#### `/predict/*`

Same UI as today's `/pools/[slug]/predict/*` pages, just at top-level URLs. Same predict layout chrome (without the `<PoolSwitcher>`). Anonymous and signed-in users use the same routes.

#### `/leaderboard`

Two panels:

- **Country Standings** (top): 6 country cards, ranked by `avgScore = total_score_sum / submitted_member_count`. Each card shows flag, name, average, total points, member count.
- **Global Player Leaderboard** (bottom): every submitted player from every country, ranked by `total_score`. Filter chips at the top let the user narrow to a specific country.

#### `/pools/<country>` (single-country page)

Header with country flag, name, average score, member count, and country rank. Below the header, a full member leaderboard table for that country.

- **Before lock**: rows are non-interactive (only your own row links to your bracket).
- **After lock**: clicking any row opens that user's bracket at `/pools/<country>/predictions/<userId>` (read-only).

#### `/pools/<country>/predictions/<userId>` (new)

Read-only version of the existing `/predict/summary` rendering. Header shows whose bracket this is. RLS enforces that this query only returns data when the tournament is locked or the viewer is in the same country pool.

#### `/auth/*`

Standalone signup/login/recovery pages remain, primarily as targets for password-reset email links. The primary in-app flow is the existing `<AuthModal>`. Both share the `<AuthFields>` component, which gets the country picker added once.

The country picker is a styled radio-card list (one card per country, with the flag, country name, and "Office" subtitle). Required field — signup is blocked without a selection.

After signup, the redirect target is rewritten to `/predict/summary` (or `/predict/groups` if no draft was migrated), ignoring any `next=` query parameter. After login, `next=` is honoured normally.

### Country competition aggregation

Pure function `aggregateLeaderboard()` in `src/lib/leaderboard/aggregate.ts`:

```typescript
type CountryStanding = {
  slug: string                       // 'spain'
  name: string                       // 'Spain Office'
  avgScore: number                   // total / count, or 0 if count == 0
  totalScore: number
  memberCount: number                // submitted members only
}

type GlobalPlayer = {
  rank: number
  userId: string
  displayName: string
  country: string                    // slug
  totalScore: number
}

function aggregateLeaderboard(
  scores: Array<{ user_id: string; pool_id: string; total_score: number }>,
  profiles: Array<{ id: string; display_name: string; country: string }>,
  pools: Array<{ id: string; slug: string; name: string }>,
): { countryStandings: CountryStanding[]; globalPlayers: GlobalPlayer[] }
```

Country standings are sorted by `avgScore` descending. A country with zero submitted members appears with `avgScore = 0` and `memberCount = 0` (not filtered out — keeps the 6 cards stable in UI).

Global players are sorted by `totalScore` descending, with `displayName` ascending as a deterministic tie-breaker.

## Migration: `008_country_assignment_and_pool_consolidation.sql`

A single migration ordered for safety:

1. **Wipe existing accounts** — `DELETE FROM auth.users;` (pre-launch test data only). FK cascades clean up `profiles`, `pool_members`, `group_predictions`, `knockout_predictions`, `submissions`, `user_scores`.

2. **Drop the `all-offices` pool** — `DELETE FROM public.pools WHERE slug = 'all-offices';`. With users already wiped in step 1, no membership/prediction rows reference it.

3. **Create `tournament_settings`** — single-row table with `lock_at` timestamp, seeded with `'2026-06-11 16:00:00+00'`. RLS: read-public, update-admin-only. (Full DDL goes in the migration file; rationale in *Tournament lock as a first-class concept* above.)

4. **Create `is_tournament_locked()`** — full SQL shown in *Tournament lock as a first-class concept* above. STABLE function reading from `tournament_settings`.

5. **Add `profiles.country`** — `ALTER TABLE public.profiles ADD COLUMN country TEXT NOT NULL CHECK (country IN ('spain','malta','nigeria','south-africa','zambia','uk'));`. Safe to add as `NOT NULL` because step 1 just wiped all rows.

6. **Replace `handle_new_user` trigger** — declared `SECURITY DEFINER` (preserving the existing pattern from migration 001). Validates `raw_user_meta_data->>'country'` against the 6 valid slugs (raises an exception on mismatch, which `auth.signUp()` surfaces to the client). Inserts into `profiles` with country set, then inserts the matching `pool_members` row. Both happen in a single transaction with the `auth.users` insert.

7. **Tighten `profiles` RLS** — drop the existing `"Users can update own profile"` policy, replace with the country-immutable variant shown in *Identity & data model* above.

8. **Drop `pool_members` user-initiated policies** — `DROP POLICY "Users can join pools"` and `DROP POLICY "Users can leave pools"`. With no INSERT/DELETE policies, only the `SECURITY DEFINER` trigger can write. The existing read policy ("Anyone can view pool members") stays.

9. **Update predictions RLS** — drop and recreate the SELECT policies on `group_predictions` and `knockout_predictions` to match the "same pool OR `is_tournament_locked()`" shape shown in *Cross-country prediction visibility* above.

The migration is irreversible (the user wipe in step 1 is destructive). Snapshot the production database before running it.

## File Changes Summary

| File | Change | Description |
|------|--------|-------------|
| `supabase/migrations/008_country_assignment_and_pool_consolidation.sql` | New | All schema changes, RLS, trigger updates, user wipe |
| `src/lib/matches/lock.ts` | Edit | Async, reads from `tournament_settings`, JS constant becomes fallback |
| `src/lib/leaderboard/aggregate.ts` | New | Pure functions for country standings + global ranking |
| `src/lib/predictions/anon-migration.ts` | New | `migrateAnonDraftToCountryPool()` helper (single-key model) |
| `src/lib/predictions/storage.ts` | Edit | Anon helpers use single `anon:draft` key; legacy `anon:<poolId>` keys cleared on access |
| `src/context/auth-context.tsx` | Edit | Extend `signup()` with `country`, expose `country` on `User`, run draft migration |
| `src/context/predictions-context.tsx` | Edit | Drop `tryAutoJoin`, `copyPredictionsFromPool`; read pool from auth's country |
| `src/context/pool-context.tsx` | Edit | Drastically simplified; loses memberships/summaries/active-pool resolution |
| `src/components/auth/auth-flow.tsx` | Edit | Country picker (styled radio cards) on signup |
| `src/components/auth/auth-modal.tsx` | Unchanged | Renders `<AuthFields>` which inherits the new picker automatically |
| `src/components/pools/pool-flag.tsx` | New (extracted) | Move `PoolFlag` and `ArrowChip` here from `pool-cards.tsx` |
| `src/components/pools/pool-cards.tsx` | Delete | Membership-specific cards no longer needed |
| `src/components/pools/copy-predictions-dialog.tsx` | Delete | Copy feature obsolete |
| `src/components/pools/leave-pool-button.tsx` | Delete | Locked-once means no leaving |
| `src/components/pools/pool-switcher.tsx` | Delete | One pool per user |
| `src/lib/pools/copy-predictions.ts` + test | Delete | Dead |
| `src/lib/pools/copy-validation.ts` + test | Delete | Dead |
| `src/lib/pools/active-pool.ts` + test | Delete | Pool derived from `profiles.country` now |
| `src/app/actions/pools.ts` | Edit | Trim to `listAvailablePools` + `getPoolBySlug`. Remove `joinPool`, `leavePool`, `copyPredictionsBetweenPools`, `getMyPoolSummaries`. |
| `src/app/actions/predictions.ts` | Edit | Drop `poolId` parameter; resolve from `profiles.country` server-side |
| `src/app/predict/groups/page.tsx` | Move | From `src/app/pools/[slug]/predict/groups/page.tsx` |
| `src/app/predict/thirds/page.tsx` | Move + rename | From `src/app/pools/[slug]/predict/standings/page.tsx` |
| `src/app/predict/bracket/page.tsx` | Move | From `src/app/pools/[slug]/predict/bracket/page.tsx` |
| `src/app/predict/summary/page.tsx` | Move | From `src/app/pools/[slug]/predict/summary/page.tsx` |
| `src/app/predict/layout.tsx` | Move + simplify | From `src/app/pools/[slug]/predict/layout.tsx`; drop pool-switcher chrome |
| `src/app/leaderboard/page.tsx` | New | Country standings + global player leaderboard |
| `src/app/pools/[slug]/page.tsx` | New (replaces dashboard) | Single-country leaderboard page |
| `src/app/pools/[slug]/predictions/[userId]/page.tsx` | New | Read-only bracket viewer (locked-only via RLS) |
| `src/app/pools/[slug]/layout.tsx` | Edit | Strip predict-tabs chrome; country page only |
| `src/app/pools/[slug]/dashboard/page.tsx` | Delete | Merged into `pools/[slug]/page.tsx` |
| `src/app/pools/page.tsx` | Delete | Replaced by `/leaderboard` |
| `src/app/page.tsx` | Edit | 3-state personalised dashboard for signed-in users |
| `src/components/layout/navbar.tsx` | Edit | Add Predict, Leaderboard, My Office; remove pool tools |
| `next.config.ts` | Edit | Permanent redirects for old pool URLs |

## Two-Phase Deployment

The migration is destructive (user wipe) and the schema and code must agree on the `country` field at signup time. To avoid a window where signup fails:

1. **Phase 1**: Deploy app code with the new signup flow (sends `country` in `user_metadata`). The DB trigger still has the old shape and silently ignores the extra field. Existing users keep working.
2. **Phase 2**: Run migration `008_*.sql`. This wipes users, adds the `country` column, swaps the trigger. From this point onward, signup writes country into `profiles` correctly.

A brief maintenance window is also acceptable; either approach is safe.

## Testing Strategy

### Unit tests (`vitest`)

- `src/lib/predictions/anon-migration.test.ts` — re-keys `anon:draft` under `<userId>:<countryPoolId>`, no-draft no-op, defensive `submitted: true` strip, legacy `anon:<poolId>` keys cleared.
- `src/lib/leaderboard/aggregate.test.ts` — average computation, zero-member country shape, deterministic tie-break, country filter correctness.
- `src/lib/matches/lock.test.ts` — DB function vs JS constant agreement assertion.

### Component / action tests

- `src/components/auth/auth-flow.test.tsx` — country picker required, valid-country-only enforcement.
- `src/app/actions/predictions.test.ts` — `submitPredictionsToDb()` always writes to the user's country pool regardless of any input; unauth callers get auth error.
- `src/app/actions/pools.test.ts` — pared-down API still works for `listAvailablePools` and `getPoolBySlug`.

### Manual smoke checks

- Sign up 6 test users (one per country); each lands in their country pool only.
- Anon predicts → submits → signs up as Spain → predictions land in Spain pool with same scores.
- `/leaderboard` shows all 6 countries even with zero submissions in some.
- A Malta user can browse `/pools/spain` (read-only leaderboard before lock).
- After manually advancing `tournament_settings.lock_at` to a past timestamp on a test DB, clicking any row on `/pools/spain` opens that user's bracket as read-only.
- Old URLs redirect: `/pools/all-offices` → `/leaderboard`; `/pools/spain/predict/groups` → `/predict/groups`.
- A user attempting `INSERT INTO pool_members` for a different country gets RLS-rejected.
- A user attempting `UPDATE profiles SET country='nigeria'` on their own row gets RLS-rejected.

## Edge Cases

- **Anon has stale legacy `anon:<poolId>` localStorage keys from a previous visit (pre-refactor)** — the new code only reads/writes `anon:draft`, so legacy keys are ignored. The migration helper clears them on signup as cleanup so they don't accumulate forever.
- **Anon's draft has stale knockout predictions inconsistent with migrated group standings** — existing `resetAffectedKnockoutPredictions` logic in `predictions-context.tsx` handles bracket invalidation when group results change. No new code needed.
- **Anon localStorage somehow contains `submitted: true`** — defensively stripped during migration. Anon can't actually submit (server requires auth), so this is impossible in practice but cheap to guard against.
- **A user with no submission appearing in `/leaderboard` global ranking** — `user_scores` only exists after a submission triggers scoring, so unsubmitted users are naturally excluded.
- **A country with zero submitted members** — appears on `/leaderboard` with `avgScore = 0`, `memberCount = 0`. Keeps the 6-card UI stable. Could be greyed out visually.
- **A user whose `auth.users` row exists but `profiles` row failed** — the `handle_new_user` trigger is `SECURITY DEFINER`; failures bubble up as auth errors. The signup flow surfaces the message to the user. This matches the existing behaviour.
- **A non-member directly navigates to `/pools/<country>/predictions/<userId>` before lock** — RLS returns empty rows for the prediction queries. The page detects empty data and renders a "Bracket unavailable until tournament starts" state with a link back to `/pools/<country>`. No 500s or partial data leaks.

## Non-Goals

- Real-time live score push to the leaderboard — the existing on-demand sync (spec `2026-05-27-on-demand-espn-sync-design.md`) covers this.
- Allowing users to change country post-signup — admin-only override is mentioned but not built in this spec.
- Per-country branding (custom themes per office) — out of scope.
- Multi-pool participation (e.g. a user in both office and "friends" pools) — explicitly removed from this model.
- Country-vs-country head-to-head visualisations beyond the `/leaderboard` aggregate — out of scope; can be added later if useful.

## Follow-ups Worth Tracking

- **Admin "change country" tool.** Not built in this spec. If a user joins the wrong office and we lock them out, only DB-level access fixes it. Consider a small admin action that bypasses RLS via the service role.
- **Sync the JS lock constant with the DB.** This spec keeps both as long as the vitest assertion catches drift; a future cleanup could remove `FIRST_MATCH_KICKOFF_UTC` entirely once all callers are async.
- **Filter chips and country drill-down on `/leaderboard`.** Could be enhanced later with sortable columns, search, or per-country head-to-head views.
