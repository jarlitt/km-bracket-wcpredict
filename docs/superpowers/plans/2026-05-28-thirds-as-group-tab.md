# Thirds-as-Group Tab + Browser-Navigable Groups + Quiet Unsaved Alert — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Best 3rds page into a tab inside the Groups page, make group selection navigate via a `?group=` search param so browser back/forward steps through selections, and replace the full-width amber unsaved-changes band with a quiet inline card while moving Submit permanently into the sticky strip.

**Architecture:** The Groups page stays a single Next.js client route. A `?group=` search param (values `A`–`L` or `thirds`) becomes the single source of truth for which view shows; selecting a pill calls `router.push` so each selection is a real history entry. The 3rds rendering is extracted into a pure `<BestThirdsView />` component. The standalone `/predict/thirds` route is deleted and redirected.

**Tech Stack:** Next.js (App Router, client components), React, TypeScript, Tailwind, Vitest.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/navigation/predict-routes.ts` (modify) | Add `PredictGroupSelection` type, `predictGroupsHref()` builder, and the pure `resolveSelectedGroup()` resolver. |
| `src/lib/navigation/predict-routes.test.ts` (modify) | Unit tests for the two new helpers. |
| `src/components/prediction/best-thirds-view.tsx` (create) | Pure view: 3rds rankings table, qualification badge, tie-resolution chevrons, "complete all groups" card. No route concerns, no prev/next CTAs. |
| `src/app/predict/groups/page.tsx` (modify) | Read selection from `useSearchParams`, default-selection effect, 3rds pill, conditional body, dynamic subtitle, hide auto-predict in 3rds, prev/next wiring. |
| `src/app/predict/layout.tsx` (modify) | Drop Best 3rds from stepper, replace amber band with quiet card, widen `showSubmitInStrip`. |
| `src/app/predict/thirds/page.tsx` (delete) | Removed; replaced by the redirect + `<BestThirdsView />`. |
| `next.config.ts` (modify) | Add permanent redirect `/predict/thirds` → `/predict/groups?group=thirds`. |

Run tests with: `npm test` (alias for `vitest run`). Run a single file with `npx vitest run <path>`.

---

## Task 1: Add `predictGroupsHref` + `resolveSelectedGroup` helpers

These two pure functions isolate the URL logic so the React component stays thin and the logic is unit-testable. `resolveSelectedGroup` validates the raw param and returns the default when it's missing/invalid; `predictGroupsHref` builds the canonical URL.

**Files:**
- Modify: `src/lib/navigation/predict-routes.ts`
- Test: `src/lib/navigation/predict-routes.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/navigation/predict-routes.test.ts` (keep the existing `predictSummaryHref` test):

```ts
import { describe, expect, it } from 'vitest'
import {
  predictGroupsHref,
  predictSummaryHref,
  resolveSelectedGroup,
} from './predict-routes'

describe('predict routes', () => {
  it('builds the prediction summary href', () => {
    expect(predictSummaryHref()).toBe('/predict/summary')
  })

  it('builds the groups href with no selection', () => {
    expect(predictGroupsHref()).toBe('/predict/groups')
  })

  it('builds the groups href for a group letter', () => {
    expect(predictGroupsHref('C')).toBe('/predict/groups?group=C')
  })

  it('builds the groups href for the thirds tab', () => {
    expect(predictGroupsHref('thirds')).toBe('/predict/groups?group=thirds')
  })
})

describe('resolveSelectedGroup', () => {
  it('accepts a valid group letter as canonical', () => {
    expect(resolveSelectedGroup('F', [])).toEqual({ value: 'F', canonical: true })
  })

  it('accepts the thirds value as canonical', () => {
    expect(resolveSelectedGroup('thirds', [])).toEqual({
      value: 'thirds',
      canonical: true,
    })
  })

  it('falls back to the first incomplete group when the param is missing', () => {
    expect(resolveSelectedGroup(null, ['A', 'B', 'C'])).toEqual({
      value: 'D',
      canonical: false,
    })
  })

  it('falls back to Group A when every group is complete', () => {
    const allGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
    expect(resolveSelectedGroup(undefined, allGroups)).toEqual({
      value: 'A',
      canonical: false,
    })
  })

  it('treats an unknown param as missing and resolves the default', () => {
    expect(resolveSelectedGroup('Z', [])).toEqual({ value: 'A', canonical: false })
    expect(resolveSelectedGroup('', ['A'])).toEqual({ value: 'B', canonical: false })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/navigation/predict-routes.test.ts`
Expected: FAIL — `predictGroupsHref` / `resolveSelectedGroup` are not exported.

- [ ] **Step 3: Implement the helpers**

Replace the contents of `src/lib/navigation/predict-routes.ts` with:

```ts
import { GROUPS } from '@/lib/data/teams'
import type { GroupId } from '@/types'

export type PredictGroupSelection = GroupId | 'thirds'

export interface ResolveSelectedGroupResult {
  value: PredictGroupSelection
  canonical: boolean
}

const VALID_SELECTIONS: ReadonlySet<string> = new Set<string>([
  ...GROUPS,
  'thirds',
])

export function predictSummaryHref(): string {
  return '/predict/summary'
}

export function predictGroupsHref(group?: PredictGroupSelection): string {
  if (!group) return '/predict/groups'
  return `/predict/groups?group=${group}`
}

export function resolveSelectedGroup(
  rawParam: string | null | undefined,
  completedGroups: readonly string[],
): ResolveSelectedGroupResult {
  if (rawParam && VALID_SELECTIONS.has(rawParam)) {
    return { value: rawParam as PredictGroupSelection, canonical: true }
  }

  const completed = new Set(completedGroups)
  const firstIncomplete = GROUPS.find((group) => !completed.has(group))
  return { value: firstIncomplete ?? 'A', canonical: false }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/navigation/predict-routes.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation/predict-routes.ts src/lib/navigation/predict-routes.test.ts
git commit -m "feat: add predictGroupsHref and resolveSelectedGroup helpers"
```

---

## Task 2: Extract `<BestThirdsView />` from the thirds page

Move the entire rendering of the current thirds page into a reusable, route-agnostic component. This is a pure refactor — no behavior change yet. The two route-specific CTAs at the bottom (the `Edit Scores` / `Next: Bracket` desktop block and the mobile sticky bar) are **dropped**, because the parent Groups page will own prev/next navigation in Task 5. The "Complete all group predictions…" card keeps its message but drops its `Go to Group Predictions` button (the user is already on the groups route).

**Files:**
- Create: `src/components/prediction/best-thirds-view.tsx`
- Verify against: `src/app/predict/thirds/page.tsx` (still exists until Task 6)

- [ ] **Step 1: Create the component file**

Create `src/components/prediction/best-thirds-view.tsx` with the full contents below. This is the existing thirds-page body verbatim, minus the bottom CTA blocks and minus the `Go to Group Predictions` button, repackaged as a default-exported component:

```tsx
'use client'

import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { TieBreakerRulesHelp } from '@/components/prediction/tie-breaker-rules-help'
import { cn } from '@/lib/utils'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS } from '@/lib/data/teams'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import type { UnresolvedTie } from '@/lib/standings/calculate-standings'
import {
  determineBestThirdPlaceTeams,
  findQualificationRelevantThirdPlaceTies,
  findUnresolvedThirdPlaceTies,
} from '@/lib/standings/best-third'
import { TeamFlag } from '@/components/team-flag'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

const TIE_GROUP_STYLES = [
  {
    row: 'bg-blue-500/[0.08]',
    stickyBg: 'bg-[color-mix(in_oklch,var(--background),var(--color-blue-500)_16%)]',
    firstCell: 'border-l-2 border-l-blue-400',
    start: 'shadow-[inset_0_1px_0_rgb(96,165,250)]',
    end: 'shadow-[inset_0_-1px_0_rgb(96,165,250)]',
    badge: 'text-blue-200',
  },
  {
    row: 'bg-violet-500/[0.08]',
    stickyBg: 'bg-[color-mix(in_oklch,var(--background),var(--color-violet-500)_16%)]',
    firstCell: 'border-l-2 border-l-violet-400',
    start: 'shadow-[inset_0_1px_0_rgb(167,139,250)]',
    end: 'shadow-[inset_0_-1px_0_rgb(167,139,250)]',
    badge: 'text-violet-200',
  },
  {
    row: 'bg-emerald-500/[0.08]',
    stickyBg: 'bg-[color-mix(in_oklch,var(--background),var(--color-emerald-500)_16%)]',
    firstCell: 'border-l-2 border-l-emerald-400',
    start: 'shadow-[inset_0_1px_0_rgb(52,211,153)]',
    end: 'shadow-[inset_0_-1px_0_rgb(52,211,153)]',
    badge: 'text-emerald-200',
  },
  {
    row: 'bg-rose-500/[0.08]',
    stickyBg: 'bg-[color-mix(in_oklch,var(--background),var(--color-rose-500)_16%)]',
    firstCell: 'border-l-2 border-l-rose-400',
    start: 'shadow-[inset_0_1px_0_rgb(251,113,133)]',
    end: 'shadow-[inset_0_-1px_0_rgb(251,113,133)]',
    badge: 'text-rose-200',
  },
  {
    row: 'bg-cyan-500/[0.08]',
    stickyBg: 'bg-[color-mix(in_oklch,var(--background),var(--color-cyan-500)_16%)]',
    firstCell: 'border-l-2 border-l-cyan-400',
    start: 'shadow-[inset_0_1px_0_rgb(34,211,238)]',
    end: 'shadow-[inset_0_-1px_0_rgb(34,211,238)]',
    badge: 'text-cyan-200',
  },
] as const

function tieCellClass(
  tieStyle: (typeof TIE_GROUP_STYLES)[number] | undefined,
  isTieStart: boolean,
  isTieEnd: boolean,
): string | undefined {
  if (!tieStyle) return undefined
  return cn(
    tieStyle.row,
    isTieStart && tieStyle.start,
    isTieEnd && tieStyle.end,
  )
}

function currentTieOrder(tie: UnresolvedTie, tieBreakResolutions: Record<string, number[]>): number[] {
  const resolution = tieBreakResolutions[tie.key] ?? []
  const tiedTeamIds = new Set(tie.teamIds)
  const selected = resolution.filter((teamId) => tiedTeamIds.has(teamId))
  const missing = tie.teamIds.filter((teamId) => !selected.includes(teamId))
  return [...selected, ...missing]
}

function moveTeam(order: number[], index: number, direction: -1 | 1): number[] {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= order.length) return order

  const next = [...order]
  const [teamId] = next.splice(index, 1)
  next.splice(nextIndex, 0, teamId)
  return next
}

export function BestThirdsView() {
  const {
    groupPredictions,
    tieBreakResolutions,
    setTieBreakResolution,
    completedGroups,
    predictionsLocked,
  } = usePredictions()

  const allStandings = useMemo(() => {
    const standings: Record<string, ReturnType<typeof calculateGroupStandings>> = {}
    for (const group of GROUPS) {
      standings[group] = calculateGroupStandings(group, groupPredictions, { tieBreakResolutions })
    }
    return standings
  }, [groupPredictions, tieBreakResolutions])

  const { allThirdPlaceTeams } = useMemo(
    () => determineBestThirdPlaceTeams(allStandings, { tieBreakResolutions }),
    [allStandings, tieBreakResolutions]
  )

  const unresolvedThirdPlaceTies = useMemo(
    () => findUnresolvedThirdPlaceTies(allStandings),
    [allStandings],
  )
  const qualificationRelevantTieKeys = useMemo(
    () => new Set(findQualificationRelevantThirdPlaceTies(allStandings).map((tie) => tie.key)),
    [allStandings],
  )
  const thirdPlaceTieByTeamId = useMemo(() => {
    const tiesByTeam = new Map<number, UnresolvedTie>()
    for (const tie of unresolvedThirdPlaceTies) {
      for (const teamId of tie.teamIds) {
        tiesByTeam.set(teamId, tie)
      }
    }
    return tiesByTeam
  }, [unresolvedThirdPlaceTies])
  const thirdPlaceTieStyleByKey = useMemo(() => {
    const stylesByKey = new Map<string, (typeof TIE_GROUP_STYLES)[number]>()
    unresolvedThirdPlaceTies.forEach((tie, index) => {
      stylesByKey.set(tie.key, TIE_GROUP_STYLES[index % TIE_GROUP_STYLES.length])
    })
    return stylesByKey
  }, [unresolvedThirdPlaceTies])
  const displayedThirdPlaceTieOrderByKey = useMemo(() => {
    const orderByKey = new Map<string, number[]>()
    for (const entry of allThirdPlaceTeams) {
      const tie = thirdPlaceTieByTeamId.get(entry.standing.team.id)
      if (!tie) continue
      orderByKey.set(tie.key, [...(orderByKey.get(tie.key) ?? []), entry.standing.team.id])
    }
    return orderByKey
  }, [allThirdPlaceTeams, thirdPlaceTieByTeamId])

  const allComplete = completedGroups.length === 12

  return (
    <div className="space-y-6">
      {!allComplete && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-300">
            Complete all group predictions to see accurate standings.
            You have {completedGroups.length}/12 groups complete.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
        <div className="px-4 py-2.5 bg-card/80 border-b border-border/50">
          <h3 className="font-bold text-sm">3rd-Place Ranking</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Top 8 advance to Round of 32</p>
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[160px]" />
              <col className="w-[40px]" />
              <col className="w-[32px]" />
              <col className="w-[32px]" />
              <col className="w-[32px]" />
              <col className="w-[32px]" />
              <col className="hidden sm:table-column sm:w-[32px]" />
              <col className="hidden sm:table-column sm:w-[32px]" />
              <col className="w-[32px]" />
              <col className="w-[36px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground">
                <th className="sticky left-0 z-10 text-left pl-3 pr-2 py-2 bg-card shadow-[2px_0_4px_-1px_rgba(0,0,0,0.4)]">
                  <div className="flex items-center gap-1">
                    <span className="w-5 text-center text-xs">#</span>
                    <span className="text-xs">Team</span>
                  </div>
                </th>
                <th className="text-center text-xs px-0.5 py-2">Grp</th>
                <th className="text-center text-xs px-0.5 py-2">P</th>
                <th className="text-center text-xs px-0.5 py-2">W</th>
                <th className="text-center text-xs px-0.5 py-2">D</th>
                <th className="text-center text-xs px-0.5 py-2">L</th>
                <th className="hidden text-center text-xs px-0.5 py-2 sm:table-cell">GF</th>
                <th className="hidden text-center text-xs px-0.5 py-2 sm:table-cell">GA</th>
                <th className="text-center text-xs px-0.5 py-2">GD</th>
                <th className="text-center text-xs font-bold px-0.5 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {allThirdPlaceTeams.map((entry, index) => {
                const qualifies = index < 8
                const tie = thirdPlaceTieByTeamId.get(entry.standing.team.id)
                const tieOrder = tie
                  ? displayedThirdPlaceTieOrderByKey.get(tie.key) ?? currentTieOrder(tie, tieBreakResolutions)
                  : []
                const tieIndex = tieOrder.indexOf(entry.standing.team.id)
                const isQualificationRelevantTie = !!tie && qualificationRelevantTieKeys.has(tie.key)
                const canMoveTie = isQualificationRelevantTie && !predictionsLocked
                const inTie = isQualificationRelevantTie
                const isTieStart = inTie && tieIndex === 0
                const isTieEnd = inTie && tieIndex === tieOrder.length - 1
                const tieStyle = isQualificationRelevantTie ? thirdPlaceTieStyleByKey.get(tie.key) : undefined
                const rowBg = qualifies
                  ? 'bg-[color-mix(in_oklch,color-mix(in_oklch,var(--background),var(--card)_50%),var(--color-blue-500)_10%)]'
                  : 'bg-[color-mix(in_oklch,var(--background),var(--card)_50%)]'
                return (
                  <tr
                    key={entry.groupId}
                    className={cn(
                      'border-b border-border/20',
                      rowBg,
                    )}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-10 pl-3 pr-2 py-2 overflow-hidden shadow-[2px_0_4px_-1px_rgba(0,0,0,0.4)]',
                        rowBg,
                        tieCellClass(tieStyle, isTieStart, isTieEnd),
                        tieStyle?.stickyBg,
                        tieStyle?.firstCell,
                      )}
                    >
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {qualifies ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 shrink-0">
                            {index + 1}
                          </span>
                        ) : (
                          <span className="w-5 text-center text-xs text-muted-foreground shrink-0">{index + 1}</span>
                        )}
                        <TeamFlag team={entry.standing.team} size={16} />
                        <span className="text-xs font-medium truncate">{entry.standing.team.name}</span>
                        {inTie && (
                          <Badge variant="secondary" className={cn('hidden shrink-0 px-1 text-[9px] sm:inline-flex', tieStyle?.badge)}>
                            tied
                          </Badge>
                        )}
                        {canMoveTie && (
                          <span className="ml-auto flex gap-1">
                            {tieIndex > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                onClick={() => setTieBreakResolution(tie.key, moveTeam(tieOrder, tieIndex, -1))}
                                aria-label={`Move ${entry.standing.team.name} up`}
                              >
                                <ChevronUp />
                              </Button>
                            )}
                            {tieIndex < tieOrder.length - 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                onClick={() => setTieBreakResolution(tie.key, moveTeam(tieOrder, tieIndex, 1))}
                                aria-label={`Move ${entry.standing.team.name} down`}
                              >
                                <ChevronDown />
                              </Button>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn('text-center px-0.5 py-2', tieCellClass(tieStyle, isTieStart, isTieEnd))}>
                      <Badge variant="secondary" className="text-[10px] px-1.5">{entry.groupId}</Badge>
                    </td>
                    <td className={cn('text-center text-xs px-0.5 py-2', tieCellClass(tieStyle, isTieStart, isTieEnd))}>{entry.standing.played}</td>
                    <td className={cn('text-center text-xs px-0.5 py-2', tieCellClass(tieStyle, isTieStart, isTieEnd))}>{entry.standing.won}</td>
                    <td className={cn('text-center text-xs px-0.5 py-2', tieCellClass(tieStyle, isTieStart, isTieEnd))}>{entry.standing.drawn}</td>
                    <td className={cn('text-center text-xs px-0.5 py-2', tieCellClass(tieStyle, isTieStart, isTieEnd))}>{entry.standing.lost}</td>
                    <td className={cn('hidden text-center text-xs px-0.5 py-2 sm:table-cell', tieCellClass(tieStyle, isTieStart, isTieEnd))}>{entry.standing.goalsFor}</td>
                    <td className={cn('hidden text-center text-xs px-0.5 py-2 sm:table-cell', tieCellClass(tieStyle, isTieStart, isTieEnd))}>{entry.standing.goalsAgainst}</td>
                    <td className={cn('text-center text-xs px-0.5 py-2', tieCellClass(tieStyle, isTieStart, isTieEnd))}>
                      {entry.standing.goalDifference > 0 ? '+' : ''}{entry.standing.goalDifference}
                    </td>
                    <td className={cn('text-center text-sm font-bold px-0.5 py-2', tieCellClass(tieStyle, isTieStart, isTieEnd))}>{entry.standing.points}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 border-t border-border/30 flex gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500/40" /> Advances to Round of 32
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted" /> Eliminated
          </span>
        </div>
      </div>
    </div>
  )
}
```

> The "ties around the cutoff" subtitle copy is computed independently in the Groups page in Task 5 (it recomputes `findQualificationRelevantThirdPlaceTies` from standings). `BestThirdsView` stays self-contained and exposes nothing beyond the component.

- [ ] **Step 2: Verify it compiles / lints**

Run: `npx tsc --noEmit` (or rely on the editor's linter via the build). Expected: no type errors referencing `best-thirds-view.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/prediction/best-thirds-view.tsx
git commit -m "refactor: extract BestThirdsView component from thirds page"
```

---

## Task 3: Rewrite the Groups page to be URL-driven with a 3rds tab

Replace the `selectedGroup` `useState` with a selection derived from `?group=`. Selecting a pill (or pressing prev/next) calls `router.push`, creating real history entries. Add the visually separated 3rds pill, conditionally render `<BestThirdsView />`, make the subtitle dynamic, hide the auto-predict button in 3rds mode, and wire prev/next for the new flows.

**Files:**
- Modify: `src/app/predict/groups/page.tsx` (full replacement)

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/app/predict/groups/page.tsx` with:

```tsx
'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GroupMatchCard } from '@/components/prediction/group-match-card'
import { TieBreakResolver } from '@/components/prediction/tie-break-resolver'
import { TieBreakerRulesHelp } from '@/components/prediction/tie-breaker-rules-help'
import { BestThirdsView } from '@/components/prediction/best-thirds-view'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS } from '@/lib/data/teams'
import { getMatchesByGroup } from '@/lib/data/matches'
import { calculateGroupStandings, findUnresolvedGroupTies } from '@/lib/standings/calculate-standings'
import { findQualificationRelevantThirdPlaceTies } from '@/lib/standings/best-third'
import {
  predictGroupsHref,
  resolveSelectedGroup,
  type PredictGroupSelection,
} from '@/lib/navigation/predict-routes'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { TeamFlag } from '@/components/team-flag'
import type { GroupId } from '@/types'

function GroupSelector({
  selection,
  onSelect,
  completedGroups,
}: {
  selection: PredictGroupSelection
  onSelect: (s: PredictGroupSelection) => void
  completedGroups: string[]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -120 : 120, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {GROUPS.map(group => {
          const isComplete = completedGroups.includes(group)
          const isSelected = selection === group
          return (
            <button
              key={group}
              onClick={() => onSelect(group)}
              className={cn(
                'w-9 h-9 rounded-lg text-sm font-bold transition-all shrink-0',
                isSelected && 'bg-primary text-primary-foreground ring-2 ring-primary',
                !isSelected && isComplete && 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30',
                !isSelected && !isComplete && 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/50',
              )}
            >
              {group}
            </button>
          )
        })}

        {/* Best 3rds tab — visually separated from the group pills by a divider
            so it reads as a distinct view, not another group. Stays neutral
            (never emerald) since its tie-breakers can be optional. */}
        <div className="ml-2 pl-2 border-l border-border/50 flex items-center shrink-0">
          <button
            onClick={() => onSelect('thirds')}
            className={cn(
              'h-9 px-3 rounded-lg text-sm font-bold transition-all shrink-0',
              selection === 'thirds'
                ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/50',
            )}
          >
            3rds
          </button>
        </div>
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 flex items-center pr-6 pl-1 transition-opacity duration-200',
          'bg-linear-to-r from-background via-background/80 to-transparent backdrop-blur-sm mask-[linear-gradient(to_right,black_60%,transparent)]',
          canScrollLeft ? 'opacity-100' : 'opacity-0',
        )}
      >
        <button
          onClick={() => scroll('left')}
          aria-label="Scroll groups left"
          tabIndex={canScrollLeft ? 0 : -1}
          className="pointer-events-auto shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-card/80 border border-border/50 text-muted-foreground hover:text-foreground backdrop-blur-md transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end pl-6 pr-1 transition-opacity duration-200',
          'bg-linear-to-l from-background via-background/80 to-transparent backdrop-blur-sm mask-[linear-gradient(to_left,black_60%,transparent)]',
          canScrollRight ? 'opacity-100' : 'opacity-0',
        )}
      >
        <button
          onClick={() => scroll('right')}
          aria-label="Scroll groups right"
          tabIndex={canScrollRight ? 0 : -1}
          className="pointer-events-auto shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-card/80 border border-border/50 text-muted-foreground hover:text-foreground backdrop-blur-md transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function MiniStandings({
  groupId,
  groupPredictions,
  tieBreakResolutions,
}: {
  groupId: string
  groupPredictions: Record<number, { scoreA?: number; scoreB?: number }>
  tieBreakResolutions: Record<string, number[]>
}) {
  const standings = useMemo(
    () => calculateGroupStandings(groupId, groupPredictions, { tieBreakResolutions }),
    [groupId, groupPredictions, tieBreakResolutions]
  )

  return (
    <div className="rounded-lg border border-border/50 bg-card/80 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/30 text-muted-foreground">
            <th className="text-left pl-3 pr-1 py-1.5 font-medium">Group {groupId}</th>
            <th className="w-7 text-center py-1.5 font-medium">P</th>
            <th className="w-7 text-center py-1.5 font-medium">W</th>
            <th className="w-7 text-center py-1.5 font-medium">D</th>
            <th className="w-7 text-center py-1.5 font-medium">L</th>
            <th className="hidden w-7 text-center py-1.5 font-medium sm:table-cell">GF</th>
            <th className="hidden w-7 text-center py-1.5 font-medium sm:table-cell">GA</th>
            <th className="w-7 text-center py-1.5 font-medium">GD</th>
            <th className="w-8 text-center py-1.5 font-bold pr-3">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.team.id} className={cn(
              'border-b border-border/10 last:border-0',
              i < 2 && 'bg-emerald-500/10',
            )}>
              <td className="pl-3 pr-1 py-1">
                <div className="flex items-center gap-1.5">
                  <TeamFlag team={s.team} size={16} />
                  <span className="font-medium truncate max-w-[100px] sm:max-w-none">{s.team.name}</span>
                </div>
              </td>
              <td className="text-center py-1">{s.played}</td>
              <td className="text-center py-1">{s.won}</td>
              <td className="text-center py-1">{s.drawn}</td>
              <td className="text-center py-1">{s.lost}</td>
              <td className="hidden text-center py-1 sm:table-cell">{s.goalsFor}</td>
              <td className="hidden text-center py-1 sm:table-cell">{s.goalsAgainst}</td>
              <td className="text-center py-1">
                {s.goalDifference > 0 ? '+' : ''}{s.goalDifference}
              </td>
              <td className="text-center font-bold py-1 pr-3">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
      setStandingsOffset(navH + stepperH - 2)
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

export default function GroupsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { standingsOffset, sidebarOffset } = useStickyOffsets()
  const {
    groupPredictions,
    tieBreakResolutions,
    setGroupPrediction,
    completedGroups,
    predictionsLocked,
    autofillDemo,
    autofillGroupDemo,
    autofillMatchDemo,
    setTieBreakResolution,
  } = usePredictions()

  const rawGroupParam = searchParams.get('group')
  const { value: selection, canonical } = resolveSelectedGroup(
    rawGroupParam,
    completedGroups,
  )
  const isThirds = selection === 'thirds'

  // On cold load with a missing/invalid param, rewrite the URL once to the
  // canonical selection so refresh and back/forward are stable. Ref-gated so
  // it never re-runs when completedGroups later changes — the URL wins after
  // the first paint.
  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    if (!canonical) {
      router.replace(predictGroupsHref(selection))
    }
  }, [canonical, selection, router])

  const selectGroup = useCallback(
    (next: PredictGroupSelection) => {
      router.push(predictGroupsHref(next))
    },
    [router],
  )

  // Group-mode derived data. When the 3rds tab is active these are computed
  // but not rendered, so we fall back to a valid group letter to keep the
  // helpers happy.
  const activeGroup: GroupId = isThirds ? 'L' : (selection as GroupId)
  const matches = getMatchesByGroup(activeGroup)
  const groupComplete = completedGroups.includes(activeGroup)
  const unresolvedGroupTies = useMemo(
    () => groupComplete ? findUnresolvedGroupTies(activeGroup, groupPredictions) : [],
    [groupComplete, activeGroup, groupPredictions],
  )

  // Subtitle for the 3rds tab switches copy when there are qualification-
  // relevant ties around the top-8 cutoff. Computed only in 3rds mode.
  const thirdsHasCutoffTies = useMemo(() => {
    if (!isThirds) return false
    const allStandings: Record<string, ReturnType<typeof calculateGroupStandings>> = {}
    for (const group of GROUPS) {
      allStandings[group] = calculateGroupStandings(group, groupPredictions, { tieBreakResolutions })
    }
    return findQualificationRelevantThirdPlaceTies(allStandings).length > 0
  }, [isThirds, groupPredictions, tieBreakResolutions])

  // Scroll back to the top whenever the selection changes (group → group,
  // group → 3rds, or via browser back/forward). Skip the first render so the
  // browser's restored scroll position wins on cold loads / refresh.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [selection])

  const groupIndex = GROUPS.indexOf(activeGroup)
  const prevGroup = GROUPS[groupIndex - 1]
  const nextGroup = GROUPS[groupIndex + 1]

  const subtitle = isThirds
    ? thirdsHasCutoffTies
      ? 'The eight best third-place teams advance. Use the arrows to resolve ties around the cutoff.'
      : 'The eight best third-place teams advance to the knockout stage.'
    : 'Predict the score for each of the 72 group matches'

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Group Stage Predictions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {subtitle}
          {isThirds && (
            <TieBreakerRulesHelp type="third-place" variant="standalone" />
          )}
        </p>
        {!predictionsLocked && !isThirds && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => autofillDemo()}
              className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
            >
              <span className="dice-shake">🎲</span> Auto predict all groups
            </button>
          </div>
        )}
      </div>

      <div className="-mx-4 px-4 py-3 border-b border-border/30">
        <GroupSelector
          selection={selection}
          onSelect={selectGroup}
          completedGroups={completedGroups}
        />
      </div>

      {isThirds ? (
        <BestThirdsView />
      ) : (
        <>
          {/* Inline standings on viewports without the right-side sidebar. */}
          <div
            className="md:hidden sticky z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/30 space-y-3"
            style={{ top: standingsOffset }}
          >
            <MiniStandings
              groupId={activeGroup}
              groupPredictions={groupPredictions}
              tieBreakResolutions={tieBreakResolutions}
            />
            {groupComplete && unresolvedGroupTies.length > 0 && (
              <TieBreakResolver
                ties={unresolvedGroupTies}
                tieBreakResolutions={tieBreakResolutions}
                onResolve={setTieBreakResolution}
                disabled={predictionsLocked}
                compact
                collapsible
              />
            )}
          </div>

          <div className="flex gap-6">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">Group {activeGroup}</h2>
                  {groupComplete && (
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs">
                      Complete
                    </Badge>
                  )}
                </div>
                {!predictionsLocked && (
                  <button
                    onClick={() => autofillGroupDemo(activeGroup)}
                    className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
                  >
                    <span className="dice-shake">🎲</span> Auto predict group {activeGroup}
                  </button>
                )}
              </div>

              {matches.map(match => (
                <GroupMatchCard
                  key={match.id}
                  match={match}
                  prediction={groupPredictions[match.id]}
                  onPredictionChange={setGroupPrediction}
                  disabled={predictionsLocked}
                  onAutofill={autofillMatchDemo}
                />
              ))}

              {/* Desktop inline prev/next. At Group L the right button points
                  to the 3rds tab instead of a group. */}
              <div className="hidden sm:flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => prevGroup && selectGroup(prevGroup)}
                  disabled={!prevGroup}
                >
                  &larr; Group {prevGroup ?? ''}
                </Button>
                {nextGroup ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => selectGroup(nextGroup)}
                  >
                    Group {nextGroup} &rarr;
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => selectGroup('thirds')}
                  >
                    3rds &rarr;
                  </Button>
                )}
              </div>
            </div>

            <div className="hidden md:block w-1/3 shrink-0">
              <div className="sticky space-y-3" style={{ top: sidebarOffset }}>
                <MiniStandings
                  groupId={activeGroup}
                  groupPredictions={groupPredictions}
                  tieBreakResolutions={tieBreakResolutions}
                />
                {groupComplete && unresolvedGroupTies.length > 0 && (
                  <TieBreakResolver
                    ties={unresolvedGroupTies}
                    tieBreakResolutions={tieBreakResolutions}
                    onResolve={setTieBreakResolution}
                    disabled={predictionsLocked}
                    compact
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Desktop inline CTAs for the 3rds tab. */}
      {isThirds && (
        <div className="hidden sm:flex gap-2 justify-between items-center">
          <Button variant="outline" size="sm" onClick={() => selectGroup('L')}>
            &larr; Group L
          </Button>
          <Link href="/predict/bracket">
            <Button size="sm">Next: Bracket</Button>
          </Link>
        </div>
      )}

      {/* Mobile-only sticky bottom bar. */}
      <div
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur-sm px-4 pt-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2">
          {isThirds ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => selectGroup('L')}
              >
                &larr; Group L
              </Button>
              <Link href="/predict/bracket" className="flex-1">
                <Button className="w-full">Bracket &rarr;</Button>
              </Link>
            </>
          ) : (
            <>
              {prevGroup && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => selectGroup(prevGroup)}
                >
                  &larr; Group {prevGroup}
                </Button>
              )}
              {nextGroup ? (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => selectGroup(nextGroup)}
                >
                  Group {nextGroup} &rarr;
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={() => selectGroup('thirds')}
                >
                  3rds &rarr;
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors in `groups/page.tsx`. (The old `/predict/thirds` route still exists and still compiles — it's removed in Task 6.)

- [ ] **Step 3: Manually smoke-test in the dev server**

Run: `npm run dev`, then:
- Visit `/predict/groups` → URL rewrites to `?group=<first incomplete or A>`, that pill is selected.
- Click pill `B` → URL becomes `?group=B`, content swaps, page scrolls to top.
- Browser back → returns to the prior selection (no homepage jump), no discard prompt.
- Click `3rds` → URL `?group=thirds`, subtitle swaps, rankings table shows, sidebar gone, auto-predict hidden.
- At Group L, the "next" control reads `3rds →`. In 3rds, controls read `← Group L` and `Bracket →`.

- [ ] **Step 4: Commit**

```bash
git add src/app/predict/groups/page.tsx
git commit -m "feat: drive group selection from search params and add 3rds tab"
```

---

## Task 4: Update the predict layout (stepper, banner, Submit)

Drop Best 3rds from the top stepper, replace the full-width amber band with a quiet inline card inside the content wrapper, and widen the strip Submit rule so submitted users with unsaved edits still see Submit.

**Files:**
- Modify: `src/app/predict/layout.tsx`

- [ ] **Step 1: Remove Best 3rds from the stepper**

In `src/app/predict/layout.tsx`, change the `STEPS` constant from:

```tsx
const STEPS = [
  { href: '/predict/groups', label: 'Groups' },
  { href: '/predict/thirds', label: 'Best 3rds' },
  { href: '/predict/bracket', label: 'Bracket' },
  { href: '/predict/summary', label: 'Summary' },
] as const
```

to:

```tsx
const STEPS = [
  { href: '/predict/groups', label: 'Groups' },
  { href: '/predict/bracket', label: 'Bracket' },
  { href: '/predict/summary', label: 'Summary' },
] as const
```

- [ ] **Step 2: Widen the strip Submit rule**

Change:

```tsx
  const showSubmitInStrip = !submitted && !predictionsLocked
  const showDirtyBanner = isDirty && !predictionsLocked
```

to:

```tsx
  const showSubmitInStrip = hasSomethingToSubmit && !predictionsLocked
  const showDirtyBanner = isDirty && !predictionsLocked
```

(`hasSomethingToSubmit` is already defined just above as `isDirty || !submitted`.)

- [ ] **Step 3: Replace the amber band with a quiet inline card**

Remove this block (the full-width band, which currently sits between the stepper `</div>` and the content wrapper):

```tsx
      {showDirtyBanner && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-amber-500/30 bg-amber-500/10"
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
            <p className="flex-1 text-xs text-amber-300">
              You have unsaved changes.{' '}
              <button
                type="button"
                onClick={() => {
                  discardUnsavedChanges()
                  toast.info('Edits discarded.')
                }}
                className="underline underline-offset-2 hover:text-amber-200 transition-colors"
              >
                Discard
              </button>
            </p>
            <Button
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={submitButtonDisabled}
              className={cn(
                'shrink-0 bg-emerald-600 hover:bg-emerald-700',
                submitButtonDisabled &&
                  'bg-emerald-600/40 hover:bg-emerald-600/40',
              )}
            >
              {submitButtonLabel}
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
```

and replace it with the quiet card living inside the content wrapper, above `{children}`:

```tsx
      <div className="max-w-7xl mx-auto px-4 py-6">
        {showDirtyBanner && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
          >
            <p className="text-sm text-amber-300">
              You have unsaved changes.{' '}
              <button
                type="button"
                onClick={() => {
                  discardUnsavedChanges()
                  toast.info('Edits discarded.')
                }}
                className="underline underline-offset-2 hover:text-amber-200 transition-colors"
              >
                Discard
              </button>
            </p>
          </div>
        )}
        {children}
      </div>
```

- [ ] **Step 4: Type-check and smoke-test**

Run: `npx tsc --noEmit`
Expected: no new errors. `cn` and `Button` are still used (strip Submit), so no unused-import lint.

In `npm run dev`: make an edit → quiet amber card appears above the page H1 (not a full-width band), and the strip shows the Submit button. Submit a complete entry, edit again → strip Submit reappears even though `submitted` is true.

- [ ] **Step 5: Commit**

```bash
git add src/app/predict/layout.tsx
git commit -m "feat: quiet unsaved-changes card and persistent strip submit"
```

---

## Task 5: Delete the thirds route and add the redirect

Remove the now-unused `/predict/thirds` page and add a permanent redirect so old links and bookmarks resolve to the new tab.

**Files:**
- Delete: `src/app/predict/thirds/page.tsx`
- Modify: `next.config.ts`

- [ ] **Step 1: Add the redirect**

In `next.config.ts`, add this entry to the array returned by `redirects()` (place it before the existing `/pools/:slug/predict` rules, order is not significant but keep predict rules together):

```ts
      {
        source: '/predict/thirds',
        destination: '/predict/groups?group=thirds',
        permanent: true,
      },
```

- [ ] **Step 2: Delete the old route file**

Delete `src/app/predict/thirds/page.tsx`. If the `src/app/predict/thirds/` directory is now empty, remove the directory too.

```bash
git rm src/app/predict/thirds/page.tsx
```

- [ ] **Step 3: Audit for lingering `/predict/thirds` references**

Search the codebase (excluding `docs/` and `next.config.ts`):

Run: `rg "predict/thirds" src --glob '!*.test.*'`
Expected: no matches in `src/`. (The redirect in `next.config.ts` is the only intended reference.)

If any component still links to `/predict/thirds`, change it to call the new tab. For example a `<Link href="/predict/thirds">` becomes `<Link href="/predict/groups?group=thirds">`. As of this plan, the known references were in `layout.tsx` (removed in Task 4) and the old groups page (replaced in Task 3), so this search should come back clean.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds, no route at `/predict/thirds`, no type errors.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts
git commit -m "feat: redirect /predict/thirds to the groups 3rds tab and remove the route"
```

---

## Task 6: Final verification pass

Run the full suite, type-check, lint, and the manual regression checklist.

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `predict-routes.test.ts` cases. If a test hardcodes the old 4-step stepper or `/predict/thirds`, update it to match the new 3-step list / redirect.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Watch for unused imports left behind in `groups/page.tsx` (e.g. confirm `Link` is still used by the 3rds Bracket CTAs) and in `layout.tsx`.

- [ ] **Step 3: Manual regression checklist**

In `npm run dev`, verify each:

1. Cold `/predict/groups` → URL becomes `?group=<first incomplete or A>`; matching pill selected.
2. Click pill `B` → `?group=B`, body re-renders, scroll to top, history grows.
3. Browser back → returns to previous selection, no discard prompt.
4. Click `3rds` → `?group=thirds`, subtitle swaps, rankings table shows, sidebar gone, auto-predict hidden.
5. Browser back from 3rds → returns to last group.
6. Visit `/predict/thirds` directly → 308 redirect → lands on `?group=thirds`.
7. Make an edit → quiet amber card appears above the H1 (no full-width band); strip shows Submit.
8. Submit a complete entry, then edit again → strip Submit reappears though `submitted` is true.
9. Mobile bottom bar in 3rds shows `← Group L` and `Bracket →`; Bracket leaves the page.
10. Discard from the card → toast fires, card disappears, strip Submit hides.
11. With unsaved edits, click a link out of the predict flow (e.g. navbar → leaderboard) → discard-confirm dialog still fires.
12. The Bracket stepper conflict badge still appears when R32 teams change without a re-pick.

- [ ] **Step 4: Final commit (if the checklist surfaced fixes)**

```bash
git add -A
git commit -m "test: update predict tests for 3-step stepper and thirds redirect"
```

---

## Self-Review — Spec Coverage

- **3rds becomes a tab, not a page** → Tasks 2 (extract view), 3 (pill + conditional body), 5 (delete route + redirect). ✓
- **Browser back/forward steps through selections** → Task 3 (`router.push` on selection, `useSearchParams` source of truth). ✓
- **Visually separated 3rds pill, never emerald** → Task 3 (`GroupSelector` divider + neutral styling). ✓
- **Single `?group=` param, `thirds` value, legacy redirect** → Tasks 1 (`predictGroupsHref`/`resolveSelectedGroup`), 5 (redirect). ✓
- **Default = first incomplete, fallback A, `replace` on cold load** → Tasks 1 (`resolveSelectedGroup`), 3 (ref-gated `router.replace`). ✓
- **Stepper drops to 3 steps** → Task 4. ✓
- **Dynamic subtitle, shared header, auto-predict hidden in 3rds** → Task 3. ✓
- **Quiet inline alert card (message + Discard only), Submit relocated to strip** → Task 4. ✓
- **Mobile bottom bar + desktop inline prev/next for 3rds** → Task 3. ✓
- **Scroll-to-top re-keyed on selection, first-render skip** → Task 3. ✓
- **No intra-Groups discard prompt** → relies on existing `shouldPromptForUnsavedChangesNavigation` (path-only match); covered by checklist item 3 and 11. ✓

No placeholders remain. Type/name consistency checked: `PredictGroupSelection`, `predictGroupsHref`, `resolveSelectedGroup`, `BestThirdsView`, `selection`, `activeGroup`, `selectGroup` are used consistently across Tasks 1–6.
