# Always-Editable Predictions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the explicit "Edit predictions" mode with an always-editable
prediction experience. Drop the four-pill step navigation, replace it with a
permanent dual progress bar + Submit button, and surface a dirty banner +
Discard CTA whenever the user has unsubmitted changes vs. their last
submission.

**Architecture:** Introduce a `submittedSnapshot` cache (in-memory and
localStorage) on `PredictionsContext`. A pure helper compares the current
state against the snapshot to derive `isDirty`. The predict layout swaps the
step pills for a new `PredictProgressBar` component; a unified Submit button
replaces both the pre-submit Submit and post-submit Edit flows. The existing
navigation guard is reused (renamed) with `isDirty` as its trigger.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Vitest,
Tailwind, shadcn primitives, Supabase.

**Reference spec:** `docs/superpowers/specs/2026-05-28-always-editable-predictions-design.md`

---

## File Structure

**Created:**

- `src/lib/predictions/dirty.ts` — `computeIsDirty(state, snapshot)` pure helper.
- `src/lib/predictions/dirty.test.ts` — unit tests.
- `src/components/prediction/predict-progress-bar.tsx` — sticky dual-segment progress bar.

**Modified:**

- `src/lib/predictions/storage.ts` — add snapshot read/write/clear + key helper.
- `src/lib/predictions/storage.test.ts` — snapshot round-trip + edge cases.
- `src/lib/navigation/edit-mode-guard.ts` — rename function & parameter.
- `src/lib/navigation/edit-mode-guard.test.ts` — update for renamed symbols.
- `src/context/predictions-context.tsx` — add `submittedSnapshot`, `isDirty`, `discardUnsavedChanges`; remove `editingSubmission`, `startEditingSubmission`, `cancelEditingSubmission`.
- `src/app/predict/layout.tsx` — strip-and-rebuild of the sticky stepper; new dirty banner; navigation-effect trigger swap.
- `src/app/predict/groups/page.tsx` — drop `readOnlySubmitted`; remove inline `<Progress />`.
- `src/app/predict/thirds/page.tsx` — drop `readOnlySubmitted`.
- `src/app/predict/bracket/page.tsx` — drop `readOnlySubmitted`; remove inline Submit buttons; adjust subhead copy.

---

## Task 1: `computeIsDirty` Pure Helper

**Files:**

- Create: `src/lib/predictions/dirty.ts`
- Create: `src/lib/predictions/dirty.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/predictions/dirty.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeIsDirty } from './dirty'
import { defaultPredictionsState, type PredictionsState } from './storage'

function snap(overrides: Partial<PredictionsState> = {}): PredictionsState {
  return {
    ...defaultPredictionsState,
    submitted: true,
    ...overrides,
  }
}

describe('computeIsDirty', () => {
  it('returns false when the snapshot is null', () => {
    expect(computeIsDirty(snap({ groupPredictions: { 1: { scoreA: 1, scoreB: 0 } } }), null)).toBe(false)
  })

  it('returns false when state has not been submitted yet', () => {
    const baseline = snap({ groupPredictions: { 1: { scoreA: 1, scoreB: 0 } } })
    const live: PredictionsState = { ...baseline, submitted: false }
    expect(computeIsDirty(live, baseline)).toBe(false)
  })

  it('returns false when state and snapshot match exactly', () => {
    const baseline = snap({ groupPredictions: { 1: { scoreA: 1, scoreB: 0 } } })
    expect(computeIsDirty(baseline, baseline)).toBe(false)
  })

  it('returns true when a group score differs', () => {
    const baseline = snap({ groupPredictions: { 1: { scoreA: 1, scoreB: 0 } } })
    const live = snap({ groupPredictions: { 1: { scoreA: 2, scoreB: 0 } } })
    expect(computeIsDirty(live, baseline)).toBe(true)
  })

  it('returns true when a knockout pick differs', () => {
    const baseline = snap({ knockoutPredictions: { 'R32-1': 7 } })
    const live = snap({ knockoutPredictions: { 'R32-1': 8 } })
    expect(computeIsDirty(live, baseline)).toBe(true)
  })

  it('returns true when a tie-break resolution differs', () => {
    const baseline = snap({ tieBreakResolutions: { 'group:A:1,2': [1, 2] } })
    const live = snap({ tieBreakResolutions: { 'group:A:1,2': [2, 1] } })
    expect(computeIsDirty(live, baseline)).toBe(true)
  })

  it('returns true when a knockout matchup differs', () => {
    const baseline = snap({ knockoutMatchups: { 'R32-1': { teamAId: 1, teamBId: 2 } } })
    const live = snap({ knockoutMatchups: { 'R32-1': { teamAId: 1, teamBId: 3 } } })
    expect(computeIsDirty(live, baseline)).toBe(true)
  })

  it('treats { scoreA: undefined, scoreB: undefined } as equivalent to a missing entry', () => {
    const baseline = snap({ groupPredictions: {} })
    const live = snap({
      groupPredictions: { 1: { scoreA: undefined, scoreB: undefined } },
    })
    expect(computeIsDirty(live, baseline)).toBe(false)
  })

  it('ignores key insertion order in comparison', () => {
    const baseline = snap({
      groupPredictions: { 1: { scoreA: 1, scoreB: 0 }, 2: { scoreA: 2, scoreB: 1 } },
    })
    const live = snap({
      groupPredictions: { 2: { scoreA: 2, scoreB: 1 }, 1: { scoreA: 1, scoreB: 0 } },
    })
    expect(computeIsDirty(live, baseline)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- src/lib/predictions/dirty.test.ts
```

Expected: FAIL — `dirty` module does not exist yet.

- [ ] **Step 3: Implement the helper**

Create `src/lib/predictions/dirty.ts`:

```ts
import type { PredictionsState } from './storage'

/**
 * Returns `true` when `state` differs from `snapshot` in any field that
 * matters for a submission (group scores, knockout picks, knockout matchups,
 * tie-break resolutions). Returns `false` when:
 *
 * - The user has not yet submitted (no baseline exists).
 * - The snapshot is null.
 * - The two states are structurally equal.
 *
 * Comparison is done after canonicalising both inputs so that:
 * - Missing group-prediction entries and entries that are `undefined`/`undefined`
 *   are treated as equivalent (the UI clears entries by writing
 *   `{ scoreA: undefined, scoreB: undefined }` mid-edit).
 * - Object key insertion order is irrelevant.
 */
export function computeIsDirty(
  state: PredictionsState,
  snapshot: PredictionsState | null,
): boolean {
  if (snapshot === null) return false
  if (!state.submitted) return false

  return (
    !groupPredictionsEqual(state.groupPredictions, snapshot.groupPredictions) ||
    !shallowRecordEqual(state.knockoutPredictions, snapshot.knockoutPredictions) ||
    !knockoutMatchupsEqual(state.knockoutMatchups, snapshot.knockoutMatchups) ||
    !tieBreakResolutionsEqual(state.tieBreakResolutions, snapshot.tieBreakResolutions)
  )
}

function groupPredictionsEqual(
  a: PredictionsState['groupPredictions'],
  b: PredictionsState['groupPredictions'],
): boolean {
  const keys = new Set([...keysOf(a), ...keysOf(b)])
  for (const key of keys) {
    const av = a[Number(key)]
    const bv = b[Number(key)]
    const aEmpty = !av || (av.scoreA === undefined && av.scoreB === undefined)
    const bEmpty = !bv || (bv.scoreA === undefined && bv.scoreB === undefined)
    if (aEmpty && bEmpty) continue
    if (aEmpty !== bEmpty) return false
    if (av!.scoreA !== bv!.scoreA || av!.scoreB !== bv!.scoreB) return false
  }
  return true
}

function shallowRecordEqual<V>(a: Record<string, V>, b: Record<string, V>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

function knockoutMatchupsEqual(
  a: PredictionsState['knockoutMatchups'],
  b: PredictionsState['knockoutMatchups'],
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const av = a[key]
    const bv = b[key]
    if (!av && !bv) continue
    if (!av || !bv) return false
    if (av.teamAId !== bv.teamAId || av.teamBId !== bv.teamBId) return false
  }
  return true
}

function tieBreakResolutionsEqual(
  a: PredictionsState['tieBreakResolutions'],
  b: PredictionsState['tieBreakResolutions'],
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const av = a[key] ?? []
    const bv = b[key] ?? []
    if (av.length !== bv.length) return false
    for (let i = 0; i < av.length; i++) {
      if (av[i] !== bv[i]) return false
    }
  }
  return true
}

function keysOf(obj: Record<string | number, unknown>): string[] {
  return Object.keys(obj)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- src/lib/predictions/dirty.test.ts
```

Expected: PASS, all 9 cases green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/predictions/dirty.ts src/lib/predictions/dirty.test.ts
git commit -m "feat(predictions): add computeIsDirty pure helper"
```

---

## Task 2: Snapshot Storage Helpers

**Files:**

- Modify: `src/lib/predictions/storage.ts`
- Modify: `src/lib/predictions/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/predictions/storage.test.ts` (after the existing
`describe('anon draft helpers', ...)` block):

```ts
import {
  clearSubmittedSnapshot,
  predictionsSnapshotStorageKey,
  readSubmittedSnapshot,
  writeSubmittedSnapshot,
} from './storage'

describe('predictionsSnapshotStorageKey', () => {
  it('appends :snapshot to the scoped key', () => {
    expect(predictionsSnapshotStorageKey(USER, POOL)).toBe(
      `wc2026-predictions:${USER}:${POOL}:snapshot`,
    )
  })
})

describe('submitted-snapshot helpers', () => {
  it('round-trips a snapshot for a user/pool', () => {
    const storage = new MemoryStorage()
    writeSubmittedSnapshot(storage, USER, POOL, sampleState())

    const result = readSubmittedSnapshot(storage, USER, POOL)
    expect(result).toEqual(sampleState())
  })

  it('returns null when no snapshot is stored', () => {
    expect(readSubmittedSnapshot(new MemoryStorage(), USER, POOL)).toBeNull()
  })

  it('returns null when the stored snapshot is corrupt JSON', () => {
    const storage = new MemoryStorage()
    storage.setItem(predictionsSnapshotStorageKey(USER, POOL), '{not-json')
    expect(readSubmittedSnapshot(storage, USER, POOL)).toBeNull()
  })

  it('clears the snapshot', () => {
    const storage = new MemoryStorage()
    writeSubmittedSnapshot(storage, USER, POOL, sampleState())
    clearSubmittedSnapshot(storage, USER, POOL)

    expect(storage.has(predictionsSnapshotStorageKey(USER, POOL))).toBe(false)
  })

  it('preserves submitted=true through a round-trip (unlike drafts)', () => {
    const storage = new MemoryStorage()
    writeSubmittedSnapshot(storage, USER, POOL, sampleState())

    const result = readSubmittedSnapshot(storage, USER, POOL)
    expect(result?.submitted).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- src/lib/predictions/storage.test.ts
```

Expected: FAIL — `predictionsSnapshotStorageKey`, `readSubmittedSnapshot`,
`writeSubmittedSnapshot`, `clearSubmittedSnapshot` are not exported.

- [ ] **Step 3: Add the snapshot helpers**

In `src/lib/predictions/storage.ts`, add the following after the existing
`writePredictionsToStorage` function:

```ts
export function predictionsSnapshotStorageKey(
  userId: string,
  poolId: string,
): string {
  return `${STORAGE_PREFIX}:${userId}:${poolId}:snapshot`
}

/**
 * Read the last-submitted snapshot for a (user, pool). Unlike the draft, the
 * snapshot represents a previously-confirmed submission, so `submitted=true`
 * is preserved on read.
 *
 * Returns `null` when no snapshot is stored or when the stored payload is
 * corrupt. Anonymous users never have a snapshot (they cannot submit).
 */
export function readSubmittedSnapshot(
  storage: StorageLike,
  userId: string,
  poolId: string,
): PredictionsState | null {
  const raw = safeGet(storage, predictionsSnapshotStorageKey(userId, poolId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PredictionsState>
    return {
      groupPredictions: parsed.groupPredictions ?? {},
      knockoutPredictions: parsed.knockoutPredictions ?? {},
      knockoutMatchups: parsed.knockoutMatchups ?? {},
      tieBreakResolutions: parsed.tieBreakResolutions ?? {},
      submitted: true,
    }
  } catch {
    return null
  }
}

export function writeSubmittedSnapshot(
  storage: StorageLike,
  userId: string,
  poolId: string,
  state: PredictionsState,
): void {
  safeSet(
    storage,
    predictionsSnapshotStorageKey(userId, poolId),
    JSON.stringify(state),
  )
}

export function clearSubmittedSnapshot(
  storage: StorageLike,
  userId: string,
  poolId: string,
): void {
  safeRemove(storage, predictionsSnapshotStorageKey(userId, poolId))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- src/lib/predictions/storage.test.ts
```

Expected: PASS — existing tests remain green; the five new cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/predictions/storage.ts src/lib/predictions/storage.test.ts
git commit -m "feat(predictions): add submitted-snapshot localStorage helpers"
```

---

## Task 3: Rename Navigation Guard for Unsaved-Changes Semantics

**Files:**

- Modify: `src/lib/navigation/edit-mode-guard.ts`
- Modify: `src/lib/navigation/edit-mode-guard.test.ts`
- Modify: `src/app/predict/layout.tsx` (just the import line and three call sites — full layout rewrite happens later)

The function body is unchanged — same predicate. Only the name and parameter
name change.

- [ ] **Step 1: Update the test file (rename symbols, no behavior change)**

Replace the entire body of `src/lib/navigation/edit-mode-guard.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { shouldPromptForUnsavedChangesNavigation } from './edit-mode-guard'

describe('shouldPromptForUnsavedChangesNavigation', () => {
  it('allows moving between prediction steps', () => {
    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: true,
        currentPathname: '/predict/groups',
        destinationHref: '/predict/bracket',
      }),
    ).toBe(false)
  })

  it('prompts when leaving the predict flow with unsaved changes', () => {
    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: true,
        currentPathname: '/predict/groups',
        destinationHref: '/pools/spain/dashboard',
      }),
    ).toBe(true)

    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: true,
        currentPathname: '/predict/groups',
        destinationHref: '/matches',
      }),
    ).toBe(true)
  })

  it('prompts for absolute same-origin links outside the predict flow', () => {
    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: true,
        currentPathname: '/predict/groups',
        destinationHref: 'http://localhost:3000/pools/spain/dashboard',
      }),
    ).toBe(true)
  })

  it('does not prompt when there are no unsaved changes', () => {
    expect(
      shouldPromptForUnsavedChangesNavigation({
        hasUnsavedChanges: false,
        currentPathname: '/predict/groups',
        destinationHref: '/matches',
      }),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- src/lib/navigation/edit-mode-guard.test.ts
```

Expected: FAIL — `shouldPromptForUnsavedChangesNavigation` is not exported.

- [ ] **Step 3: Rename function & parameter in the implementation**

Replace the body of `src/lib/navigation/edit-mode-guard.ts` with:

```ts
interface UnsavedChangesNavigationGuardInput {
  hasUnsavedChanges: boolean
  currentPathname: string
  destinationHref: string
}

const PREDICT_PATH_PATTERN = /^\/predict(?:\/|$)/

function pathnameFromHref(href: string): string | null {
  try {
    return new URL(href, 'https://local.app').pathname
  } catch {
    return null
  }
}

export function shouldPromptForUnsavedChangesNavigation({
  hasUnsavedChanges,
  currentPathname,
  destinationHref,
}: UnsavedChangesNavigationGuardInput): boolean {
  if (!hasUnsavedChanges) return false

  if (!PREDICT_PATH_PATTERN.test(currentPathname)) return false

  const destinationPathname = pathnameFromHref(destinationHref)
  if (!destinationPathname) return true

  return (
    destinationPathname !== '/predict' &&
    !destinationPathname.startsWith('/predict/')
  )
}
```

- [ ] **Step 4: Update `src/app/predict/layout.tsx` import & call sites**

In `src/app/predict/layout.tsx`:

- Change the import line from
  `import { shouldPromptForEditNavigation } from '@/lib/navigation/edit-mode-guard'`
  to
  `import { shouldPromptForUnsavedChangesNavigation } from '@/lib/navigation/edit-mode-guard'`.
- In both call sites (the click-intercept effect and the popstate effect),
  rename the function call and rename the `editingSubmission:` argument to
  `hasUnsavedChanges:`. The value being passed (`editingSubmission`) is
  unchanged — that pivot to `isDirty` happens in Task 6.

Search the file for `shouldPromptForEditNavigation` and replace each
invocation. Example before/after for the click-intercept effect:

```diff
-          !shouldPromptForEditNavigation({
-            editingSubmission,
+          !shouldPromptForUnsavedChangesNavigation({
+            hasUnsavedChanges: editingSubmission,
             currentPathname: pathname,
             destinationHref: href,
           })
```

- [ ] **Step 5: Verify tests pass + project compiles**

```bash
npm test -- src/lib/navigation/edit-mode-guard.test.ts
npx tsc --noEmit
```

Expected: tests PASS; `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/navigation/edit-mode-guard.ts src/lib/navigation/edit-mode-guard.test.ts src/app/predict/layout.tsx
git commit -m "refactor(navigation): rename edit-mode guard to unsaved-changes guard"
```

---

## Task 4: Extend `PredictionsContext` With Snapshot + `isDirty` + Discard

**Files:**

- Modify: `src/context/predictions-context.tsx`

This task is **additive** — keeps `editingSubmission`, `startEditingSubmission`,
and `cancelEditingSubmission` in place so the layout/pages still compile.
Task 10 removes them after all consumers have migrated.

- [ ] **Step 1: Import the new helpers**

At the top of `src/context/predictions-context.tsx`, add to the imports
from `@/lib/predictions/storage`:

```ts
import {
  defaultPredictionsState,
  readAnonDraft,
  readPredictionsFromStorage,
  readSubmittedSnapshot,
  writeAnonDraft,
  writePredictionsToStorage,
  writeSubmittedSnapshot,
  clearSubmittedSnapshot,
  type PredictionsState,
} from '@/lib/predictions/storage'
```

And add:

```ts
import { computeIsDirty } from '@/lib/predictions/dirty'
```

- [ ] **Step 2: Extend the context interface**

Update the `PredictionsContextType` interface (around line 39) to add the
three new fields. **Leave the existing `editingSubmission`,
`startEditingSubmission`, and `cancelEditingSubmission` fields in place for
now** — they'll be removed in Task 10.

```ts
interface PredictionsContextType extends PredictionsState {
  setGroupPrediction: (matchId: number, scoreA: number | undefined, scoreB: number | undefined) => void
  setKnockoutPrediction: (matchId: string, winnerId: number) => void
  setTieBreakResolution: (key: string, teamOrder: number[]) => void
  submitPredictions: (knockoutMatchups?: Record<string, KnockoutMatchup>) => Promise<string | null>
  startEditingSubmission: () => void
  cancelEditingSubmission: () => Promise<string | null>
  discardUnsavedChanges: () => void
  resetPredictions: () => void
  autofillDemo: () => void
  autofillAllOneZero: () => void
  autofillGroupDemo: (groupId: string) => void
  autofillMatchDemo: (matchId: number) => void
  autofillKnockoutDemo: () => void
  completedGroups: string[]
  totalGroupPredictions: number
  totalKnockoutPredictions: number
  submitting: boolean
  dbLoaded: boolean
  predictionsLocked: boolean
  editingSubmission: boolean
  isDirty: boolean
  submittedSnapshot: PredictionsState | null
}
```

- [ ] **Step 3: Add helper functions for snapshot localStorage I/O**

Inside the same file, just below the existing `saveToStorage` function (~line 82),
add:

```ts
function loadSnapshotFromStorage(
  userId: string | null,
  poolId: string | null,
): PredictionsState | null {
  if (typeof window === 'undefined') return null
  if (!userId || !poolId) return null
  return readSubmittedSnapshot(window.localStorage, userId, poolId)
}

function saveSnapshotToStorage(
  userId: string | null,
  poolId: string | null,
  snapshot: PredictionsState,
) {
  if (typeof window === 'undefined') return
  if (!userId || !poolId) return
  writeSubmittedSnapshot(window.localStorage, userId, poolId, snapshot)
}

function clearSnapshotInStorage(
  userId: string | null,
  poolId: string | null,
) {
  if (typeof window === 'undefined') return
  if (!userId || !poolId) return
  clearSubmittedSnapshot(window.localStorage, userId, poolId)
}
```

- [ ] **Step 4: Wire the snapshot state**

Inside `ScopedPredictionsProvider`, just below the existing `useState` calls
(after `editingSubmission`), add:

```ts
const [submittedSnapshot, setSubmittedSnapshot] = useState<PredictionsState | null>(() =>
  loadSnapshotFromStorage(userId, poolId),
)
```

- [ ] **Step 5: Update the DB hydration effect to set the snapshot**

Locate the `useEffect` that calls `loadPredictions()` (around line 140) and
replace the body so the snapshot is set/cleared in lockstep:

```ts
useEffect(() => {
  if (!userId || !poolId) {
    return
  }
  let cancelled = false
  loadPredictions().then((dbData) => {
    if (cancelled) return
    if (!dbData) {
      setDbLoaded(true)
      return
    }
    if (dbData.submitted) {
      const dbSnapshot: PredictionsState = {
        groupPredictions: dbData.groupPredictions,
        knockoutPredictions: dbData.knockoutPredictions,
        knockoutMatchups: dbData.knockoutMatchups,
        tieBreakResolutions: dbData.tieBreakResolutions,
        submitted: true,
      }
      setSubmittedSnapshot(dbSnapshot)
      saveSnapshotToStorage(userId, poolId, dbSnapshot)
    } else {
      setSubmittedSnapshot(null)
      clearSnapshotInStorage(userId, poolId)
    }
    setState((prev) => ({
      groupPredictions:
        Object.keys(dbData.groupPredictions).length > 0
          ? dbData.groupPredictions
          : prev.groupPredictions,
      knockoutPredictions:
        Object.keys(dbData.knockoutPredictions).length > 0
          ? dbData.knockoutPredictions
          : prev.knockoutPredictions,
      knockoutMatchups:
        Object.keys(dbData.knockoutMatchups).length > 0
          ? dbData.knockoutMatchups
          : prev.knockoutMatchups,
      tieBreakResolutions: dbData.tieBreakResolutions,
      submitted: dbData.submitted,
    }))
    setDbLoaded(true)
  })
  return () => {
    cancelled = true
  }
}, [userId, poolId])
```

- [ ] **Step 6: Update `submitPredictions` to capture the snapshot on success**

Locate the existing `submitPredictions` (around line 298) and replace its
success branch so the snapshot is captured atomically with the state update:

```ts
const submitPredictions = useCallback(async (
  knockoutMatchups?: Record<string, KnockoutMatchup>,
): Promise<string | null> => {
  if (!poolId) return 'No active pool'
  setSubmitting(true)
  try {
    const submittedMatchups = knockoutMatchups ?? buildCurrentKnockoutMatchups()
    const result = await submitPredictionsToDb(
      state.groupPredictions,
      state.knockoutPredictions,
      submittedMatchups,
    )
    if (!result.success) {
      return result.error ?? 'Failed to submit predictions'
    }
    const nextState: PredictionsState = {
      ...state,
      knockoutMatchups: submittedMatchups,
      submitted: true,
    }
    const snapshot: PredictionsState = {
      groupPredictions: { ...nextState.groupPredictions },
      knockoutPredictions: { ...nextState.knockoutPredictions },
      knockoutMatchups: { ...nextState.knockoutMatchups },
      tieBreakResolutions: { ...nextState.tieBreakResolutions },
      submitted: true,
    }
    setState(nextState)
    setSubmittedSnapshot(snapshot)
    saveSnapshotToStorage(userId, poolId, snapshot)
    setEditingSubmission(false)
    return null
  } finally {
    setSubmitting(false)
  }
}, [
  poolId,
  state,
  userId,
  buildCurrentKnockoutMatchups,
])
```

- [ ] **Step 7: Add `discardUnsavedChanges`**

Just below the existing `cancelEditingSubmission` (around line 330), add:

```ts
const discardUnsavedChanges = useCallback(() => {
  if (!submittedSnapshot) return
  setState({
    groupPredictions: { ...submittedSnapshot.groupPredictions },
    knockoutPredictions: { ...submittedSnapshot.knockoutPredictions },
    knockoutMatchups: { ...submittedSnapshot.knockoutMatchups },
    tieBreakResolutions: { ...submittedSnapshot.tieBreakResolutions },
    submitted: true,
  })
}, [submittedSnapshot])
```

- [ ] **Step 8: Remove the localStorage-suppression effect (keep the rest of the effect)**

Locate the effect that persists drafts to localStorage (around line 177):

```ts
useEffect(() => {
  if (editingSubmission && state.submitted) return
  saveToStorage(userId, poolId, state)
}, [state, userId, poolId, editingSubmission])
```

Replace with the unconditional version (drafts always persist now that
there is no explicit edit mode and a snapshot exists for the baseline):

```ts
useEffect(() => {
  saveToStorage(userId, poolId, state)
}, [state, userId, poolId])
```

- [ ] **Step 9: Compute `isDirty` and expose the new values**

Just before the `predictionsLocked` calculation (around line 554), add:

```ts
const isDirty = computeIsDirty(state, submittedSnapshot)
```

In the `<PredictionsContext value={...}>` props block at the bottom of the
provider, add the three new fields:

```ts
return (
  <PredictionsContext value={{
    ...state,
    setGroupPrediction,
    setKnockoutPrediction,
    setTieBreakResolution,
    submitPredictions,
    startEditingSubmission,
    cancelEditingSubmission,
    discardUnsavedChanges,
    resetPredictions,
    autofillDemo,
    autofillAllOneZero,
    autofillGroupDemo,
    autofillMatchDemo,
    autofillKnockoutDemo,
    completedGroups,
    totalGroupPredictions,
    totalKnockoutPredictions,
    submitting,
    dbLoaded,
    predictionsLocked,
    editingSubmission,
    isDirty,
    submittedSnapshot,
  }}>
    {children}
  </PredictionsContext>
)
```

- [ ] **Step 10: Verify the project still compiles + tests pass**

```bash
npx tsc --noEmit
npm test
```

Expected: TypeScript reports no errors; all existing tests still pass.

- [ ] **Step 11: Commit**

```bash
git add src/context/predictions-context.tsx
git commit -m "feat(predictions): add submittedSnapshot, isDirty, discardUnsavedChanges to context"
```

---

## Task 5: `PredictProgressBar` Component

**Files:**

- Create: `src/components/prediction/predict-progress-bar.tsx`

This is a pure presentational component. No behavior to TDD beyond visual
verification, so we ship it without a dedicated test file.

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32
const GROUP_RATIO = TOTAL_GROUP_MATCHES / (TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES)
const KO_RATIO = TOTAL_KNOCKOUT_MATCHES / (TOTAL_GROUP_MATCHES + TOTAL_KNOCKOUT_MATCHES)

interface PredictProgressBarProps {
  groupCount: number
  knockoutCount: number
  className?: string
}

/**
 * Dual-segment progress bar that always shows where the user is across the
 * whole prediction flow. Widths are proportional to the segment totals
 * (72 vs. 32 picks), so a "full" left bar visually maps to "all groups done".
 *
 * Labels sit below each segment so the user can verify exact counts.
 */
export function PredictProgressBar({
  groupCount,
  knockoutCount,
  className,
}: PredictProgressBarProps) {
  const groupValue = Math.min(100, Math.round((groupCount / TOTAL_GROUP_MATCHES) * 100))
  const koValue = Math.min(100, Math.round((knockoutCount / TOTAL_KNOCKOUT_MATCHES) * 100))

  return (
    <div className={cn('flex w-full items-stretch gap-2', className)}>
      <div
        className="flex flex-col gap-1"
        style={{ flexBasis: `${GROUP_RATIO * 100}%` }}
      >
        <Progress
          value={groupValue}
          className="h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500"
        />
        <span className="text-center text-[10px] font-medium text-muted-foreground">
          {groupCount}/{TOTAL_GROUP_MATCHES}
        </span>
      </div>
      <div
        className="flex flex-col gap-1"
        style={{ flexBasis: `${KO_RATIO * 100}%` }}
      >
        <Progress
          value={koValue}
          className="h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500"
        />
        <span className="text-center text-[10px] font-medium text-muted-foreground">
          {knockoutCount}/{TOTAL_KNOCKOUT_MATCHES}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/prediction/predict-progress-bar.tsx
git commit -m "feat(prediction): add PredictProgressBar component"
```

---

## Task 6: Rewrite `predict/layout.tsx` for the New Model

**Files:**

- Modify: `src/app/predict/layout.tsx`

This is the largest UI change. The current `predict-stepper` element (four
pills + per-page progress bar + amber edit banner) is replaced by:

1. A sticky strip with `PredictProgressBar` + a single Submit button (on
   both mobile and desktop).
2. A non-sticky amber dirty banner (rendered just above the page content,
   not inside the sticky strip).

Existing concerns (auth-modal flow, pending-submit cookie, navigation guard,
discard dialog) are kept; their triggers swap from `editingSubmission` /
`!submitted` to `isDirty` / `!submitted`.

- [ ] **Step 1: Replace the layout body**

Replace the entire body of `src/app/predict/layout.tsx` with:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AuthModal } from '@/components/auth/auth-modal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/context/auth-context'
import { usePredictions } from '@/context/predictions-context'
import { PredictProgressBar } from '@/components/prediction/predict-progress-bar'
import { shouldPromptForUnsavedChangesNavigation } from '@/lib/navigation/edit-mode-guard'
import { predictSummaryHref } from '@/lib/navigation/predict-routes'
import {
  clearPendingSubmit,
  readPendingSubmit,
  writePendingSubmit,
} from '@/lib/predictions/pending-submit'

const TOTAL_GROUP_MATCHES = 72
const TOTAL_KNOCKOUT_MATCHES = 32

export default function PredictLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const {
    totalGroupPredictions,
    totalKnockoutPredictions,
    submitted,
    predictionsLocked,
    isDirty,
    submitPredictions,
    discardUnsavedChanges,
    dbLoaded,
  } = usePredictions()
  const [submitting, setSubmitting] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingSubmitAfterAuth, setPendingSubmitAfterAuth] = useState(() =>
    readPendingSubmit(),
  )
  const [pendingNavigationHref, setPendingNavigationHref] = useState<
    string | null
  >(null)
  const [discardingNavigation, setDiscardingNavigation] = useState(false)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const attemptedAuthSubmitRef = useRef(false)
  const currentHrefRef = useRef<string | null>(null)

  const allComplete =
    totalGroupPredictions >= TOTAL_GROUP_MATCHES &&
    totalKnockoutPredictions >= TOTAL_KNOCKOUT_MATCHES
  const summaryHref = predictSummaryHref()
  const hasSomethingToSubmit = isDirty || !submitted
  const submitButtonDisabled = submitting || !allComplete || !hasSomethingToSubmit
  const submitButtonLabel = submitted
    ? submitting ? 'Updating...' : 'Update submission'
    : submitting ? 'Submitting...' : 'Submit predictions'

  const handleSubmit = useCallback(async () => {
    if (!hasSomethingToSubmit) return
    if (totalGroupPredictions < TOTAL_GROUP_MATCHES) {
      toast.error(
        `Complete all group predictions first (${totalGroupPredictions}/${TOTAL_GROUP_MATCHES})`,
      )
      return
    }
    if (totalKnockoutPredictions < TOTAL_KNOCKOUT_MATCHES) {
      toast.error(
        `Pick all knockout winners (${totalKnockoutPredictions}/${TOTAL_KNOCKOUT_MATCHES})`,
      )
      return
    }
    if (!user) {
      attemptedAuthSubmitRef.current = false
      writePendingSubmit()
      setPendingSubmitAfterAuth(true)
      setAuthOpen(true)
      return
    }

    const wasFirstSubmit = !submitted
    setSubmitting(true)
    const error = await submitPredictions()
    setSubmitting(false)

    if (error) {
      toast.error(error)
      return
    }

    if (wasFirstSubmit) {
      toast.success('Predictions submitted. You can edit them until kickoff.')
      router.push(summaryHref)
    } else {
      toast.success('Submission updated.')
    }
  }, [
    hasSomethingToSubmit,
    totalGroupPredictions,
    totalKnockoutPredictions,
    user,
    submitted,
    submitPredictions,
    router,
    summaryHref,
  ])

  const handleDiscard = () => {
    setConfirmDiscardOpen(true)
  }

  const handleConfirmDiscard = () => {
    discardUnsavedChanges()
    setConfirmDiscardOpen(false)
    toast.info('Edits discarded.')
  }

  const handleConfirmNavigation = () => {
    if (!pendingNavigationHref) return

    setDiscardingNavigation(true)
    discardUnsavedChanges()
    setDiscardingNavigation(false)

    const destinationHref = pendingNavigationHref
    setPendingNavigationHref(null)

    if (destinationHref.startsWith(window.location.origin)) {
      router.push(destinationHref.slice(window.location.origin.length))
      return
    }

    window.location.assign(destinationHref)
  }

  useEffect(() => {
    if (!pendingSubmitAfterAuth) return
    if (attemptedAuthSubmitRef.current) return
    if (authLoading || !user) return
    if (!dbLoaded) return
    if (predictionsLocked) return
    if (!allComplete) return

    attemptedAuthSubmitRef.current = true
    void Promise.resolve().then(() => {
      clearPendingSubmit()
      setPendingSubmitAfterAuth(false)
      setAuthOpen(false)
      handleSubmit()
    })
  }, [
    pendingSubmitAfterAuth,
    authLoading,
    user,
    dbLoaded,
    predictionsLocked,
    allComplete,
    handleSubmit,
  ])

  useEffect(() => {
    currentHrefRef.current = window.location.href
  }, [pathname])

  useEffect(() => {
    if (!isDirty) return

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      if (!(event.target instanceof Element)) return

      const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return

      const href = anchor.href
      if (
        !shouldPromptForUnsavedChangesNavigation({
          hasUnsavedChanges: isDirty,
          currentPathname: pathname,
          destinationHref: href,
        })
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      setPendingNavigationHref(href)
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
    }
  }, [isDirty, pathname])

  useEffect(() => {
    if (!isDirty) return

    const handlePopState = () => {
      const destinationHref = window.location.href

      if (
        !shouldPromptForUnsavedChangesNavigation({
          hasUnsavedChanges: isDirty,
          currentPathname: pathname,
          destinationHref,
        })
      ) {
        currentHrefRef.current = destinationHref
        return
      }

      if (currentHrefRef.current) {
        window.history.pushState(null, '', currentHrefRef.current)
      }
      setPendingNavigationHref(destinationHref)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isDirty, pathname])

  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  const showSubmit = !predictionsLocked
  const showDirtyBanner = isDirty && !predictionsLocked

  return (
    <div>
      <div
        id="predict-stepper"
        className="sticky top-14 z-40 border-b border-border/30 bg-background/95 backdrop-blur-sm"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <PredictProgressBar
            groupCount={totalGroupPredictions}
            knockoutCount={totalKnockoutPredictions}
            className="flex-1"
          />
          {showSubmit && (
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitButtonDisabled}
              className={cn(
                'shrink-0 bg-emerald-600 hover:bg-emerald-700',
                submitButtonDisabled && 'bg-emerald-600/40 hover:bg-emerald-600/40',
              )}
            >
              {submitButtonLabel}
            </Button>
          )}
        </div>
      </div>

      {showDirtyBanner && (
        <div className="border-b border-amber-500/30 bg-amber-500/10">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
            <p className="flex-1 text-xs text-amber-300">
              You have unsaved changes since your last submission. Update
              your submission to save them.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              className="shrink-0 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
            >
              Discard changes
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>

      {authOpen && (
        <AuthModal
          open={authOpen}
          onOpenChange={(open) => {
            setAuthOpen(open)
            if (!open && !user) {
              clearPendingSubmit()
              setPendingSubmitAfterAuth(false)
            }
          }}
          initialMode="signup"
          returnTo="/predict/bracket"
        />
      )}

      <Dialog
        open={pendingNavigationHref !== null}
        onOpenChange={(open) => {
          if (!open && !discardingNavigation) {
            setPendingNavigationHref(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard edits?</DialogTitle>
            <DialogDescription>
              You have unsaved changes to your submitted predictions. If you
              leave now, your changes will be discarded and your saved
              submission will stay as it was.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingNavigationHref(null)}
              disabled={discardingNavigation}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmNavigation}
              disabled={discardingNavigation}
            >
              {discardingNavigation ? 'Discarding...' : 'Discard and leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard edits?</DialogTitle>
            <DialogDescription>
              Your unsaved changes will be reverted to your last submitted
              predictions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDiscardOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDiscard}
            >
              Discard edits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Quick visual smoke check**

```bash
npm run dev
```

Then open `http://localhost:3000/predict/groups` and confirm:

- The sticky strip shows the dual progress bar + Submit button.
- The Submit button is disabled when picks are incomplete (initial state).
- The four step pills are gone.
- The amber "Editing submitted predictions" banner is gone.

Kill the dev server when satisfied.

- [ ] **Step 4: Commit**

```bash
git add src/app/predict/layout.tsx
git commit -m "feat(predict): replace step pills with sticky progress bar + Submit"
```

---

## Task 7: Update `predict/groups/page.tsx`

**Files:**

- Modify: `src/app/predict/groups/page.tsx`

- [ ] **Step 1: Drop `editingSubmission` and `readOnlySubmitted` from imports/destructure**

In the `usePredictions()` destructuring (around line 202), remove
`editingSubmission` and delete the `readOnlySubmitted` line:

```diff
   const {
     groupPredictions,
     tieBreakResolutions,
     setGroupPrediction,
     completedGroups,
     submitted,
     predictionsLocked,
-    editingSubmission,
     autofillDemo,
     autofillGroupDemo,
     autofillMatchDemo,
     setTieBreakResolution,
   } = usePredictions()
-  const readOnlySubmitted = submitted && !editingSubmission
```

- [ ] **Step 2: Drop the unused `submitted` import if it's no longer referenced**

Search the file for `submitted` and `readOnlySubmitted`. Every remaining
reference should be removed:

- `disabled={predictionsLocked || readOnlySubmitted}` → `disabled={predictionsLocked}` (search for all occurrences; there are at least three: GroupMatchCard, TieBreakResolver mobile, TieBreakResolver desktop).
- The two `!predictionsLocked && !readOnlySubmitted` conditions wrapping autofill CTAs → `!predictionsLocked`.

Once the renames are done, `submitted` itself is no longer referenced. Remove
it from the `usePredictions()` destructuring as well.

- [ ] **Step 3: Update `useStickyOffsets` for the now-always-sticky stepper**

The sticky strip is sticky on **all** viewport sizes after Task 6 (today
the stepper was only sticky from `sm:` upward). The `useStickyOffsets`
hook had a mobile branch that returned just the navbar height; that's now
incorrect — the sticky standings need to sit below the strip on mobile too.

Replace the body of `useStickyOffsets` so the offsets are identical for
mobile and desktop:

```ts
function useStickyOffsets() {
  const [standingsOffset, setStandingsOffset] = useState(0)
  const [sidebarOffset, setSidebarOffset] = useState(0)

  useEffect(() => {
    const navbar = document.querySelector('header')
    const stepper = document.getElementById('predict-stepper')
    if (!navbar || !stepper) return

    const measure = () => {
      const navH = navbar.offsetHeight
      const stepperH = stepper.offsetHeight
      setStandingsOffset(navH + stepperH)
      setSidebarOffset(navH + stepperH)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(navbar)
    ro.observe(stepper)
    return () => {
      ro.disconnect()
    }
  }, [])

  return { standingsOffset, sidebarOffset }
}
```

This removes the `smQuery` plumbing — both offsets are the same number
now, but we keep two named values so consumers don't need to be touched.

- [ ] **Step 4: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Quick visual smoke check**

```bash
npm run dev
```

Open `/predict/groups`. Confirm score steppers and the autofill dice CTAs
remain visible and interactive. Scroll the page and verify the standings
block tucks below the sticky strip without overlap. Kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/predict/groups/page.tsx
git commit -m "refactor(predict/groups): always allow score edits; fix sticky offsets"
```

---

## Task 8: Update `predict/thirds/page.tsx`

**Files:**

- Modify: `src/app/predict/thirds/page.tsx`

- [ ] **Step 1: Remove `editingSubmission`, `submitted`, and `readOnlySubmitted`**

In the `usePredictions()` destructuring (around line 96), remove
`submitted` and `editingSubmission`, then delete the `readOnlySubmitted` line:

```diff
   const {
     groupPredictions,
     tieBreakResolutions,
     setTieBreakResolution,
     completedGroups,
     predictionsLocked,
-    submitted,
-    editingSubmission,
   } = usePredictions()
-  const readOnlySubmitted = submitted && !editingSubmission
```

- [ ] **Step 2: Replace `readOnlySubmitted` references**

There are at least two references in this file:

1. In the `canMoveTie` line (around line 247):
   ```diff
-  const canMoveTie = isQualificationRelevantTie && !predictionsLocked && !readOnlySubmitted
+  const canMoveTie = isQualificationRelevantTie && !predictionsLocked
   ```

2. In the qualification-cutoff explainer copy (around line 191):
   ```diff
-          {readOnlySubmitted
-            ? 'Some third-place teams are tied around the qualification cutoff. Edit your submission to adjust who advances.'
-            : 'Some third-place teams are tied around the qualification cutoff. Use the arrows to choose who advances. Bracket slots are assigned from FIFA\u2019s matchup table.'}
+          Some third-place teams are tied around the qualification cutoff. Use the arrows to choose who advances. Bracket slots are assigned from FIFA\u2019s matchup table.
   ```

- [ ] **Step 3: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/predict/thirds/page.tsx
git commit -m "refactor(predict/thirds): always allow tie-break edits; drop readOnlySubmitted"
```

---

## Task 9: Update `predict/bracket/page.tsx`

**Files:**

- Modify: `src/app/predict/bracket/page.tsx`

- [ ] **Step 1: Remove `editingSubmission`, `submitted`, `readOnlySubmitted` from destructuring & state**

In the `usePredictions()` destructuring (around line 37), remove `submitted`,
`editingSubmission`, `submitting`, `submitPredictions`, and delete the
`readOnlySubmitted` line. The page no longer needs to know about submit at
all — that's the layout's job now.

```diff
   const {
     groupPredictions,
     knockoutPredictions,
     knockoutMatchups,
     tieBreakResolutions,
     setKnockoutPrediction,
     completedGroups,
-    submitted,
     predictionsLocked,
-    editingSubmission,
-    submitting,
-    submitPredictions,
     totalGroupPredictions,
     totalKnockoutPredictions,
     autofillKnockoutDemo,
     dbLoaded,
   } = usePredictions()
```

(`submitted` is still needed for `displayedMatches` logic — see step 2.)

- [ ] **Step 2: Keep `submitted` if needed for `displayedMatches`**

Re-check the file: `displayedMatches` depends on `readOnlySubmitted` to
decide whether to apply the persisted `knockoutMatchups`. With
always-editable predictions, we should now apply the persisted matchups
**only when the user is not currently editing them away** — which is the
same as "no in-flight edits + the user has submitted". The simplest rule:
use the persisted matchups whenever `submitted` is true. Reads:

```diff
-  const allGroupsComplete = completedGroups.length === 12
-  const allKnockoutComplete = totalKnockoutPredictions >= 32
-  const readOnlySubmitted = submitted && !editingSubmission
-  const canSubmit = allGroupsComplete && allKnockoutComplete && !submitted && !predictionsLocked && !submitting
-
-  const displayedMatches = useMemo(() => {
-    if (!readOnlySubmitted) return resolvedMatches
-    return applyKnockoutMatchups(resolvedMatches, knockoutMatchups)
-  }, [knockoutMatchups, readOnlySubmitted, resolvedMatches])
+  const allGroupsComplete = completedGroups.length === 12
+
+  const displayedMatches = useMemo(() => {
+    if (!submitted) return resolvedMatches
+    return applyKnockoutMatchups(resolvedMatches, knockoutMatchups)
+  }, [knockoutMatchups, submitted, resolvedMatches])
```

Re-add `submitted` to the `usePredictions()` destructuring (kept from step 1):

```diff
   const {
     groupPredictions,
     knockoutPredictions,
     knockoutMatchups,
     tieBreakResolutions,
     setKnockoutPrediction,
     completedGroups,
+    submitted,
     predictionsLocked,
     totalGroupPredictions,
     totalKnockoutPredictions,
     autofillKnockoutDemo,
     dbLoaded,
   } = usePredictions()
```

- [ ] **Step 3: Delete the entire `handleSubmit` callback**

Remove the `handleSubmit` `useCallback` (around lines 97–142) and the
`writePendingSubmit / setPendingSubmitAfterAuth / setAuthOpen` block.
Submission is now the layout's responsibility.

- [ ] **Step 4: Delete the deferred-submit `useEffect`**

The effect that auto-submits when `wantsSubmit` or `pendingSubmitAfterAuth`
is set (around lines 144–174) is now redundant with the equivalent effect
in `predict/layout.tsx`. Delete it from the bracket page.

- [ ] **Step 5: Remove submit-related local state and refs**

Delete `wantsSubmit`, `authOpen`, `setAuthOpen`, `pendingSubmitAfterAuth`,
`setPendingSubmitAfterAuth`, `attemptedRef`, and any imports they used
(`readPendingSubmit`, `writePendingSubmit`, `clearPendingSubmit`,
`useSearchParams`, `AuthModal`). `searchParams` and `?submit=1` handling
remains in the layout's auth-submit flow.

- [ ] **Step 6: Replace the top + bottom inline Submit buttons**

The top-of-page button row (around lines 204–233) and the bottom-of-page
button row (around lines 243–261) both contain a "Submit Predictions"
button. Replace each with the unconditional version — Submit lives in the
sticky strip now. Keep "Back to Best 3rds" and the conditional "View
Summary" link.

Top of page:

```diff
       <div className="flex flex-wrap items-center gap-2 mt-3">
         <Link href={`${basePath}/thirds`}>
           <Button variant="outline" size="sm">Back to Best 3rds</Button>
         </Link>
-        {readOnlySubmitted ? (
+        {submitted ? (
           <Link href={`${basePath}/summary`}>
             <Button size="sm">View Summary</Button>
           </Link>
-        ) : (
-          <>
-            {!submitted && (
-              <Button
-                size="sm"
-                onClick={handleSubmit}
-                disabled={submitting}
-                className={canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600/50 hover:bg-emerald-600/60'}
-              >
-                {submitting ? 'Submitting...' : 'Submit Predictions'}
-              </Button>
-            )}
-            <button
-              type="button"
-              onClick={autofillKnockoutDemo}
-              className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
-            >
-              <span className="dice-shake">🎲</span> Auto predict
-            </button>
-          </>
-        )}
+        ) : null}
+        {!predictionsLocked && (
+          <button
+            type="button"
+            onClick={autofillKnockoutDemo}
+            className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
+          >
+            <span className="dice-shake">🎲</span> Auto predict
+          </button>
+        )}
       </div>
```

Bottom of page:

```diff
       <div className="flex gap-2 justify-between items-center">
         <Link href={`${basePath}/thirds`}>
           <Button variant="outline" size="sm">Back to Best 3rds</Button>
         </Link>
         {submitted ? (
           <Link href={`${basePath}/summary`}>
             <Button size="sm">View Summary</Button>
           </Link>
-        ) : (
-          <Button
-            size="sm"
-            onClick={handleSubmit}
-            disabled={submitting}
-            className={canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-600/50 hover:bg-emerald-600/60'}
-          >
-            {submitting ? 'Submitting...' : 'Submit Predictions'}
-          </Button>
-        )}
+        ) : null}
       </div>
```

- [ ] **Step 7: Update the BracketView `disabled` prop and subhead copy**

```diff
-      <BracketView
-        matches={displayedMatches}
-        predictions={knockoutPredictions}
-        onPickWinner={handlePickWinner}
-        disabled={predictionsLocked || readOnlySubmitted}
-      />
+      <BracketView
+        matches={displayedMatches}
+        predictions={knockoutPredictions}
+        onPickWinner={handlePickWinner}
+        disabled={predictionsLocked}
+      />
```

Subhead copy:

```diff
-        <p className="text-sm text-muted-foreground mt-1">
-          {submitted
-            ? predictionsLocked
-              ? 'Your predictions are locked. View your summary for details.'
-              : 'Your predictions are submitted. You can edit and resubmit until kickoff.'
-            : `Click on a team to pick the winner. Picks: ${totalKnockoutPredictions}/32`}
-        </p>
+        <p className="text-sm text-muted-foreground mt-1">
+          {predictionsLocked
+            ? 'Your predictions are locked. View your summary for details.'
+            : `Click on a team to pick the winner. Picks: ${totalKnockoutPredictions}/32`}
+        </p>
```

- [ ] **Step 8: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Run all tests**

```bash
npm test
```

Expected: all green.

- [ ] **Step 10: Quick visual smoke check**

```bash
npm run dev
```

Open `/predict/bracket`. Confirm the inline "Submit Predictions" buttons
are gone (top + bottom), but "Back to Best 3rds" remains, and (when
submitted) "View Summary" appears. The bracket itself stays interactive.

- [ ] **Step 11: Commit**

```bash
git add src/app/predict/bracket/page.tsx
git commit -m "refactor(predict/bracket): drop inline Submit + readOnlySubmitted gating"
```

---

## Task 10: Remove Deprecated Context APIs

**Files:**

- Modify: `src/context/predictions-context.tsx`

At this point no consumer references `editingSubmission`,
`startEditingSubmission`, or `cancelEditingSubmission`. Time to delete them.

- [ ] **Step 1: Remove from `PredictionsContextType`**

Delete these three lines from the interface (around line 44–58):

```diff
-  startEditingSubmission: () => void
-  cancelEditingSubmission: () => Promise<string | null>
-  editingSubmission: boolean
```

- [ ] **Step 2: Remove the `editingSubmission` state**

In `ScopedPredictionsProvider`, delete:

```diff
-  const [editingSubmission, setEditingSubmission] = useState(false)
```

- [ ] **Step 3: Remove the `setEditingSubmission(false)` call inside `submitPredictions`**

The line `setEditingSubmission(false)` no longer compiles. Delete it.

- [ ] **Step 4: Remove `startEditingSubmission` and `cancelEditingSubmission`**

Delete both `useCallback` blocks (around lines 326–344).

- [ ] **Step 5: Remove them from the provider value**

In the `<PredictionsContext value={{ ... }}>` block at the bottom, remove:

```diff
-      startEditingSubmission,
-      cancelEditingSubmission,
...
-      editingSubmission,
```

- [ ] **Step 6: Verify the project compiles + tests pass**

```bash
npx tsc --noEmit
npm test
```

Expected: zero errors; all tests green. Any straggling consumer is the
final TypeScript safety net.

- [ ] **Step 7: Commit**

```bash
git add src/context/predictions-context.tsx
git commit -m "refactor(predictions): drop editingSubmission and related context APIs"
```

---

## Task 11: Remove Duplicate Progress Bar From Groups Page

**Files:**

- Modify: `src/app/predict/layout.tsx` (if a per-page progress bar still exists there)
- Modify: `src/app/predict/groups/page.tsx`

Earlier the predict layout rendered an additional `<Progress />` bar
specifically for the groups page (the "N/72 matches" bar). After Task 6 the
sticky strip already shows the same information.

- [ ] **Step 1: Confirm the duplicate is already removed**

Open `src/app/predict/layout.tsx`. Search for `pathname.endsWith('/predict/groups')`.
If the block is gone (Task 6's rewrite already removed it), skip steps 2–4.

- [ ] **Step 2: Check `predict/groups/page.tsx` for any inline progress UI**

Open `src/app/predict/groups/page.tsx`. Search for `Progress` and verify
that no remaining `<Progress />` element exists. The page should rely on
the sticky strip in the layout.

- [ ] **Step 3: Final smoke check**

```bash
npm run dev
```

Open `/predict/groups`. Confirm only one progress bar is visible (the
sticky one in the strip). Kill the dev server.

- [ ] **Step 4: Commit (if anything changed)**

```bash
git add -A
git commit -m "polish(predict): remove duplicate progress bar from groups page"
```

If nothing changed in this task, skip the commit and move on.

---

## Task 12: Final Verification

**Files:** None modified — verification only.

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: no errors. Warnings are acceptable; review and fix if any new ones
were introduced by these changes.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all green.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Manual smoke checks (dev server)**

```bash
npm run dev
```

Walk through the following scenarios in order, in a fresh incognito window:

1. **First-time predictor** — Anonymous, click "Start predicting". Fill in
   all 72 group matches and all 32 KO picks. The sticky Submit button
   should now read **Submit predictions** and be **enabled**. Click it.
   Expect: auth modal (since anon). Complete signup. After auth, expect
   automatic submission, success toast, and redirect to `/predict/summary`.

2. **Submitted, clean state** — Reload the page. Visit `/predict/groups`.
   Expect: no dirty banner. Sticky strip shows **Update submission**,
   disabled.

3. **Make a dirty edit** — Bump match #1 score from `1-0` to `1-1`.
   Expect: amber dirty banner appears, **Update submission** becomes
   enabled.

4. **Revert the edit** — Bump match #1 back to `1-0`. Expect: banner
   disappears, Submit disables.

5. **Make multiple edits, click Update** — Change a group score and a
   knockout pick. Click **Update submission**. Expect: success toast,
   banner clears, Submit disables, user stays on the same page (no
   redirect for updates).

6. **Discard an edit** — Make a change. Click **Discard changes**. Confirm
   the dialog. Expect: state reverts, banner disappears, Submit disables.

7. **Navigate away with dirty state** — Make a change. Click "Leaderboard"
   in the navbar. Expect: discard-edits dialog. Click "Keep editing"
   returns to predict. Make a change again, navigate to "Leaderboard",
   click "Discard and leave" — should navigate with reverted state. Going
   back to `/predict/groups` should now be clean (no banner).

8. **Reload with dirty state** — Make a change. Hard reload the page.
   Expect: banner immediately visible on reload; draft preserved in
   localStorage; Submit enabled if complete.

9. **Incomplete + dirty** — Clear a single group score (set to blank).
   The match should now be incomplete (e.g., 71/72). Expect: banner
   visible, Submit disabled, progress bar reflects the gap.

10. **Locked tournament** (optional, harder to verify in dev) — If you can
    temporarily mock `isTournamentLocked()` to return `true`, the Submit
    button and dirty banner should both be hidden, and inputs should be
    disabled.

- [ ] **Step 5: If any smoke check failed, fix and re-verify**

Treat any smoke-check failure as a real bug. Reproduce, fix, re-run the
failing scenario.

- [ ] **Step 6: Commit final smoke-test confirmation (no code change)**

This task has no commit. Move on to creating a pull request if all smoke
checks passed.

---

## Wrap-Up

After Task 12 passes:

- The `always-editable-predictions` branch contains a coherent, tested,
  visually verified change set.
- Push the branch (`git push -u origin always-editable-predictions`) and
  open a PR titled **"Always-editable predictions"** linking to the spec.
- Suggested PR description: a short paragraph plus a checklist of the
  twelve scenarios from Task 12's manual smoke checks.
