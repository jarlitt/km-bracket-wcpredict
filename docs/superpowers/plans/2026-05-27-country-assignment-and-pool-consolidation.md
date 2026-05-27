# Country Assignment & Pool Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace multi-pool participation with one office-country pool per user, move predictions to a country-agnostic `/predict/*` flow, and replace `All Offices` with aggregate country/global leaderboards.

**Architecture:** The user's `profiles.country` becomes the single source of truth for competition membership. Signup writes country metadata, a database trigger creates the profile and matching pool membership, and prediction server actions resolve the pool server-side. Public country pages and `/leaderboard` become read-only aggregation surfaces, while prediction editing/submission lives only under `/predict/*`.

**Tech Stack:** Next.js 16 App Router, React client contexts, Supabase Postgres/RLS/triggers, Vitest, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-27-country-assignment-and-pool-consolidation-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/008_country_assignment_and_pool_consolidation.sql` | Create | Wipe test users, drop `all-offices`, add `profiles.country`, add `tournament_settings`, update triggers/RLS |
| `src/lib/pools/seed.ts` | Modify | Remove `all-offices` from code seed list and expose office country slugs |
| `src/components/pools/pool-flag.tsx` | Create | Extract reusable flag/chip UI from old pool cards |
| `src/components/pools/pool-cards.tsx` | Delete | Remove multi-pool membership cards |
| `src/lib/leaderboard/aggregate.ts` | Create | Pure aggregation functions for country standings and global players |
| `src/lib/leaderboard/aggregate.test.ts` | Create | Unit tests for country/global ranking |
| `src/lib/matches/lock.ts` | Modify | Read lock time from `tournament_settings`, keep JS kickoff as fallback |
| `src/lib/matches/lock.test.ts` | Modify/Create | Verify fallback lock behaviour and seed timestamp agreement |
| `src/lib/predictions/storage.ts` | Modify | Add single `anon:draft` helpers and legacy anon-key cleanup |
| `src/lib/predictions/anon-migration.ts` | Create | Move `anon:draft` to `<userId>:<poolId>` after signup |
| `src/lib/predictions/anon-migration.test.ts` | Create | Unit tests for anon draft migration |
| `src/context/auth-context.tsx` | Modify | Add `country`, country-aware signup, draft migration, profile hydration |
| `src/components/auth/auth-flow.tsx` | Modify | Add styled country radio cards to signup form |
| `src/context/pool-context.tsx` | Modify | Simplify pool context to static pools + user's office pool |
| `src/context/predictions-context.tsx` | Modify | Remove auto-join/copy logic; derive pool from auth country |
| `src/app/actions/predictions.ts` | Modify | Resolve country pool server-side; remove client `poolId` parameter |
| `src/app/actions/pools.ts` | Modify | Trim to `listAvailablePools` and `getPoolBySlug` |
| `src/app/leaderboard/page.tsx` | Create | Country standings + global player leaderboard |
| `src/app/pools/[slug]/page.tsx` | Create | Single-country leaderboard page |
| `src/app/pools/[slug]/predictions/[userId]/page.tsx` | Create | Read-only bracket summary viewer |
| `src/app/predict/**` | Create/Move | New top-level predict flow pages/layout |
| `src/app/pools/[slug]/predict/**` | Delete | Old pool-scoped predict routes |
| `src/app/pools/[slug]/dashboard/page.tsx` | Delete | Replaced by `src/app/pools/[slug]/page.tsx` |
| `src/app/pools/page.tsx` | Delete | Replaced by `/leaderboard` redirect |
| `src/app/page.tsx` | Modify | Add signed-in 3-state home dashboard |
| `src/components/layout/navbar.tsx` | Modify | Add Predict, Leaderboard, My Office; preserve Live Score |
| `next.config.ts` | Modify | Redirect old pool/predict URLs |

---

### Task 1: Add the country consolidation migration

**Files:**
- Create: `supabase/migrations/008_country_assignment_and_pool_consolidation.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/008_country_assignment_and_pool_consolidation.sql`:

```sql
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
```

- [ ] **Step 2: Verify the migration has no incomplete markers**

Run: `rg "placeholder|UNFINISHED" supabase/migrations/008_country_assignment_and_pool_consolidation.sql`

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/008_country_assignment_and_pool_consolidation.sql
git commit -m "feat: add country assignment database migration"
```

---

### Task 2: Update static office-pool definitions and reusable pool flag UI

**Files:**
- Modify: `src/lib/pools/seed.ts`
- Create: `src/components/pools/pool-flag.tsx`
- Modify/Delete later: `src/components/pools/pool-cards.tsx`
- Test: `src/lib/pools/seed.test.ts`

- [ ] **Step 1: Update seed expectations test first**

Edit `src/lib/pools/seed.test.ts` so it expects exactly six office pools and no `all-offices` slug. Use this assertion shape:

```typescript
import { describe, expect, it } from 'vitest'
import { PHASE_1_POOLS, PHASE_1_POOL_SLUGS, isOfficePoolSlug } from './seed'

describe('pool seed', () => {
  it('contains only country office pools', () => {
    expect(PHASE_1_POOL_SLUGS).toEqual([
      'spain',
      'malta',
      'nigeria',
      'south-africa',
      'zambia',
      'uk',
    ])
    expect(PHASE_1_POOLS).toHaveLength(6)
    expect(isOfficePoolSlug('all-offices')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the seed test and verify it fails**

Run: `pnpm vitest run src/lib/pools/seed.test.ts`

Expected: FAIL because `all-offices` is still present.

- [ ] **Step 3: Remove `all-offices` from `src/lib/pools/seed.ts`**

Change `PHASE_1_POOLS` to:

```typescript
export const PHASE_1_POOLS: SeedPool[] = [
  { name: 'Spain Office', slug: 'spain', type: 'office', visibility: 'public' },
  { name: 'Malta Office', slug: 'malta', type: 'office', visibility: 'public' },
  { name: 'Nigeria Office', slug: 'nigeria', type: 'office', visibility: 'public' },
  { name: 'South Africa Office', slug: 'south-africa', type: 'office', visibility: 'public' },
  { name: 'Zambia Office', slug: 'zambia', type: 'office', visibility: 'public' },
  { name: 'UK Office', slug: 'uk', type: 'office', visibility: 'public' },
]
```

- [ ] **Step 4: Extract `PoolFlag` and `ArrowChip`**

Create `src/components/pools/pool-flag.tsx`:

```typescript
'use client'

import { ArrowRight, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const POOL_FLAG_BY_SLUG: Record<string, string> = {
  spain: 'spain.svg',
  malta: 'malta.svg',
  nigeria: 'nigeria.svg',
  'south-africa': 'south-africa.svg',
  zambia: 'zambia.svg',
  uk: 'united-kingdom.svg',
}

export function PoolFlag({
  slug,
  size = 32,
  className,
}: {
  slug: string
  size?: number
  className?: string
}) {
  const file = POOL_FLAG_BY_SLUG[slug]
  if (!file) {
    return (
      <span
        className={cn('flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground', className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Globe className="size-4" />
      </span>
    )
  }

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-card', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/country-flags/Countries/${file}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="block h-full w-full object-cover"
      />
    </span>
  )
}

export function ArrowChip({ disabled = false }: { disabled?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors',
        disabled
          ? 'border-border/30 bg-muted/40 text-muted-foreground/60'
          : 'border-border/40 bg-muted/40 text-muted-foreground group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary',
      )}
      aria-hidden="true"
    >
      <ArrowRight className="size-3.5" />
    </span>
  )
}
```

- [ ] **Step 5: Update `pool-cards.tsx` imports or defer deletion**

If `pool-cards.tsx` still exists at this point, replace its local `PoolFlag` and `ArrowChip` definitions with:

```typescript
import { ArrowChip, PoolFlag } from '@/components/pools/pool-flag'
```

Leave deleting membership-specific cards for the later cleanup task, after pages no longer import them.

- [ ] **Step 6: Run the seed test**

Run: `pnpm vitest run src/lib/pools/seed.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pools/seed.ts src/lib/pools/seed.test.ts src/components/pools/pool-flag.tsx src/components/pools/pool-cards.tsx
git commit -m "refactor: remove all-offices from office pool seed"
```

---

### Task 3: Add leaderboard aggregation functions

**Files:**
- Create: `src/lib/leaderboard/aggregate.ts`
- Create: `src/lib/leaderboard/aggregate.test.ts`

- [ ] **Step 1: Write failing aggregation tests**

Create `src/lib/leaderboard/aggregate.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { aggregateLeaderboard } from './aggregate'

const pools = [
  { id: 'pool-spain', slug: 'spain', name: 'Spain Office' },
  { id: 'pool-malta', slug: 'malta', name: 'Malta Office' },
]

const profiles = [
  { id: 'u1', display_name: 'Ana', country: 'spain' },
  { id: 'u2', display_name: 'Bea', country: 'spain' },
  { id: 'u3', display_name: 'Carl', country: 'malta' },
]

describe('aggregateLeaderboard', () => {
  it('ranks countries by average score and exposes secondary stats', () => {
    const result = aggregateLeaderboard(
      [
        { user_id: 'u1', pool_id: 'pool-spain', total_score: 100 },
        { user_id: 'u2', pool_id: 'pool-spain', total_score: 50 },
        { user_id: 'u3', pool_id: 'pool-malta', total_score: 90 },
      ],
      profiles,
      pools,
    )

    expect(result.countryStandings).toEqual([
      { slug: 'malta', name: 'Malta Office', avgScore: 90, totalScore: 90, memberCount: 1 },
      { slug: 'spain', name: 'Spain Office', avgScore: 75, totalScore: 150, memberCount: 2 },
    ])
  })

  it('includes countries with zero submitted members', () => {
    const result = aggregateLeaderboard([], profiles, pools)
    expect(result.countryStandings).toEqual([
      { slug: 'spain', name: 'Spain Office', avgScore: 0, totalScore: 0, memberCount: 0 },
      { slug: 'malta', name: 'Malta Office', avgScore: 0, totalScore: 0, memberCount: 0 },
    ])
  })

  it('ranks global players by score then display name', () => {
    const result = aggregateLeaderboard(
      [
        { user_id: 'u2', pool_id: 'pool-spain', total_score: 100 },
        { user_id: 'u1', pool_id: 'pool-spain', total_score: 100 },
        { user_id: 'u3', pool_id: 'pool-malta', total_score: 90 },
      ],
      profiles,
      pools,
    )

    expect(result.globalPlayers.map((p) => [p.rank, p.displayName, p.totalScore])).toEqual([
      [1, 'Ana', 100],
      [2, 'Bea', 100],
      [3, 'Carl', 90],
    ])
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `pnpm vitest run src/lib/leaderboard/aggregate.test.ts`

Expected: FAIL because `aggregate.ts` does not exist.

- [ ] **Step 3: Implement aggregation**

Create `src/lib/leaderboard/aggregate.ts`:

```typescript
interface ScoreRow {
  user_id: string
  pool_id: string
  total_score: number
}

interface ProfileRow {
  id: string
  display_name: string
  country: string
}

interface PoolRow {
  id: string
  slug: string
  name: string
}

export interface CountryStanding {
  slug: string
  name: string
  avgScore: number
  totalScore: number
  memberCount: number
}

export interface GlobalPlayer {
  rank: number
  userId: string
  displayName: string
  country: string
  totalScore: number
}

export function aggregateLeaderboard(
  scores: ScoreRow[],
  profiles: ProfileRow[],
  pools: PoolRow[],
): { countryStandings: CountryStanding[]; globalPlayers: GlobalPlayer[] } {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const statsByCountry = new Map<string, { totalScore: number; memberCount: number }>()

  for (const pool of pools) {
    statsByCountry.set(pool.slug, { totalScore: 0, memberCount: 0 })
  }

  const globalPlayers = scores
    .map((score) => {
      const profile = profileById.get(score.user_id)
      if (!profile) return null
      const stats = statsByCountry.get(profile.country)
      if (stats) {
        stats.totalScore += score.total_score
        stats.memberCount += 1
      }
      return {
        rank: 0,
        userId: score.user_id,
        displayName: profile.display_name,
        country: profile.country,
        totalScore: score.total_score,
      }
    })
    .filter((player): player is Omit<GlobalPlayer, 'rank'> & { rank: number } => player !== null)
    .sort((a, b) => b.totalScore - a.totalScore || a.displayName.localeCompare(b.displayName))
    .map((player, index) => ({ ...player, rank: index + 1 }))

  const countryStandings = pools
    .map((pool) => {
      const stats = statsByCountry.get(pool.slug) ?? { totalScore: 0, memberCount: 0 }
      return {
        slug: pool.slug,
        name: pool.name,
        totalScore: stats.totalScore,
        memberCount: stats.memberCount,
        avgScore: stats.memberCount === 0 ? 0 : stats.totalScore / stats.memberCount,
      }
    })
    .sort((a, b) => b.avgScore - a.avgScore || a.name.localeCompare(b.name))

  return { countryStandings, globalPlayers }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/lib/leaderboard/aggregate.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard/aggregate.ts src/lib/leaderboard/aggregate.test.ts
git commit -m "feat: add leaderboard aggregation helpers"
```

---

### Task 4: Implement single-key anonymous draft migration

**Files:**
- Modify: `src/lib/predictions/storage.ts`
- Create: `src/lib/predictions/anon-migration.ts`
- Create: `src/lib/predictions/anon-migration.test.ts`

- [ ] **Step 1: Write failing anon-migration tests**

Create `src/lib/predictions/anon-migration.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { defaultPredictionsState } from './storage'
import { migrateAnonDraftToCountryPool } from './anon-migration'

function storageWith(entries: Record<string, string>): Storage {
  const data = new Map(Object.entries(entries))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('migrateAnonDraftToCountryPool', () => {
  it('moves anon:draft to the user/pool scope', () => {
    const draft = {
      ...defaultPredictionsState,
      groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
    }
    const storage = storageWith({ 'wc2026:predictions:anon:draft': JSON.stringify(draft) })

    const migrated = migrateAnonDraftToCountryPool(storage, 'user-1', 'pool-spain')

    expect(migrated).toBe(true)
    expect(storage.getItem('wc2026:predictions:anon:draft')).toBeNull()
    expect(JSON.parse(storage.getItem('wc2026:predictions:user-1:pool-spain') ?? '{}')).toMatchObject({
      groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
      submitted: false,
    })
  })

  it('returns false when there is no anon draft', () => {
    const storage = storageWith({})
    expect(migrateAnonDraftToCountryPool(storage, 'user-1', 'pool-spain')).toBe(false)
  })

  it('clears legacy anon pool keys', () => {
    const storage = storageWith({
      'wc2026:predictions:anon:old-pool': JSON.stringify(defaultPredictionsState),
    })
    migrateAnonDraftToCountryPool(storage, 'user-1', 'pool-spain')
    expect(storage.getItem('wc2026:predictions:anon:old-pool')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm vitest run src/lib/predictions/anon-migration.test.ts`

Expected: FAIL because `anon-migration.ts` does not exist and storage helpers are not single-key aware.

- [ ] **Step 3: Add storage constants and helpers**

Edit `src/lib/predictions/storage.ts` to expose these constants/helpers while preserving existing read/write functions:

```typescript
export const PREDICTIONS_STORAGE_PREFIX = 'wc2026:predictions'
export const ANON_DRAFT_STORAGE_KEY = `${PREDICTIONS_STORAGE_PREFIX}:anon:draft`

export function scopedPredictionsStorageKey(userId: string, poolId: string): string {
  return `${PREDICTIONS_STORAGE_PREFIX}:${userId}:${poolId}`
}

export function legacyAnonPredictionKeys(storage: Storage): string[] {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(`${PREDICTIONS_STORAGE_PREFIX}:anon:`) && key !== ANON_DRAFT_STORAGE_KEY) {
      keys.push(key)
    }
  }
  return keys
}
```

Then update existing internal key construction to use `scopedPredictionsStorageKey(userId, poolId)` for authenticated users and `ANON_DRAFT_STORAGE_KEY` for anonymous users.

- [ ] **Step 4: Implement anon migration**

Create `src/lib/predictions/anon-migration.ts`:

```typescript
import {
  ANON_DRAFT_STORAGE_KEY,
  legacyAnonPredictionKeys,
  scopedPredictionsStorageKey,
  type PredictionsState,
} from '@/lib/predictions/storage'

export function migrateAnonDraftToCountryPool(
  storage: Storage,
  userId: string,
  poolId: string,
): boolean {
  const rawDraft = storage.getItem(ANON_DRAFT_STORAGE_KEY)
  let migrated = false

  if (rawDraft) {
    try {
      const draft = JSON.parse(rawDraft) as PredictionsState
      storage.setItem(
        scopedPredictionsStorageKey(userId, poolId),
        JSON.stringify({ ...draft, submitted: false }),
      )
      migrated = true
    } catch {
      migrated = false
    }
    storage.removeItem(ANON_DRAFT_STORAGE_KEY)
  }

  for (const key of legacyAnonPredictionKeys(storage)) {
    storage.removeItem(key)
  }

  return migrated
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/lib/predictions/anon-migration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/predictions/storage.ts src/lib/predictions/anon-migration.ts src/lib/predictions/anon-migration.test.ts
git commit -m "feat: add single anonymous prediction draft migration"
```

---

### Task 5: Add country-aware auth signup

**Files:**
- Modify: `src/context/auth-context.tsx`
- Modify: `src/components/auth/auth-flow.tsx`
- Create: `src/components/auth/auth-validation.ts`
- Test: `src/components/auth/auth-validation.test.ts`

- [ ] **Step 1: Write signup validation tests**

The project does not currently include React Testing Library, so test a small validation helper instead of adding new dependencies. Create `src/components/auth/auth-validation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { isOfficeCountrySlug, validateSignupFields } from './auth-validation'

describe('signup validation', () => {
  it('requires an office country', () => {
    expect(validateSignupFields({
      displayName: 'Jorge',
      email: 'jorge@example.com',
      password: 'password123',
      country: '',
    })).toMatchObject({ country: 'Office country is required' })
  })

  it('rejects invalid country slugs', () => {
    expect(isOfficeCountrySlug('argentina')).toBe(false)
    expect(isOfficeCountrySlug('spain')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm vitest run src/components/auth/auth-validation.test.ts`

Expected: FAIL because `auth-validation.ts` does not exist.

- [ ] **Step 3: Add signup validation helper**

Create `src/components/auth/auth-validation.ts`:

```typescript
export const OFFICE_COUNTRIES = [
  { slug: 'spain', label: 'Spain Office' },
  { slug: 'malta', label: 'Malta Office' },
  { slug: 'nigeria', label: 'Nigeria Office' },
  { slug: 'south-africa', label: 'South Africa Office' },
  { slug: 'zambia', label: 'Zambia Office' },
  { slug: 'uk', label: 'UK Office' },
] as const

export type OfficeCountrySlug = (typeof OFFICE_COUNTRIES)[number]['slug']

export function isOfficeCountrySlug(value: string): value is OfficeCountrySlug {
  return OFFICE_COUNTRIES.some((country) => country.slug === value)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateSignupFields({
  displayName,
  email,
  password,
  country,
}: {
  displayName: string
  email: string
  password: string
  country: string
}) {
  const errors: { name?: string; email?: string; password?: string; country?: string } = {}
  if (!displayName) errors.name = 'Name is required'
  if (!email) errors.email = 'Email is required'
  else if (!isValidEmail(email)) errors.email = 'Enter a valid email address'
  if (!password) errors.password = 'Password is required'
  else if (password.length < 6) errors.password = 'Must be at least 6 characters'
  if (!country) errors.country = 'Office country is required'
  else if (!isOfficeCountrySlug(country)) errors.country = 'Select a valid office country'
  return errors
}
```

- [ ] **Step 4: Extend auth types and signup signature**

Edit `src/context/auth-context.tsx`:

```typescript
interface User {
  id: string
  email: string
  displayName: string
  country: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string, next?: string) => Promise<string | null>
  signup: (email: string, password: string, displayName: string, country: string, next?: string) => Promise<string | null>
  logout: () => void
  resetPasswordRequest: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
}
```

Add a `loadProfileCountry(userId: string)` helper that reads `profiles.country`, and update `mapSupabaseUser` flow to hydrate `country` before calling `setUser`.

- [ ] **Step 5: Write signup country metadata**

Update `signup()` in `auth-context.tsx`:

```typescript
const signup = useCallback(async (
  email: string,
  password: string,
  displayName: string,
  country: string,
  next?: string,
): Promise<string | null> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, country } },
  })
  if (error) return error.message

  if (data.user && typeof window !== 'undefined') {
    const pool = await resolvePoolBySlug(country)
    if (pool) migrateAnonDraftToCountryPool(window.localStorage, data.user.id, pool.id)
  }

  router.replace(safeNextPath(next).startsWith('/predict') ? safeNextPath(next) : '/predict/groups')
  return null
}, [supabase.auth, router])
```

Define `resolvePoolBySlug(country)` with `listAvailablePools()` or a small client Supabase query against public `pools`. Keep error handling defensive: if pool lookup fails, skip migration and send the user to `/predict/groups`.

- [ ] **Step 6: Add styled country radio cards**

Edit `src/components/auth/auth-flow.tsx`. Import `OFFICE_COUNTRIES` and `validateSignupFields` from `./auth-validation`.

Add state:

```typescript
const [country, setCountry] = useState('')
```

In signup validation, replace inline signup validation with:

```typescript
const nextErrors = validateSignupFields({ displayName, email, password, country })
```

Extend `errors` type with `country?: string`, pass `country` into `signup(email, password, displayName, country, next)`, and render cards below display name:

```tsx
<div className="space-y-2">
  <Label>Office country</Label>
  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
    {OFFICE_COUNTRIES.map((office) => (
      <button
        key={office.slug}
        type="button"
        onClick={() => {
          setCountry(office.slug)
          setErrors((prev) => ({ ...prev, country: undefined }))
        }}
        className={cn(
          'rounded-xl border p-3 text-left transition-colors',
          country === office.slug
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border/50 bg-card/40 text-muted-foreground hover:bg-card/70',
        )}
        aria-pressed={country === office.slug}
      >
        <span className="font-medium">{office.label}</span>
      </button>
    ))}
  </div>
  {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
</div>
```

- [ ] **Step 7: Run tests**

Run: `pnpm vitest run src/components/auth/auth-validation.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/context/auth-context.tsx src/components/auth/auth-flow.tsx src/components/auth/auth-validation.ts src/components/auth/auth-validation.test.ts
git commit -m "feat: require office country during signup"
```

---

### Task 6: Refactor lock handling to read `tournament_settings`

**Files:**
- Modify: `src/lib/matches/lock.ts`
- Test: `src/lib/matches/lock.test.ts`

- [ ] **Step 1: Add lock tests**

Create or update `src/lib/matches/lock.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { FIRST_MATCH_KICKOFF_UTC, isLockedAt } from './lock'

describe('tournament lock helpers', () => {
  it('fallback kickoff matches the migration seed', () => {
    expect(FIRST_MATCH_KICKOFF_UTC.toISOString()).toBe('2026-06-11T16:00:00.000Z')
  })

  it('compares a date against lock_at', () => {
    const lockAt = new Date('2026-06-11T16:00:00Z')
    expect(isLockedAt(new Date('2026-06-11T15:59:59Z'), lockAt)).toBe(false)
    expect(isLockedAt(new Date('2026-06-11T16:00:00Z'), lockAt)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test and verify failure if `isLockedAt` is absent**

Run: `pnpm vitest run src/lib/matches/lock.test.ts`

Expected: FAIL if `isLockedAt` is not exported.

- [ ] **Step 3: Export lock comparison and async fetcher**

Edit `src/lib/matches/lock.ts`:

```typescript
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES } from '@/lib/data/matches'
import type { GroupMatch } from '@/types'

// keep existing parseGroupMatchKickoffUtc and FIRST_MATCH_KICKOFF_UTC

export function isLockedAt(now: Date, lockAt: Date): boolean {
  return now.getTime() >= lockAt.getTime()
}

export const getTournamentLockAt = cache(async (): Promise<Date> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tournament_settings')
    .select('lock_at')
    .eq('id', 1)
    .maybeSingle()

  return data?.lock_at ? new Date(data.lock_at as string) : FIRST_MATCH_KICKOFF_UTC
})

export async function isTournamentLocked(now = new Date()): Promise<boolean> {
  return isLockedAt(now, await getTournamentLockAt())
}
```

Then find sync callers of `isTournamentLocked()` and either:
- await the new async function in server actions/components, or
- use a client-side lock value passed from a provider in a later task.

- [ ] **Step 4: Run lock tests**

Run: `pnpm vitest run src/lib/matches/lock.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matches/lock.ts src/lib/matches/lock.test.ts
git commit -m "feat: read tournament lock time from settings"
```

---

### Task 7: Simplify pool actions and context

**Files:**
- Modify: `src/app/actions/pools.ts`
- Modify: `src/context/pool-context.tsx`
- Test: `src/app/actions/pools.test.ts`

- [ ] **Step 1: Update pool action tests**

Edit `src/app/actions/pools.test.ts` to remove tests for `joinPool`, `leavePool`, `copyPredictionsBetweenPools`, and `getMyPoolSummaries`. Keep/adjust tests for:

```typescript
expect(await listAvailablePools()).toEqual(expect.arrayContaining([
  expect.objectContaining({ slug: 'spain' }),
]))
expect(await getPoolBySlug('spain')).toEqual(expect.objectContaining({ slug: 'spain' }))
```

- [ ] **Step 2: Run tests and verify failures from removed expectations**

Run: `pnpm vitest run src/app/actions/pools.test.ts`

Expected: FAIL until implementation is trimmed.

- [ ] **Step 3: Trim `src/app/actions/pools.ts`**

Remove exports and helper code used only by multi-pool membership/copy flows:

```typescript
export async function listAvailablePools(): Promise<Pool[]> { /* keep existing implementation */ }
export async function getPoolBySlug(slug: string): Promise<Pool | null> { /* keep existing implementation */ }
```

Delete `joinPool`, `leavePool`, `copyPredictionsBetweenPools`, `getMyPoolSummaries`, copy-row helpers, and profile fallback helpers from this file if no other code imports them after later tasks.

- [ ] **Step 4: Simplify `PoolProvider`**

Edit `src/context/pool-context.tsx` to expose:

```typescript
interface PoolContextType {
  availablePools: Pool[]
  userPool: Pool | null
  loading: boolean
  refresh: () => Promise<void>
}
```

Derive `userPool` from `user.country`:

```typescript
const userPool = useMemo(
  () => availablePools.find((pool) => pool.slug === user?.country) ?? null,
  [availablePools, user?.country],
)
```

Remove `memberships`, `myPoolSummaries`, `activePool`, `setActivePoolBySlug`, `usePathname`, `useSyncExternalStore`, and localStorage active-pool logic.

- [ ] **Step 5: Run pool tests**

Run: `pnpm vitest run src/app/actions/pools.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/pools.ts src/app/actions/pools.test.ts src/context/pool-context.tsx
git commit -m "refactor: simplify pool model to office country"
```

---

### Task 8: Refactor prediction server actions to resolve user pool server-side

**Files:**
- Modify: `src/app/actions/predictions.ts`
- Test: `src/app/actions/predictions.test.ts`

- [ ] **Step 1: Add/adjust prediction action tests**

In `src/app/actions/predictions.test.ts`, update calls so `loadPredictions()` and `submitPredictionsToDb()` no longer receive a `poolId`. Add a test named `submitPredictionsToDb resolves the user's country pool server-side`.

Expected test shape:

```typescript
const result = await submitPredictionsToDb(
  { 1: { scoreA: 1, scoreB: 0 } },
  { 'R32-1': 10 },
  { 'R32-1': { teamAId: 10, teamBId: 20 } },
)
expect(result.success).toBe(true)
```

- [ ] **Step 2: Run tests and verify type failures**

Run: `pnpm vitest run src/app/actions/predictions.test.ts`

Expected: FAIL because the action signatures still require `poolId`.

- [ ] **Step 3: Add helper to resolve current user's pool**

Inside `src/app/actions/predictions.ts`:

```typescript
async function getCurrentUserPoolId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ userId: string; poolId: string } | { error: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('country')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || !profile?.country) return { error: 'Profile country is missing' }

  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id')
    .eq('slug', profile.country)
    .maybeSingle()
  if (poolError || !pool?.id) return { error: 'Office pool not found' }

  return { userId: user.id, poolId: pool.id as string }
}
```

- [ ] **Step 4: Update action signatures**

Change:

```typescript
export async function loadPredictions(): Promise<LoadedPredictions | null>
export async function submitPredictionsToDb(
  groupPredictions: PredictionsState['groupPredictions'],
  knockoutPredictions: PredictionsState['knockoutPredictions'],
  knockoutMatchups: Record<string, KnockoutMatchup>,
): Promise<ActionResult>
```

Within both functions, call `getCurrentUserPoolId()` and use the returned `poolId`.

- [ ] **Step 5: Run prediction tests**

Run: `pnpm vitest run src/app/actions/predictions.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/predictions.ts src/app/actions/predictions.test.ts
git commit -m "refactor: resolve prediction pool from user country"
```

---

### Task 9: Move prediction routes to `/predict/*`

**Files:**
- Create/Move: `src/app/predict/layout.tsx`
- Create/Move: `src/app/predict/groups/page.tsx`
- Create/Move: `src/app/predict/thirds/page.tsx`
- Create/Move: `src/app/predict/bracket/page.tsx`
- Create/Move: `src/app/predict/summary/page.tsx`
- Modify: any internal links from `/pools/${slug}/predict/...` to `/predict/...`

- [ ] **Step 1: Move files**

Create the new directory and move files:

```bash
mkdir -p src/app/predict
git mv src/app/pools/[slug]/predict/layout.tsx src/app/predict/layout.tsx
git mv src/app/pools/[slug]/predict/groups/page.tsx src/app/predict/groups/page.tsx
git mv src/app/pools/[slug]/predict/standings/page.tsx src/app/predict/thirds/page.tsx
git mv src/app/pools/[slug]/predict/bracket/page.tsx src/app/predict/bracket/page.tsx
git mv src/app/pools/[slug]/predict/summary/page.tsx src/app/predict/summary/page.tsx
```

- [ ] **Step 2: Remove slug dependencies**

In moved files:
- Delete `useParams` imports.
- Replace `const basePath = \`/pools/${slug}/predict\`` with `const basePath = '/predict'`.
- Replace all links to `standings` with `thirds`.
- Ensure `PredictionsProvider` still wraps these pages in `src/app/predict/layout.tsx`.

- [ ] **Step 3: Update action calls**

In `src/context/predictions-context.tsx` and moved pages, remove `poolId` arguments to `loadPredictions()` and `submitPredictionsToDb()`.

- [ ] **Step 4: Run TypeScript**

Run: `pnpm tsc --noEmit`

Expected: Type errors for remaining old imports/links; fix each by replacing pool-scoped paths with `/predict/*`.

- [ ] **Step 5: Commit**

```bash
git add src/app/predict src/app/pools/[slug]/predict src/context/predictions-context.tsx
git commit -m "refactor: move prediction flow to top-level routes"
```

---

### Task 10: Simplify predictions context

**Files:**
- Modify: `src/context/predictions-context.tsx`
- Delete later: copy-prediction imports and membership reconciliation imports if unused

- [ ] **Step 1: Remove multi-pool context dependencies**

In `src/context/predictions-context.tsx`, remove imports:

```typescript
import { usePools } from '@/context/pool-context'
import { copyPredictionsBetweenPools, joinPool } from '@/app/actions/pools'
import { reconcilePredictionStateForMembership } from '@/lib/predictions/membership-state'
```

- [ ] **Step 2: Derive pool from auth**

In `PredictionsProvider`, use:

```typescript
const { user } = useAuth()
const userId = user?.id ?? null
const poolId = user?.country ?? null
```

For local storage, use the resolved DB pool ID if available. If this requires async pool lookup, add a small `usePools().userPool` dependency only for `userPool?.id`, not membership state.

- [ ] **Step 3: Delete auto-join and copy logic**

Remove:
- `membershipRefreshPending`
- `autoJoinAttemptedRef`
- `tryAutoJoin`
- `copyPredictionsFromPool`
- `hasActivePool` logic tied to active pools
- `isMember` logic

Replace all calls to `tryAutoJoin()` in autofill/group setters with no-ops; prediction editing should only update local state until submit.

- [ ] **Step 4: Keep state persistence**

Ensure anonymous users still save under `anon:draft` and authenticated users save under `<userId>:<poolId>`. The existing `loadFromStorage`/`saveToStorage` helpers should call the updated storage helpers from Task 4.

- [ ] **Step 5: Run TypeScript**

Run: `pnpm tsc --noEmit`

Expected: PASS after removing stale references.

- [ ] **Step 6: Commit**

```bash
git add src/context/predictions-context.tsx
git commit -m "refactor: simplify predictions context for single office pool"
```

---

### Task 11: Build `/leaderboard`

**Files:**
- Create: `src/app/leaderboard/page.tsx`
- Create: `src/components/leaderboard/global-player-table.tsx` (client filter/table)
- Use: `src/lib/leaderboard/aggregate.ts`
- Use: `src/components/pools/pool-flag.tsx`

- [ ] **Step 1: Create client table component**

Create `src/components/leaderboard/global-player-table.tsx`:

```typescript
'use client'

import { useMemo, useState } from 'react'
import { PoolFlag } from '@/components/pools/pool-flag'
import type { GlobalPlayer } from '@/lib/leaderboard/aggregate'

export function GlobalPlayerTable({
  players,
  countries,
}: {
  players: GlobalPlayer[]
  countries: Array<{ slug: string; name: string }>
}) {
  const [country, setCountry] = useState('all')
  const filtered = useMemo(
    () => country === 'all' ? players : players.filter((player) => player.country === country),
    [country, players],
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCountry('all')} className="rounded-full border px-3 py-1 text-sm">All countries</button>
        {countries.map((entry) => (
          <button key={entry.slug} type="button" onClick={() => setCountry(entry.slug)} className="rounded-full border px-3 py-1 text-sm">
            {entry.name}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {filtered.map((player) => (
          <div key={player.userId} className="flex items-center gap-3 border-b border-border/30 px-4 py-3 last:border-b-0">
            <span className="w-8 text-sm font-bold">#{player.rank}</span>
            <PoolFlag slug={player.country} size={24} />
            <span className="flex-1 font-medium">{player.displayName}</span>
            <span className="font-bold">{player.totalScore}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Create `/leaderboard` server page**

Create `src/app/leaderboard/page.tsx`:

```typescript
import Link from 'next/link'
import { GlobalPlayerTable } from '@/components/leaderboard/global-player-table'
import { PoolFlag } from '@/components/pools/pool-flag'
import { aggregateLeaderboard } from '@/lib/leaderboard/aggregate'
import { createClient } from '@/lib/supabase/server'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const [{ data: scores }, { data: profiles }, { data: pools }] = await Promise.all([
    supabase.from('user_scores').select('user_id, pool_id, total_score'),
    supabase.from('profiles').select('id, display_name, country'),
    supabase.from('pools').select('id, slug, name').eq('is_active', true),
  ])
  const { countryStandings, globalPlayers } = aggregateLeaderboard(scores ?? [], profiles ?? [], pools ?? [])

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section>
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Compare offices by average score and see the global player ranking.</p>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        {countryStandings.map((country, index) => (
          <Link key={country.slug} href={`/pools/${country.slug}`} className="rounded-xl border border-border/50 bg-card/50 p-4 transition-colors hover:bg-card/80">
            <div className="flex items-center gap-3">
              <PoolFlag slug={country.slug} />
              <div>
                <p className="text-xs text-muted-foreground">#{index + 1}</p>
                <h2 className="font-semibold">{country.name}</h2>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-muted-foreground">Avg</p><p className="font-bold">{country.avgScore.toFixed(1)}</p></div>
              <div><p className="text-muted-foreground">Total</p><p className="font-bold">{country.totalScore}</p></div>
              <div><p className="text-muted-foreground">Players</p><p className="font-bold">{country.memberCount}</p></div>
            </div>
          </Link>
        ))}
      </section>
      <GlobalPlayerTable
        players={globalPlayers}
        countries={countryStandings.map(({ slug, name }) => ({ slug, name }))}
      />
    </main>
  )
}
```

- [ ] **Step 3: Run TypeScript**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/leaderboard/page.tsx src/components/leaderboard/global-player-table.tsx
git commit -m "feat: add aggregate leaderboard page"
```

---

### Task 12: Build single-country page and read-only bracket viewer

**Files:**
- Create: `src/app/pools/[slug]/page.tsx`
- Create: `src/app/pools/[slug]/predictions/[userId]/page.tsx`
- Modify: shared summary rendering if needed

- [ ] **Step 1: Create country page**

Create `src/app/pools/[slug]/page.tsx` with server data loading for pool, profiles, scores, and lock status. Rows link after lock only:

```typescript
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PoolFlag } from '@/components/pools/pool-flag'
import { isTournamentLocked } from '@/lib/matches/lock'
import { createClient } from '@/lib/supabase/server'

export default async function CountryPoolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const locked = await isTournamentLocked()
  const { data: pool } = await supabase.from('pools').select('id, slug, name').eq('slug', slug).maybeSingle()
  if (!pool) notFound()

  const { data: rows } = await supabase
    .from('user_scores')
    .select('user_id, total_score, profiles!inner(display_name, country)')
    .eq('profiles.country', slug)
    .order('total_score', { ascending: false })

  const players = rows ?? []
  const total = players.reduce((sum, row) => sum + ((row.total_score as number) ?? 0), 0)
  const avg = players.length === 0 ? 0 : total / players.length

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="rounded-xl border border-border/50 bg-card/50 p-5">
        <div className="flex items-center gap-3">
          <PoolFlag slug={slug} size={40} />
          <div>
            <h1 className="text-2xl font-bold">{pool.name}</h1>
            <p className="text-sm text-muted-foreground">Average {avg.toFixed(1)} · {players.length} submitted members · Total {total}</p>
          </div>
        </div>
      </header>
      <section className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
        {players.map((row, index) => {
          const content = (
            <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3 last:border-b-0">
              <span className="w-8 font-bold">#{index + 1}</span>
              <span className="flex-1">{Array.isArray(row.profiles) ? row.profiles[0]?.display_name : row.profiles?.display_name}</span>
              <span className="font-bold">{row.total_score as number}</span>
            </div>
          )
          return locked
            ? <Link key={row.user_id as string} href={`/pools/${slug}/predictions/${row.user_id}`}>{content}</Link>
            : <div key={row.user_id as string}>{content}</div>
        })}
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Create read-only bracket viewer placeholder**

Create `src/app/pools/[slug]/predictions/[userId]/page.tsx`. Initially render fetched data counts and inaccessible state; later improve by extracting summary components:

```typescript
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function UserPredictionViewerPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>
}) {
  const { slug, userId } = await params
  const supabase = await createClient()
  const { data: pool } = await supabase.from('pools').select('id, name').eq('slug', slug).maybeSingle()
  if (!pool) notFound()

  const [{ data: profile }, { data: groupRows }, { data: knockoutRows }] = await Promise.all([
    supabase.from('profiles').select('display_name, country').eq('id', userId).maybeSingle(),
    supabase.from('group_predictions').select('match_id, predicted_score_a, predicted_score_b').eq('user_id', userId).eq('pool_id', pool.id),
    supabase.from('knockout_predictions').select('match_id, predicted_winner_id, team_a_id, team_b_id').eq('user_id', userId).eq('pool_id', pool.id),
  ])

  if (!profile || (groupRows ?? []).length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Bracket unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">This bracket is unavailable until the tournament starts.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">{profile.display_name}&apos;s bracket</h1>
      <p className="text-sm text-muted-foreground">{pool.name} · {groupRows?.length ?? 0} group predictions · {knockoutRows?.length ?? 0} knockout predictions</p>
    </main>
  )
}
```

- [ ] **Step 3: Run TypeScript**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/pools/[slug]/page.tsx src/app/pools/[slug]/predictions/[userId]/page.tsx
git commit -m "feat: add country leaderboard pages"
```

---

### Task 13: Update home page dashboard and navbar

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/layout/navbar.tsx`

- [ ] **Step 1: Update navbar links**

In `src/components/layout/navbar.tsx`, replace `NAV_LINKS` with signed-in aware rendering:

```typescript
const PUBLIC_NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/rules', label: 'Rules' },
]

const AUTH_NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/predict/groups', label: 'Predict' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/rules', label: 'Rules' },
]
```

Render `My Office` for signed-in users with `href={`/pools/${user.country}`}` and preserve `<LiveScoreLink />` exactly as it is.

- [ ] **Step 2: Update home CTA**

In `src/app/page.tsx`, change anon "Start Predicting" link from `/pools` to `/predict/groups`.

- [ ] **Step 3: Add signed-in dashboard states**

Use server/client auth patterns already present in the app. If `HomePage` remains server-rendered, query Supabase server-side for the current user, profile, group prediction count, submission, and score. Render:

```tsx
// Not started
<Link href="/predict/groups">Make your bracket</Link>

// In progress
<Link href="/predict/groups">Continue your bracket</Link>

// Submitted
<Link href="/leaderboard">View leaderboard</Link>
<Link href={`/pools/${country}`}>View My Office</Link>
```

- [ ] **Step 4: Run TypeScript**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/layout/navbar.tsx
git commit -m "feat: update home and navigation for office pools"
```

---

### Task 14: Delete obsolete multi-pool UI and logic

**Files:**
- Delete: `src/components/pools/copy-predictions-dialog.tsx`
- Delete: `src/components/pools/leave-pool-button.tsx`
- Delete: `src/components/pools/pool-switcher.tsx`
- Delete: `src/components/pools/pool-cards.tsx`
- Delete: `src/lib/pools/copy-predictions.ts`
- Delete: `src/lib/pools/copy-predictions.test.ts`
- Delete: `src/lib/pools/copy-validation.ts`
- Delete: `src/lib/pools/copy-validation.test.ts`
- Delete: `src/lib/pools/active-pool.ts`
- Delete: `src/lib/pools/active-pool.test.ts`
- Modify: any imports referencing these files

- [ ] **Step 1: Search for obsolete imports**

Run: `rg "copyPredictions|CopyPredictions|LeavePool|PoolSwitcher|active-pool|pool-cards|copy-validation|copy-predictions" src`

Expected: output lists all remaining references.

- [ ] **Step 2: Remove imports and usage**

For each reference:
- Replace `PoolFlag` imports with `@/components/pools/pool-flag`.
- Delete UI controls for copy/leave/switch from layouts.
- Delete code paths for copy/join/leave actions.

- [ ] **Step 3: Delete files**

Run:

```bash
git rm src/components/pools/copy-predictions-dialog.tsx \
  src/components/pools/leave-pool-button.tsx \
  src/components/pools/pool-switcher.tsx \
  src/components/pools/pool-cards.tsx \
  src/lib/pools/copy-predictions.ts \
  src/lib/pools/copy-predictions.test.ts \
  src/lib/pools/copy-validation.ts \
  src/lib/pools/copy-validation.test.ts \
  src/lib/pools/active-pool.ts \
  src/lib/pools/active-pool.test.ts
```

- [ ] **Step 4: Run TypeScript**

Run: `pnpm tsc --noEmit`

Expected: PASS; if not, remove remaining stale imports.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove obsolete multi-pool flows"
```

---

### Task 15: Remove old pool pages and add redirects

**Files:**
- Delete: `src/app/pools/page.tsx`
- Delete: `src/app/pools/[slug]/dashboard/page.tsx`
- Modify: `src/app/pools/[slug]/layout.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Simplify pool layout**

Edit `src/app/pools/[slug]/layout.tsx` so it only renders `{children}` with simple country page structure. Remove imports and usage of copy/leave/switcher and predict/dashboard tabs.

- [ ] **Step 2: Delete replaced pages**

Run:

```bash
git rm src/app/pools/page.tsx src/app/pools/[slug]/dashboard/page.tsx
```

- [ ] **Step 3: Add redirects**

Edit `next.config.ts` redirects to include:

```typescript
{
  source: '/pools/all-offices',
  destination: '/leaderboard',
  permanent: true,
},
{
  source: '/pools/all-offices/:path*',
  destination: '/leaderboard',
  permanent: true,
},
{
  source: '/pools/:slug/predict',
  destination: '/predict/groups',
  permanent: true,
},
{
  source: '/pools/:slug/predict/:rest*',
  destination: '/predict/:rest*',
  permanent: true,
},
{
  source: '/pools/:slug/dashboard',
  destination: '/pools/:slug',
  permanent: true,
},
{
  source: '/pools',
  destination: '/leaderboard',
  permanent: true,
},
```

Preserve existing redirects if any.

- [ ] **Step 4: Run TypeScript**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A next.config.ts src/app/pools/[slug]/layout.tsx
git commit -m "refactor: replace pool routes with leaderboard redirects"
```

---

### Task 16: Final verification pass

**Files:**
- Modify as needed based on failures

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`

Expected: PASS. Fix failures by updating stale test expectations from multi-pool to one-country-pool semantics.

- [ ] **Step 2: Run TypeScript**

Run: `pnpm tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 4: Manual smoke test in dev**

Run: `pnpm dev`

Expected: app starts. Manually verify:
- `/` loads.
- `/predict/groups` loads for anon.
- Signup form shows office country cards.
- `/leaderboard` loads and shows six countries.
- `/pools/spain` loads.
- `/pools/all-offices` redirects to `/leaderboard`.
- `/pools/spain/predict/groups` redirects to `/predict/groups`.

- [ ] **Step 5: Commit final fixes**

```bash
git add -A
git commit -m "test: verify country assignment consolidation"
```

---

## Rollout Notes

1. Deploy app code first.
2. Snapshot production database.
3. Run `supabase/migrations/008_country_assignment_and_pool_consolidation.sql`.
4. Spot-check production signup with one new test account.
5. Tell testers their old accounts were wiped and they need to sign up again.

## Self-Review Checklist

- Spec coverage: migration, country signup, anon draft migration, `/predict/*`, `/leaderboard`, country pages, read-only bracket viewer, navbar/home, cleanup, redirects, and tests are each represented by tasks.
- Placeholder scan: no incomplete markers or unimplemented placeholders should remain in this plan.
- Type consistency: `country` is a string slug on `User`; prediction server actions resolve `poolId` server-side; anon draft key is `wc2026:predictions:anon:draft`.
