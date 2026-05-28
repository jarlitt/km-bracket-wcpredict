# Always-Editable Predictions — Design Spec

**Date:** 2026-05-28
**Status:** Draft

## Overview

Replace the explicit "Edit predictions" mode on `/predict/*` with an
always-editable experience. After a user has submitted, scoring steppers and
bracket controls remain enabled. Any change relative to the last submitted
state is tracked as a *draft* and surfaced through a dirty-state banner plus
an Update button; reverting the change clears the banner. The current sticky
step-pill row is replaced by a permanent dual progress bar + Submit button
that lives on every predict page.

## Goals

- Remove the cognitive friction of an explicit "Edit predictions" click after
  submission.
- Give users a steady, unambiguous signal of progress (groups + knockout) at
  all times, without competing nav chrome.
- Make the "I have unsaved changes" state impossible to miss — but invisible
  when there's nothing to do.
- Preserve the safety net: confirmation prompts when the user is about to
  abandon unsubmitted changes outside the predict flow.

## Non-Goals

- No autosave of drafts to the database. Drafts remain local-only; the DB is
  written only on explicit Submit/Update.
- No per-match "edited" indicators on individual cards. The banner is the
  signal.
- No changes to the underlying scoring rules, knockout cascading, or
  tie-break logic.
- No redesign of the Best 3rds, Bracket, or Summary pages beyond removing the
  `readOnlySubmitted` gating.

## User States

The new flow has three conceptual states (per submitted user) plus the
pre-submit state:

1. **Pre-submit** (never submitted) — Inputs enabled, sticky progress bar +
   `Submit predictions` button always visible (disabled until 104/104), no
   dirty banner.
2. **Submitted, clean** — Inputs enabled, sticky progress bar + `Update
   submission` button visible but disabled, no dirty banner. The page is
   quiet — the user can navigate freely.
3. **Submitted, dirty** — Inputs enabled, sticky progress bar + `Update
   submission` button visible and enabled (provided picks are still
   complete), dirty banner visible with `Discard changes` button.
4. **Locked** (tournament started) — Inputs disabled, Submit button hidden,
   banner hidden. Progress bar shown as a 100% recap.

## State Model

### New context shape

`PredictionsContext` gains a `submittedSnapshot` and a derived `isDirty`
flag:

```ts
interface PredictionsContextType extends PredictionsState {
  // ...existing setters
  submitPredictions: (knockoutMatchups?: Record<string, KnockoutMatchup>) => Promise<string | null>
  discardUnsavedChanges: () => void
  submittedSnapshot: PredictionsState | null
  isDirty: boolean
  // ...existing flags
}
```

Removed from the context:

- `editingSubmission`
- `startEditingSubmission`
- `cancelEditingSubmission`

### `isDirty` rule

```
isDirty = state.submitted
       && submittedSnapshot !== null
       && !deepEqual(snapshotComparable(state), snapshotComparable(submittedSnapshot))
```

`snapshotComparable(s)` strips ephemeral fields (`submitted` itself; any keys
whose value is `undefined`) so we don't false-positive on serialization
quirks. A small `computeIsDirty(state, snapshot)` helper lives in
`src/lib/predictions/dirty.ts`.

The four comparison surfaces are:

- `groupPredictions` (object keyed by match id)
- `knockoutPredictions` (object keyed by match id)
- `knockoutMatchups` (object keyed by match id)
- `tieBreakResolutions` (object keyed by tie key)

### Snapshot lifecycle

- **Pre-submit:** `submittedSnapshot === null`. `isDirty` is always `false`.
- **On successful submit:** `submittedSnapshot = structuredClone(state)`
  (after the response confirms success). Persisted to localStorage.
- **On discard:** `state = structuredClone(submittedSnapshot)`. Persisted to
  localStorage.
- **On hydration from DB (mount):**
  - If the DB has `submitted = true`, the DB payload always becomes the
    `submittedSnapshot` (DB is authoritative for the baseline). Stale
    localStorage snapshots are overwritten.
  - The local `state` is kept as-is if it already has dirty changes (so the
    banner shows on first render). Otherwise `state` is seeded from the DB
    payload.

### localStorage

Existing keys are unchanged. A new sibling key holds the snapshot:

- Draft: `predictions:<userId>:<poolId>` *(existing)*
- Snapshot: `predictions:<userId>:<poolId>:snapshot` *(new)*

Helpers `readSubmittedSnapshot` and `writeSubmittedSnapshot` are added to
`src/lib/predictions/storage.ts`, mirroring the existing draft helpers.
Anonymous users never write a snapshot key (they cannot submit).

### `editingSubmission`-blocked localStorage writes are removed

The current effect that suppresses localStorage writes while editing a
submission is deleted. With no explicit edit mode, every state change always
flows to localStorage. Discard restores the snapshot, which also writes
through to localStorage.

## UI

### Sticky strip in `/predict/layout.tsx`

The current four-pill step row is removed. The strip is sticky on both
mobile and desktop (today it's only sticky from `sm:` upward). It contains
two children:

1. **`<PredictProgressBar />`** — a new component in
   `src/components/prediction/predict-progress-bar.tsx`. Renders two inline
   progress segments:

   ```
   [████████░░░░░░░░░░░░░ 48/72][████████ 16/32]   [Submit predictions]
   ```

   - Left segment: `72 / 104` of the row width.
   - Right segment: `32 / 104` of the row width.
   - Each segment is its own `<Progress />` (existing shadcn primitive),
     emerald fill.
   - Subtle vertical divider between segments.
   - Numeric label centered below each segment: `48/72` and `16/32`.
   - When `predictionsLocked` is true, both segments render their final
     totals (`72/72`, `32/32`) as informational recap (or actual counts if
     the user never finished — but inputs are disabled anyway).

2. **Submit button** to the right of the progress bar (vertically centered).
   Label and state:

   | User state | Label | Enabled when |
   |---|---|---|
   | Pre-submit | `Submit predictions` | `groups === 72 && ko === 32` |
   | Submitted, clean | `Update submission` | never (always disabled) |
   | Submitted, dirty | `Update submission` | `groups === 72 && ko === 32` |
   | Locked | *(hidden)* | n/a |

   Click handler is the unified `handleSubmit` (calls `submitPredictions`).
   Success behavior:
   - First-ever submit → toast + `router.push('/predict/summary')`.
   - Subsequent updates → toast only; user stays on the current page.
     *(Behavior change from today, where updates also routed to the summary
     page. Keeping the user in place after an update respects context — they
     were mid-edit on the current page and may want to keep tweaking.)*

   Auth gating, the existing pending-submit cookie/localStorage flow, and
   the post-auth resume effect are preserved unchanged — they just key off
   `isDirty || !submitted` now instead of `!submitted`.

### Dirty banner

When `isDirty === true`, a non-sticky banner renders just below the sticky
strip in the layout (above each page's content). Copy:

> **You have unsaved changes since your last submission.**
> *Update your submission to save them.*
>
> `[Discard changes]`

- Amber background (`bg-amber-500/10`, `border-amber-500/30`,
  `text-amber-300`) — the styling currently used for the
  `editingSubmission` state, repurposed.
- The `Discard changes` button opens the existing confirmation `Dialog`
  with the existing copy ("Discard edits?", "Keep editing" / "Discard
  edits"). On confirm, calls `discardUnsavedChanges`.

### Step pills removed

The current four-pill row (Group Matches → Best 3rds → Knockout Bracket →
Summary) is deleted. Wayfinding moves to two places that already exist:

- **Per-page nav buttons** already present at the bottom (and top, in some
  cases) of each predict page — kept unchanged.
- **Summary access** post-submit:
  - First submit auto-routes to `/predict/summary`.
  - The Bracket page's existing "View Summary" CTA is kept.
  - For deep-link returns, the bottom-of-page footer on each predict page
    grows a small `Summary →` link when `submitted === true`. (Lightweight
    addition; not a redesign.)

### Inputs always enabled

`disabled` props collapse to `predictionsLocked` only:

- `GroupMatchCard disabled={predictionsLocked}` on `/predict/groups`.
- `TieBreakResolver disabled={predictionsLocked}` wherever it appears.
- `BracketView disabled={predictionsLocked}` on `/predict/bracket`.
- Autofill / dice CTAs become `predictionsLocked ? null : <button>`.

The `readOnlySubmitted` computation is removed from
`src/app/predict/groups/page.tsx`, `src/app/predict/thirds/page.tsx`, and
`src/app/predict/bracket/page.tsx`. The Bracket page's inline "Submit
Predictions" buttons at the top and bottom of the page are also removed —
the sticky strip now owns submission.

The standalone `<Progress />` bar on `/predict/groups` (the "N/72 matches"
indicator currently rendered inside the stepper for the groups route) is also
removed — it now duplicates the left segment of the sticky strip's progress
bar. The bracket page's textual "Picks: N/32" copy in the page subhead stays;
it's contextual prose rather than a visual progress bar, and removing it
would leave the page subhead awkwardly empty.

## Navigation Guard

`src/lib/navigation/edit-mode-guard.ts` is renamed/repurposed:

- File name unchanged for now (to keep the diff focused).
- Exported function renamed: `shouldPromptForEditNavigation` →
  `shouldPromptForUnsavedChangesNavigation`.
- Parameter renamed: `editingSubmission` → `hasUnsavedChanges`.
- Body unchanged: the rule is *"prompt only when leaving `/predict/*` to a
  non-predict destination."*

In `src/app/predict/layout.tsx`, the three navigation effects (click
intercept, `popstate`, `beforeunload`) switch their trigger from
`editingSubmission` to `isDirty`. The "Discard edits?" `Dialog` is unchanged
in copy and structure; the confirm handler calls `discardUnsavedChanges`
(instead of awaiting `cancelEditingSubmission`).

## Data Flow Summaries

### Initial load

```
PredictionsProvider mounts
  state ← readPredictionsFromStorage(...)              (existing)
  submittedSnapshot ← readSubmittedSnapshot(...)       (new)
  loadPredictions().then((db) => {
    if (db && db.submitted) {
      submittedSnapshot ← db                            (DB wins)
      writeSubmittedSnapshot(db)
      if (state is empty) state ← db
      // else keep state; banner will surface dirt
    } else if (db) {
      if (state is empty) state ← db
    }
    dbLoaded = true
  })
```

### Submit

```
handleSubmit()
  await submitPredictionsToDb(state.groupPredictions, state.knockoutPredictions, knockoutMatchups)
  on success:
    submittedSnapshot ← structuredClone(state)
    writeSubmittedSnapshot(state)
    state.submitted ← true
    toast("Predictions submitted" or "Submission updated")
    if first submit, router.push("/predict/summary")
  on failure:
    toast(error); no state change
```

### Discard

```
handleDiscard()
  open Discard dialog
  on confirm:
    state ← structuredClone(submittedSnapshot)
    writePredictionsToStorage(state)
    toast("Edits discarded")
    close dialog
```

## Edge Cases

| Case | Behavior |
|---|---|
| Group score change clears affected KO picks | Counts as one dirty change. Banner shows. If clears bring KO below 32, Submit disables until refilled. |
| Tie-break resolution change | Counts as dirty (included in snapshot comparison). |
| Anonymous user | `submittedSnapshot === null` → `isDirty === false`. Pre-submit experience. |
| Locked tournament | Submit hidden, banner hidden, inputs disabled, progress shown. |
| Stale snapshot in localStorage vs. DB | DB wins on hydration; local snapshot is overwritten. |
| Incomplete + dirty | Banner shown; Submit disabled. No additional copy — disabled button + progress bar communicate the gap. |
| Successful update from another device | On next mount, DB has the newer submitted state. DB → snapshot; local draft preserved as state (banner re-appears if it diverges, which is the correct signal). |

## File-Level Scope

**Modified:**

- `src/context/predictions-context.tsx`
- `src/lib/predictions/storage.ts`
- `src/lib/navigation/edit-mode-guard.ts`
- `src/lib/navigation/edit-mode-guard.test.ts`
- `src/app/predict/layout.tsx`
- `src/app/predict/groups/page.tsx`
- `src/app/predict/thirds/page.tsx`
- `src/app/predict/bracket/page.tsx`

**Created:**

- `src/components/prediction/predict-progress-bar.tsx`
- `src/lib/predictions/dirty.ts`
- `src/lib/predictions/dirty.test.ts`

**Behavior removed (not file-level):**

- `editingSubmission`, `startEditingSubmission`, `cancelEditingSubmission`
  from `PredictionsContextType`.
- `readOnlySubmitted` computation across all predict pages.
- "Edit predictions" button and the amber "Editing submitted predictions"
  banner in the predict layout.
- Inline "Submit Predictions" buttons on the Bracket page (top + bottom of
  the page content).

## Testing

### Unit / library tests

- `src/lib/predictions/dirty.test.ts` *(new)*:
  - Identical state + snapshot → `false`.
  - One group score differs → `true`.
  - One knockout pick differs → `true`.
  - A tie-break resolution differs → `true`.
  - `state` with an extra `undefined` value for an unfilled match vs.
    snapshot without that key → `false` (canonicalisation must drop
    undefineds).
  - `snapshot === null` → `false`.
- `src/lib/predictions/storage.test.ts`:
  - Snapshot round-trip (write then read).
  - Missing snapshot key → `null`.
  - Malformed JSON → `null`.
- `src/lib/navigation/edit-mode-guard.test.ts`:
  - Update existing assertions for the renamed function/parameter. No
    behavior changes — same fixtures, same expected outputs.

### Context tests (`src/context/predictions-context.test.tsx`)

- Successful submit populates `submittedSnapshot` and writes the snapshot
  localStorage key.
- Editing a score post-submit flips `isDirty` from `false` → `true`.
- Reverting that score back to the submitted value flips `isDirty` →
  `false`.
- `discardUnsavedChanges` restores all four pieces of state and clears
  `isDirty`.
- Hydration: DB submitted + stale local snapshot → DB wins.
- Hydration: DB submitted + dirty local state → DB becomes snapshot,
  local state retained, `isDirty === true` on render.
- Anonymous user: `submittedSnapshot === null` and `isDirty === false`
  regardless of state changes.

### Layout tests (`src/app/predict/layout.test.tsx`)

- Sticky strip with progress bar + Submit renders on all four predict
  routes.
- Submit disabled when picks incomplete.
- Submit disabled when submitted and not dirty.
- Submit enabled when submitted, dirty, and complete.
- Submit hidden when `predictionsLocked`.
- Dirty banner appears only when `isDirty`.
- Discard button opens dialog and calls `discardUnsavedChanges` on confirm.
- Navigation away from `/predict/*` to `/leaderboard` while dirty opens
  the discard dialog; navigation between predict pages does not.

### Manual smoke checks

1. First-time predictor: complete 104 picks, click Submit, observe sticky
   strip shows disabled `Update submission`, no banner, redirect to
   summary.
2. Edit a single group score post-submit: banner appears, Submit enables.
   Click Update → toast, banner clears, button disables.
3. Edit then revert to original value: banner disappears, Submit disables.
4. Edit then click Discard: confirmation modal → confirm → all four state
   pieces revert, banner clears.
5. Edit then try to navigate to `/leaderboard`: prompted; `Keep editing`
   returns to predict; `Discard and leave` navigates with reverted state.
6. Hard reload while dirty: banner visible immediately on reload, draft
   preserved.
7. Locked tournament (mock `isTournamentLocked` to `true`): Submit hidden,
   banner hidden, inputs disabled, progress bar visible.

## Open Questions

None.

## Out of Scope

- Server-side autosave of drafts to the database.
- Per-match dirty indicators on individual cards.
- Redesigning the Best 3rds, Bracket, or Summary pages beyond the
  `readOnlySubmitted` removal.
- Cross-route "you have unsaved predictions" indicator outside `/predict/*`
  (we keep the existing "discard?" prompt as the only cross-route signal).
