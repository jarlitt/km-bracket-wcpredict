# Thirds-as-Group Tab + Browser-Navigable Groups + Quiet Unsaved Alert — Design Spec

**Date:** 2026-05-28
**Status:** Draft

## Overview

Three related changes to the predict funnel:

1. **Best 3rds becomes a tab inside Groups, not its own page.** A "3rds" pill is appended (visually separated) to the existing group selector pill row. The standalone `/predict/thirds` route is removed.
2. **Browser back/forward navigates between groups.** Today, `selectedGroup` is purely client-side `useState`, so pressing back from `/predict/groups` goes to the previous *page* (homepage), skipping the journey through groups. After this change, switching pills updates the URL via `?group=` and pushes a real history entry, so back/forward steps through the user's own selections.
3. **The "You have unsaved changes" amber band is replaced by a quiet inline alert card** styled like the existing "Complete all group predictions to see accurate standings" card on the 3rds page. The Submit button moves permanently into the sticky strip.

None of these changes turn the groups into separate Next.js routes. The Groups page remains a single component; only the search param changes when the user navigates between A → B → … → L → 3rds.

## Goals

- Reduce navigational friction inside the predict funnel — selections feel like real navigation, not silent state changes.
- Remove a "page" (Best 3rds) that was always a single click away from a closely-related view, simplifying the mental model and the top stepper.
- Quiet down the unsaved-changes treatment so it stops competing with primary navigation chrome for visual weight.

## Non-Goals

- Redesigning tie-break resolution UX (chevrons stay as-is).
- Touching the Bracket or Summary pages.
- Adding new context API surface — everything reads existing predictions-context state.
- Persisting the last-viewed group across sessions (initial-load logic uses "first incomplete" only).

## URL Scheme

Single search param on the Groups route:

| URL | Meaning |
|---|---|
| `/predict/groups` | No selection encoded. App resolves a default and `router.replace`s to a canonical URL. |
| `/predict/groups?group=A` … `?group=L` | Group A through L selected. |
| `/predict/groups?group=thirds` | Best 3rds view selected. |
| `/predict/groups?group=<anything-else>` | Treated as missing param; default-selection logic runs and rewrites the URL. |

**Push vs replace:**

- User-initiated selection (clicking a pill, pressing the prev/next buttons) uses `router.push` → real history entry → browser back/forward steps through selections.
- Default-selection on cold load uses `router.replace` → no extra history entry → the URL becomes refresh-stable but back from `?group=A` returns to the prior page (e.g. homepage), not to a paramless URL.

**Default-selection logic** when no/invalid `group` param:

1. Find the first group in `A`–`L` not in `completedGroups`.
2. If all 12 are complete, fall back to `A`.
3. `router.replace` with the resolved value.

The default runs once on mount. It does **not** re-run when `completedGroups` updates later (e.g. after edits) — once a value is in the URL, the URL wins. Implemented via a `useRef`-gated effect or by checking that the param is absent at the moment the effect runs.

**Legacy redirect:** `/predict/thirds` → `/predict/groups?group=thirds` (308 permanent), via `next.config.ts`.

## UI Structure

### Stepper (predict layout)

Drops from 4 entries to 3:

- **Groups** (active for any path matching `/predict/groups`, regardless of `?group=` value)
- **Bracket**
- **Summary**

The bracket-conflict badge ("N matches need new picks") is unaffected.

### Group selector pill row

Order: `A B C D E F G H I J K L | 3rds`

- The 3rds pill is visually separated from the groups by a small spacer plus a thin vertical divider (`border-l border-border/50` with `ml-2 pl-2` or equivalent), making the boundary obvious without breaking the row's scrollability.
- The 3rds pill uses the same selected/idle visual states as the group pills.
- The 3rds pill stays **neutral** — no emerald "complete" tint, ever — because Best 3rds can have optional tie-breakers that may never resolve, so a "complete" signal is misleading.
- The horizontal scroll arrow logic (`canScrollLeft` / `canScrollRight`) keeps working — the 3rds pill is just one more child.

### Header & subtitle

Single shared header above the selector for both modes:

- H1: `Group Stage Predictions` (unchanged in both modes).
- Subtitle is dynamic:
  - **Group mode:** `Predict the score for each of the 72 group matches`
  - **3rds mode:** `The eight best third-place teams advance to the knockout stage.` — switching to `The eight best third-place teams advance. Use the arrows to resolve ties around the cutoff.` when there are qualification-relevant ties (same conditional copy as today's thirds page). Followed by the inline `<TieBreakerRulesHelp type="third-place" variant="standalone" />`.

### Auto-predict button

The 🎲 "Auto predict all groups" button sits in the header area in group mode only. **Hidden** in 3rds mode.

### Body content

- **Group mode:** Identical to today — match cards on the left, sticky standings sidebar on the right (desktop), inline mobile standings, tie-break resolver.
- **3rds mode:** The rankings table + qualification badge + tie-resolution chevrons. Standings sidebar disappears entirely. The `Complete all group predictions to see accurate standings` amber card stays in this mode (unchanged from today's thirds page).

The 3rds rendering moves into a new pure-view component: `src/components/prediction/best-thirds-view.tsx`. The Groups page conditionally renders this component vs the matches/sidebar layout based on the URL param. The thirds page route (`src/app/predict/thirds/page.tsx`) is **deleted**.

### Mobile bottom bar (prev/next)

| Selection | Left | Right |
|---|---|---|
| Group A | (hidden) | `Group B →` |
| Groups B–K | `← prev group` | `next group →` |
| Group L | `← Group K` | `3rds →` (selects 3rds pill, pushes URL — no route change) |
| 3rds | `← Group L` | `Bracket →` (real link to `/predict/bracket`, leaves the Groups page) |

### Desktop inline prev/next

Mirrors the mobile bottom bar logic:

- In group mode: same prev/next as today, with L's right button pointing to `3rds` instead of the Bracket route.
- In 3rds mode: `← Group L` and `Bracket →`. The existing thirds inline CTAs (`Edit Scores`, `Next: Bracket`) are folded into this pattern — `← Group L` replaces `Edit Scores` (because the user already has direct access to any group via the pill row), and `Bracket →` replaces `Next: Bracket`.

### Scroll-to-top on selection change

The existing "scroll to top when group changes" effect is re-keyed from `selectedGroup` to the URL param value. It fires for every selection change, including A → 3rds and back-button traversals. The first-render skip stays in place so the browser's restored scroll position wins on cold loads / refreshes.

## Unsaved-Changes Alert

### New alert (replaces the amber band)

- **Visual:** rounded amber card — `rounded-xl border border-amber-500/30 bg-amber-500/10 p-4` — same recipe as the "Complete all group predictions…" card.
- **Content:** message + Discard link only. No Submit button.
  > You have unsaved changes. **[Discard]**
- **Placement:** at the top of the page content (`max-w-7xl mx-auto px-4 py-6`), above the page H1. Lives in `predict/layout.tsx` so it's shared across all predict-funnel pages.
- **Behavior:** **not sticky** — scrolls with the page.
- **Show condition:** unchanged — `isDirty && !predictionsLocked`.
- **A11y:** keep `role="status" aria-live="polite"` on the wrapper.
- **Discard interaction:** unchanged — calls `discardUnsavedChanges()` and shows `toast.info('Edits discarded.')`.

### Submit button relocation

Today's `showSubmitInStrip` rule is `!submitted && !predictionsLocked`. New rule: `hasSomethingToSubmit && !predictionsLocked` (where `hasSomethingToSubmit = isDirty || !submitted` — already exists).

Effect: the strip Submit:

- Appears for first-time submitters with a complete bracket (today's behavior).
- **New:** appears for already-submitted users whenever `isDirty`. This replaces the duplicate Submit button that used to live in the dirty banner.
- Disappears once predictions are locked or there's nothing pending.
- Keeps the same `submitButtonDisabled` and `submitButtonLabel` logic.

This means the strip Submit will appear on `/predict/summary` too when an already-submitted user has unsaved edits. That's intentional — Submit becomes reachable from anywhere in the funnel, matching the "always editable predictions" direction. We accept this and revisit only if it proves confusing in practice.

## Edge Cases

- **Invalid `?group=` value** (e.g. `?group=Z`, `?group=foo`): treated as missing. Default-selection runs, `router.replace` rewrites the URL. No error toast.
- **Rapid pill clicks:** every click pushes a history entry. We do not debounce — debouncing would mean back/forward skips groups.
- **Discard prompt does not fire on intra-Groups navigation:** `shouldPromptForUnsavedChangesNavigation` matches on path + same-origin. A same-path `?group=` change does not trigger the discard prompt. The prompt only fires when leaving the predict funnel with unsaved edits.
- **Initial-mount race:** default-selection runs after the predictions context mounts. If `completedGroups` is empty during hydration, "first incomplete" resolves to `A`; the URL becomes `?group=A`. When `completedGroups` populates later, default-selection does **not** re-run — the URL is already set, and re-running would yank the user away from a deliberate selection.
- **Deep link to a complete group** (e.g. `?group=B` with B already complete): no special behavior, the URL wins.
- **Discard while in 3rds mode:** `discardUnsavedChanges()` is unrelated to which tab is showing. After discard, if a previously-completed group becomes incomplete, the user stays on 3rds — no auto-navigation.
- **All 12 groups complete + no param on cold load:** default-selection falls back to Group A.

## Components / Files Affected

| File | Change |
|---|---|
| `src/app/predict/layout.tsx` | Stepper drops 3rds. Banner replaced with rounded-card alert above `{children}`. `showSubmitInStrip` widened to `hasSomethingToSubmit && !predictionsLocked`. Discard button stays inside the new alert. |
| `src/app/predict/groups/page.tsx` | Selection state moves from `useState` → `useSearchParams()`. Default-selection effect added. Pill row gains divider + 3rds pill. Body conditionally renders matches view vs `<BestThirdsView />`. Subtitle becomes dynamic. Auto-predict button hidden in 3rds mode. Mobile bottom bar + desktop inline prev/next gain `→ 3rds` after L and `← Group L | Bracket →` in 3rds mode. |
| `src/app/predict/thirds/page.tsx` | **Deleted.** |
| `src/components/prediction/best-thirds-view.tsx` | **New.** Pure-view extraction of today's thirds-page rendering. No route concerns; renders the rankings table + tie-resolution UI. The "← Group L" / "Bracket →" CTAs do not live here — they're handled by the parent groups page so the prev/next pattern stays consistent. |
| `next.config.ts` | Add redirect `/predict/thirds` → `/predict/groups?group=thirds` (permanent). |
| Tests / fixtures | Anything hardcoding the 4-step list or `/predict/thirds` href needs to migrate. Quick audit during implementation. |

## Helper Function

A pure function isolates the param-resolution logic for testability:

```ts
function resolveSelectedGroup(
  rawParam: string | null,
  completedGroups: string[],
): { value: GroupId | 'thirds'; canonical: boolean }
```

- Returns `{ value, canonical: true }` when `rawParam` is a valid group letter or `'thirds'`.
- Returns `{ value: <first incomplete or 'A'>, canonical: false }` when `rawParam` is missing or invalid. The caller uses `canonical: false` to trigger `router.replace`.

Tested in isolation: valid groups, `'thirds'`, `null`, invalid string, all-complete fallback to `A`, partial-complete returns first incomplete.

## Testing

### Unit

- `resolveSelectedGroup` — full coverage of input combinations.

### Manual / integration

1. Land on `/predict/groups` cold → URL becomes `?group=<first incomplete or A>`, matching pill selected.
2. Click pill `B` → URL is `?group=B`, body re-renders, page scrolls to top, history grows.
3. Browser back → URL returns to previous selection, no discard prompt.
4. Click `3rds` pill → URL is `?group=thirds`, subtitle swaps, body shows rankings table, sidebar disappears, auto-predict button hidden.
5. Browser back from 3rds → returns to last group.
6. Visit legacy `/predict/thirds` → 308 redirect → lands on `?group=thirds`.
7. Make an edit → quiet rounded amber alert appears above page H1 (no full-width band), strip shows Submit.
8. Submit a complete entry, then edit again → strip Submit re-appears even though `submitted` is true.
9. Mobile bottom bar in 3rds shows `← Group L` and `Bracket →`. Bracket leaves the Groups page (no popstate intercept since `isDirty` is false; if `isDirty`, the existing discard-confirm dialog fires as today).
10. Discard from the new alert → toast fires, alert disappears, strip Submit hides.

### Regression watchlist

- `pendingNavigationHref` discard-confirm dialog still fires when leaving `/predict/groups` for any other path with unsaved edits.
- `bracketChanged` badge on the Bracket stepper item still works.
- Auto-predict completes all groups without unexpectedly changing the selected pill.

## Out of Scope

- Tie-break resolution UX redesign.
- Bracket page, Summary page, sticky strip's progress bar / conflict badge.
- Predictions-context API surface.
- Persisting last-viewed group across sessions (cookie / localStorage).
