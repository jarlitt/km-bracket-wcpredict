# On-Demand ESPN Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the daily-only cron sync with an on-demand stale-while-revalidate pattern so leaderboard scores refresh every ~10 minutes during user visits.

**Architecture:** Extract ESPN sync logic into a shared function guarded by a TTL timestamp in Supabase. Server actions and Server Components call `syncResultsIfStale()` which checks a `sync_metadata` row — if >10 minutes stale, it claims the slot and runs a full ESPN fetch + result upsert + score recalculation. The existing cron route becomes a thin wrapper.

**Tech Stack:** Next.js 16 (Server Actions, Server Components), Supabase (Postgres + service-role client), ESPN public API

**Spec:** `docs/superpowers/specs/2026-05-27-on-demand-espn-sync-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/007_sync_metadata.sql` | Create | Single-row table to track last sync timestamp |
| `src/lib/sync/sync-results.ts` | Create | Extracted sync logic (`syncResults`) + TTL guard (`syncResultsIfStale`) |
| `src/app/api/cron/sync-results/route.ts` | Modify | Thin wrapper calling extracted `syncResults()` |
| `src/app/actions/leaderboard.ts` | Modify | Call `syncResultsIfStale()` inside `getLeaderboard()` |
| `src/app/matches/page.tsx` | Modify | Call `syncResultsIfStale()` before fetching live matches |

---

### Task 1: Create the `sync_metadata` migration

**Files:**
- Create: `supabase/migrations/007_sync_metadata.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Tracks the last time an automated sync ran, enabling stale-while-revalidate.
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with epoch so the first visitor triggers an immediate sync.
INSERT INTO sync_metadata (key, last_synced_at)
VALUES ('espn_sync', '1970-01-01T00:00:00Z')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only the service-role client can access this table.
```

- [ ] **Step 2: Verify the migration file exists and is well-formed**

Run: `cat supabase/migrations/007_sync_metadata.sql`
Expected: The SQL above prints cleanly, no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_sync_metadata.sql
git commit -m "feat: add sync_metadata table for on-demand ESPN sync"
```

---

### Task 2: Extract sync logic into `src/lib/sync/sync-results.ts`

This is the core of the feature. The ESPN fetch, group/knockout upsert, and recalculation logic moves out of the cron route handler into a reusable function. A TTL-guarded wrapper is added on top.

**Files:**
- Create: `src/lib/sync/sync-results.ts`
- Reference (read-only): `src/app/api/cron/sync-results/route.ts` (lines 11-48, 50-61, 72-191 — the logic to extract)
- Reference (read-only): `src/lib/supabase/admin.ts`
- Reference (read-only): `src/lib/scoring/recalculate.ts`

- [ ] **Step 1: Create the sync module**

Create `src/lib/sync/sync-results.ts` with the following content. This extracts the ESPN fetch, event processing, and score recalculation from the cron route into standalone functions:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'
import { GROUP_MATCHES } from '@/lib/data/matches'
import { resolveTeamId } from '@/lib/data/team-mapping'
import { findKnockoutMatchIdByDate } from '@/lib/data/knockout-schedule'
import { recalculateAllScores } from '@/lib/scoring/recalculate'

const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260601-20260720&limit=200'

const DEFAULT_TTL_MS = 600_000 // 10 minutes

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score: string
  winner: boolean
  team: { displayName: string; abbreviation: string }
}

interface EspnEvent {
  id: string
  date: string
  name: string
  season: { slug: string }
  competitions: Array<{
    status: { type: { completed: boolean; state: string } }
    competitors: EspnCompetitor[]
  }>
}

export interface SyncResult {
  ok: true
  source: string
  totalEvents: number
  groupSynced: number
  knockoutSynced: number
  usersScored: number
  skipped?: string[]
  errors?: string[]
}

async function fetchEspnEvents(): Promise<EspnEvent[]> {
  const res = await fetch(ESPN_URL, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`ESPN returned ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { events?: EspnEvent[] }
  return data.events ?? []
}

function findGroupMatchId(homeName: string, awayName: string): number | null {
  const homeId = resolveTeamId(homeName)
  const awayId = resolveTeamId(awayName)
  if (!homeId || !awayId) return null

  const match = GROUP_MATCHES.find(
    (m) =>
      (m.teamAId === homeId && m.teamBId === awayId) ||
      (m.teamAId === awayId && m.teamBId === homeId),
  )
  return match?.id ?? null
}

/**
 * Fetches completed results from ESPN, upserts them into Supabase,
 * and recalculates all user scores if any new results were found.
 */
export async function syncResults(): Promise<SyncResult> {
  const events = await fetchEspnEvents()
  const supabase = createAdminClient()

  let groupSynced = 0
  let knockoutSynced = 0
  const skipped: string[] = []
  const errors: string[] = []

  for (const event of events) {
    const comp = event.competitions[0]
    if (!comp.status.type.completed) continue

    const competitors = comp.competitors
    const home = competitors.find((c) => c.homeAway === 'home')
    const away = competitors.find((c) => c.homeAway === 'away')
    if (!home || !away) {
      skipped.push(`${event.id}: missing home/away`)
      continue
    }

    const homeScore = parseInt(home.score, 10)
    const awayScore = parseInt(away.score, 10)
    if (isNaN(homeScore) || isNaN(awayScore)) {
      skipped.push(`${event.id}: scores not numeric (${home.score}-${away.score})`)
      continue
    }

    const slug = event.season.slug

    if (slug === 'group-stage') {
      const matchId = findGroupMatchId(home.team.displayName, away.team.displayName)
      if (!matchId) {
        errors.push(
          `Could not match group: ${home.team.displayName} vs ${away.team.displayName}`,
        )
        continue
      }

      const groupMatch = GROUP_MATCHES.find((m) => m.id === matchId)!
      const homeIsTeamA = groupMatch.teamAId === resolveTeamId(home.team.displayName)
      const scoreA = homeIsTeamA ? homeScore : awayScore
      const scoreB = homeIsTeamA ? awayScore : homeScore

      const { error } = await supabase.from('actual_group_results').upsert(
        {
          match_id: matchId,
          score_a: scoreA,
          score_b: scoreB,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'match_id' },
      )

      if (error) {
        errors.push(`Group ${matchId}: ${error.message}`)
      } else {
        groupSynced++
      }
    } else {
      const ourMatchId = findKnockoutMatchIdByDate(event.date)
      if (!ourMatchId) {
        errors.push(`No knockout match ID for date ${event.date} (${event.name})`)
        continue
      }

      const winnerCompetitor = competitors.find((c) => c.winner)
      if (!winnerCompetitor) {
        skipped.push(`${ourMatchId}: no winner (draw or unresolved)`)
        continue
      }

      const winnerId = resolveTeamId(winnerCompetitor.team.displayName)
      if (!winnerId) {
        errors.push(
          `${ourMatchId}: could not resolve winner team "${winnerCompetitor.team.displayName}"`,
        )
        continue
      }

      const { error } = await supabase.from('actual_knockout_results').upsert(
        {
          match_id: ourMatchId,
          winner_id: winnerId,
          score_a: homeScore,
          score_b: awayScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'match_id' },
      )

      if (error) {
        errors.push(`Knockout ${ourMatchId}: ${error.message}`)
      } else {
        knockoutSynced++
      }
    }
  }

  let scoringResult: { usersScored: number; message?: string } = { usersScored: 0 }
  if (groupSynced > 0 || knockoutSynced > 0) {
    scoringResult = await recalculateAllScores()
  }

  return {
    ok: true,
    source: 'ESPN',
    totalEvents: events.length,
    groupSynced,
    knockoutSynced,
    usersScored: scoringResult.usersScored,
    skipped: skipped.length > 0 ? skipped : undefined,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Runs syncResults() only if the last sync was more than `ttlMs` ago.
 * Uses a "claim first, sync second" pattern to prevent concurrent syncs.
 * Fails silently (logs error, returns skipped) so page rendering is never blocked.
 */
export async function syncResultsIfStale(
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<{ skipped: boolean; result?: SyncResult }> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('sync_metadata')
      .select('last_synced_at')
      .eq('key', 'espn_sync')
      .single()

    if (error || !data) {
      console.error('sync_metadata read failed:', error?.message)
      return { skipped: true }
    }

    const lastSynced = new Date(data.last_synced_at).getTime()
    const now = Date.now()

    if (now - lastSynced < ttlMs) {
      return { skipped: true }
    }

    // Claim the slot before syncing to prevent concurrent syncs
    await supabase
      .from('sync_metadata')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('key', 'espn_sync')

    const result = await syncResults()
    return { skipped: false, result }
  } catch (err) {
    console.error('syncResultsIfStale error:', err instanceof Error ? err.message : err)
    return { skipped: true }
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/sync/sync-results.ts 2>&1 || echo "Type check done (errors above if any)"`
Expected: No type errors (or only unrelated pre-existing ones).

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync/sync-results.ts
git commit -m "feat: extract ESPN sync logic with stale-while-revalidate guard"
```

---

### Task 3: Refactor cron route to use extracted function

Replace the inline sync logic in the cron route with a call to the extracted `syncResults()`.

**Files:**
- Modify: `src/app/api/cron/sync-results/route.ts`

- [ ] **Step 1: Replace the route handler body**

Replace the entire content of `src/app/api/cron/sync-results/route.ts` with:

```typescript
import { NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron/auth'
import { syncResults } from '@/lib/sync/sync-results'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = authorizeCronRequest({
    cronSecret: process.env.CRON_SECRET,
    authHeader: request.headers.get('authorization'),
  })
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const result = await syncResults()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('sync-results error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/api/cron/sync-results/route.ts 2>&1 || echo "Type check done"`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/sync-results/route.ts
git commit -m "refactor: cron route delegates to extracted syncResults()"
```

---

### Task 4: Add on-demand sync to leaderboard server action

The dashboard page is a client component that calls `getLeaderboard()` as a server action. Adding the sync call inside the server action means every leaderboard fetch triggers a staleness check.

**Files:**
- Modify: `src/app/actions/leaderboard.ts` (lines 1-2 for imports, line 33 to add sync call)

- [ ] **Step 1: Add the sync call to `getLeaderboard()`**

In `src/app/actions/leaderboard.ts`, add the import at the top:

```typescript
import { syncResultsIfStale } from '@/lib/sync/sync-results'
```

Then add the sync call as the first line inside `getLeaderboard()`, after the `if (!poolId)` early return:

The function should look like:

```typescript
export async function getLeaderboard(poolId: string): Promise<LeaderboardEntry[]> {
  if (!poolId) return []

  await syncResultsIfStale()

  const supabase = await createClient()
  // ... rest of the function unchanged
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/actions/leaderboard.ts 2>&1 || echo "Type check done"`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/leaderboard.ts
git commit -m "feat: trigger on-demand ESPN sync when leaderboard is fetched"
```

---

### Task 5: Add on-demand sync to matches page

The matches page is already a Server Component. Add the sync call before fetching live matches.

**Files:**
- Modify: `src/app/matches/page.tsx` (line 1 for import, line 8-9 area for sync call)

- [ ] **Step 1: Add the sync call to the matches page**

In `src/app/matches/page.tsx`, add the import at the top:

```typescript
import { syncResultsIfStale } from '@/lib/sync/sync-results'
```

Then add the sync call before the try/catch block. The full file should become:

```typescript
import { fetchLiveMatches, type LiveMatch } from '@/lib/espn/matches'
import { MatchesList } from '@/components/matches/matches-list'
import { syncResultsIfStale } from '@/lib/sync/sync-results'

export default async function MatchesPage() {
  await syncResultsIfStale()

  let matches: LiveMatch[] = []
  let error: string | null = null

  try {
    matches = await fetchLiveMatches()
  } catch (err) {
    matches = []
    error = err instanceof Error ? err.message : 'Failed to load matches'
  }

  const fetchedAt = new Date().toISOString()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">World Cup 2026</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live scores and fixtures, refreshed every 10 minutes.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : (
        <MatchesList matches={matches} fetchedAt={fetchedAt} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/app/matches/page.tsx 2>&1 || echo "Type check done"`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/matches/page.tsx
git commit -m "feat: trigger on-demand ESPN sync when matches page loads"
```

---

### Task 6: Update spec with implementation notes

**Files:**
- Modify: `docs/superpowers/specs/2026-05-27-on-demand-espn-sync-design.md`

- [ ] **Step 1: Update the spec**

In the spec file, update the section about the dashboard page to reflect that the sync is triggered from the `getLeaderboard` server action (not the page component directly), since the dashboard page turned out to be a client component:

Replace:
```markdown
### Modified: `src/app/pools/[slug]/dashboard/page.tsx`

Add `await syncResultsIfStale()` at the top, before fetching leaderboard data. This is the primary trigger — anyone checking scores keeps them fresh.
```

With:
```markdown
### Modified: `src/app/actions/leaderboard.ts`

Add `await syncResultsIfStale()` inside `getLeaderboard()`. The dashboard page is a client component, so the sync call lives in the server action it invokes. This is the primary trigger — anyone checking scores keeps them fresh.
```

Also update the file changes table to replace `src/app/pools/[slug]/dashboard/page.tsx` with `src/app/actions/leaderboard.ts`.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-27-on-demand-espn-sync-design.md
git commit -m "docs: update spec to reflect server action trigger point"
```

---

### Task 7: Verify the full build

- [ ] **Step 1: Run the TypeScript compiler on the full project**

Run: `npx tsc --noEmit`
Expected: No new errors introduced. Pre-existing errors (if any) are acceptable.

- [ ] **Step 2: Run the dev server to verify no runtime errors**

Run: `npm run dev`
Expected: Dev server starts without errors. Navigate to `/matches` and a pool dashboard page — both should load without issues. (The sync won't actually run without the migration applied, but the code should not crash — the staleness check will fail gracefully and log an error.)

- [ ] **Step 3: Final commit (if any lint/type fixes were needed)**

```bash
git add -A
git commit -m "fix: address any build issues from on-demand sync integration"
```
