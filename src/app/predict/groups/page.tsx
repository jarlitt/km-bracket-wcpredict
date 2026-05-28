'use client'

import { Suspense, useState, useRef, useEffect, useMemo, useCallback } from 'react'
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

function GroupsPageContent() {
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

export default function GroupsPage() {
  // useSearchParams requires a Suspense boundary so the rest of the tree
  // can still be statically rendered.
  return (
    <Suspense fallback={null}>
      <GroupsPageContent />
    </Suspense>
  )
}
