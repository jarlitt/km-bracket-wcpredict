# On-Demand ESPN Sync (Stale-While-Revalidate)

**Date:** 2026-05-27
**Status:** Approved
**Approach:** On-demand sync with TTL-based staleness check

## Problem

The app currently syncs ESPN results via a daily Vercel cron job (`/api/cron/sync-results`). Vercel's free plan only allows one cron execution per day, so leaderboard scores can be stale for hours during live match days. The live scores display on `/matches` refreshes every 10 minutes, but the scoring database (which drives leaderboards) only updates once daily.

## Goal

Make scoring updates happen every ~10 minutes without relying on Vercel cron or any external scheduler. Zero additional cost.

## Solution

A stale-while-revalidate pattern: when a user loads a page that depends on fresh scores, the server checks how long ago the last ESPN sync ran. If it's been more than 10 minutes, it runs the sync before rendering. Otherwise, it returns immediately.

## Architecture

### New: `sync_metadata` table

A single-row Supabase table that tracks when the last sync happened.

```sql
CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sync_metadata (key, last_synced_at)
VALUES ('espn_sync', '1970-01-01T00:00:00Z');

ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS policies; only service role can access.
```

The seed value is epoch so the very first visitor after deployment triggers a sync.

### New: `src/lib/sync/sync-results.ts`

Extracted sync logic with a staleness guard.

**Exports:**

- `syncResults()` — the core sync function (ESPN fetch → group/knockout upsert → recalculate scores). Extracted from the current cron route handler, without HTTP request/response concerns. Returns a result summary object.
- `syncResultsIfStale(ttlMs?: number)` — reads `sync_metadata.last_synced_at`, compares against `ttlMs` (default 600_000 = 10 minutes). If stale, updates `last_synced_at` to now (claims the slot to prevent concurrent syncs), then calls `syncResults()`. If fresh, returns `{ skipped: true }` immediately.

**Concurrency handling:**
The "claim first, sync second" pattern prevents duplicate syncs. If two users hit the leaderboard within the same second:
1. User A reads `last_synced_at` → stale → updates to now → starts sync
2. User B reads `last_synced_at` → fresh (User A just updated) → skips → renders with existing data

This is not a true distributed lock, but it's sufficient for a small office pool. The worst case is two syncs running simultaneously during a very narrow race window, which is harmless (upserts are idempotent).

### Modified: `/api/cron/sync-results/route.ts`

Becomes a thin wrapper:
1. Keeps the `authorizeCronRequest()` check
2. Calls `syncResults()` directly (bypasses the staleness check — cron/admin triggers should always run)
3. Returns the same JSON response shape

### Modified: `src/app/actions/leaderboard.ts`

Add `await syncResultsIfStale()` inside `getLeaderboard()`. The dashboard page is a client component, so the sync call lives in the server action it invokes. This is the primary trigger — anyone checking scores keeps them fresh.

### Modified: `src/app/matches/page.tsx`

Add `await syncResultsIfStale()` at the top. Anyone watching live scores also triggers scoring updates as a side effect.

### Unchanged: `vercel.json`

Keep the daily cron as a safety net. If nobody visits the site for a full day, at least the midnight sync catches up. It costs nothing and doesn't conflict with on-demand sync.

### Unchanged: Admin actions

`triggerApiSync()` and `triggerRecalculate()` continue to work as-is. The admin route calls the cron endpoint which calls `syncResults()` directly.

## File Changes Summary

| File | Change | Description |
|------|--------|-------------|
| `src/lib/sync/sync-results.ts` | New | Extracted sync logic + `syncResultsIfStale()` |
| `supabase/migrations/007_sync_metadata.sql` | New | `sync_metadata` table + seed row |
| `src/app/api/cron/sync-results/route.ts` | Edit | Thin wrapper calling extracted `syncResults()` |
| `src/app/actions/leaderboard.ts` | Edit | Add `await syncResultsIfStale()` inside `getLeaderboard()` |
| `src/app/matches/page.tsx` | Edit | Add `await syncResultsIfStale()` |
| `vercel.json` | None | Keep daily cron as safety net |

## Performance Characteristics

- **Staleness check cost:** ~50ms (single Supabase row read)
- **Full sync cost:** ~2-3 seconds (ESPN fetch + upserts + score recalculation)
- **Who pays the sync cost:** The first visitor after a 10+ minute gap sees a slightly slower page load. All subsequent visitors within the window get instant renders.
- **No client-side changes:** Everything is server-side, before HTML ships. No spinners, no loading states.

## TTL Configuration

The 10-minute TTL is hardcoded as the default parameter but can be overridden per call site:

```typescript
await syncResultsIfStale()           // 10 min default
await syncResultsIfStale(300_000)    // 5 min override
```

## Edge Cases

- **No matches today:** Sync runs but finds no completed events → no DB writes → no score recalculation. Cost is just the ESPN fetch (~500ms).
- **ESPN is down:** `syncResults()` throws → `syncResultsIfStale()` catches and logs the error → page renders with existing (stale) data. The `last_synced_at` was already updated, so the next visitor won't immediately retry (avoids hammering a down API). The daily cron provides a second chance.
- **Tournament hasn't started yet:** ESPN returns no completed events → sync is a no-op. Negligible cost.
- **Tournament is over:** Same — no new completed events, sync is a no-op. Could optionally add a hard cutoff date to skip the check entirely after July 20, 2026.

## Non-Goals

- Real-time push updates (WebSockets, SSE) — overkill for an office pool
- Client-side polling for sync status — unnecessary complexity
- Distributed locking — the race window is narrow and upserts are idempotent
