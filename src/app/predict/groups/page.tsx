'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GroupMatchCard } from '@/components/prediction/group-match-card'
import { TieBreakResolver } from '@/components/prediction/tie-break-resolver'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS } from '@/lib/data/teams'
import { getMatchesByGroup } from '@/lib/data/matches'
import { calculateGroupStandings, findUnresolvedGroupTies } from '@/lib/standings/calculate-standings'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { TeamFlag } from '@/components/team-flag'
import type { GroupId } from '@/types'

function GroupSelector({
  selectedGroup,
  onSelect,
  completedGroups,
}: {
  selectedGroup: string
  onSelect: (g: string) => void
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
    <div className="relative flex items-center gap-1">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-card border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {GROUPS.map(group => {
          const isComplete = completedGroups.includes(group)
          const isSelected = selectedGroup === group
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
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-card border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
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
  const groupSelectorRef = useRef<HTMLDivElement>(null)
  const [stepperOffset, setStepperOffset] = useState(0)
  const [sidebarOffset, setSidebarOffset] = useState(0)

  useEffect(() => {
    const navbar = document.querySelector('header')
    const stepper = document.getElementById('predict-stepper')
    const groupSelector = groupSelectorRef.current
    if (!navbar || !stepper) return

    const measure = () => {
      const base = navbar.offsetHeight + stepper.offsetHeight
      setStepperOffset(base)
      setSidebarOffset(base + (groupSelector?.offsetHeight ?? 0))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(navbar)
    ro.observe(stepper)
    if (groupSelector) ro.observe(groupSelector)
    return () => ro.disconnect()
  }, [])

  return { groupSelectorRef, stepperOffset, sidebarOffset }
}

export default function GroupsPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const { groupSelectorRef, stepperOffset, sidebarOffset } = useStickyOffsets()
  const {
    groupPredictions,
    tieBreakResolutions,
    setGroupPrediction,
    completedGroups,
    submitted,
    predictionsLocked,
    editingSubmission,
    autofillDemo,
    autofillGroupDemo,
    setTieBreakResolution,
  } = usePredictions()
  const readOnlySubmitted = submitted && !editingSubmission

  const matches = getMatchesByGroup(selectedGroup)
  const groupComplete = completedGroups.includes(selectedGroup)
  const allComplete = completedGroups.length === 12
  const unresolvedGroupTies = useMemo(
    () => groupComplete ? findUnresolvedGroupTies(selectedGroup, groupPredictions) : [],
    [groupComplete, selectedGroup, groupPredictions],
  )

  // When the user moves to a different group (via the mobile bottom bar, the
  // inline prev/next, or the pill selector), jump back to the top so they see
  // the new group's first match instead of staying scrolled to the bottom.
  // Skip the very first render so we don't fight the browser's restored
  // scroll position when navigating into the page.
  const isFirstGroupRender = useRef(true)
  useEffect(() => {
    if (isFirstGroupRender.current) {
      isFirstGroupRender.current = false
      return
    }
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [selectedGroup])

  const prevGroup = GROUPS[GROUPS.indexOf(selectedGroup as GroupId) - 1]
  const nextGroup = GROUPS[GROUPS.indexOf(selectedGroup as GroupId) + 1]

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Group Stage Predictions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Predict the score for each of the 72 group matches
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {allComplete && (
            <Link href="/predict/thirds">
              <Button size="sm">Next: Best 3rds</Button>
            </Link>
          )}
          {!predictionsLocked && !readOnlySubmitted && (
            <button
              onClick={() => autofillDemo()}
              className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
            >
              <span className="dice-shake">🎲</span> Auto predict all groups
            </button>
          )}
        </div>
      </div>

      {/* Group selector (+ mini standings on mobile only). Sticky on
          tablet/desktop only — `static` ignores the inline `top` so it scrolls
          naturally on mobile. */}
      <div
        ref={groupSelectorRef}
        className="static sm:sticky z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/30 space-y-3"
        style={{ top: stepperOffset }}
      >
        <GroupSelector
          selectedGroup={selectedGroup}
          onSelect={setSelectedGroup}
          completedGroups={completedGroups}
        />
        {/* Mobile-only inline standings */}
        <div className="lg:hidden">
          <MiniStandings
            groupId={selectedGroup}
            groupPredictions={groupPredictions}
            tieBreakResolutions={tieBreakResolutions}
          />
          {groupComplete && unresolvedGroupTies.length > 0 && (
            <div className="mt-3">
              <TieBreakResolver
                ties={unresolvedGroupTies}
                tieBreakResolutions={tieBreakResolutions}
                onResolve={setTieBreakResolution}
                disabled={predictionsLocked || readOnlySubmitted}
                compact
                collapsible
              />
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="flex gap-6">
        {/* Left: match cards (3/4 on desktop) */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">Group {selectedGroup}</h2>
              {groupComplete && (
                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs">
                  Complete
                </Badge>
              )}
            </div>
            {!predictionsLocked && !readOnlySubmitted && (
              <button
                onClick={() => autofillGroupDemo(selectedGroup)}
                className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
              >
                <span className="dice-shake">🎲</span> Auto predict group {selectedGroup}
              </button>
            )}
          </div>

          {matches.map(match => (
            <GroupMatchCard
              key={match.id}
              match={match}
              prediction={groupPredictions[match.id]}
              onPredictionChange={setGroupPrediction}
              disabled={predictionsLocked || readOnlySubmitted}
            />
          ))}

          {/* Inline prev/next is duplicated by the mobile bottom bar — hide
              the inline buttons on mobile to avoid two sets of controls. */}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center pt-2">
            <div className="hidden sm:flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  const idx = GROUPS.indexOf(selectedGroup as GroupId)
                  if (idx > 0) setSelectedGroup(GROUPS[idx - 1])
                }}
                disabled={selectedGroup === 'A'}
              >
                &larr; Group {GROUPS[GROUPS.indexOf(selectedGroup as GroupId) - 1] ?? ''}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  const idx = GROUPS.indexOf(selectedGroup as GroupId)
                  if (idx < GROUPS.length - 1) setSelectedGroup(GROUPS[idx + 1])
                }}
                disabled={selectedGroup === 'L'}
              >
                Group {GROUPS[GROUPS.indexOf(selectedGroup as GroupId) + 1] ?? ''} &rarr;
              </Button>
            </div>

            {allComplete && (
              <Link href="/predict/thirds" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Continue to Best 3rds</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Right: sticky standings sidebar (desktop only, 1/3 width) */}
        <div className="hidden lg:block w-1/3 shrink-0">
          <div className="sticky space-y-3" style={{ top: sidebarOffset }}>
            <MiniStandings
              groupId={selectedGroup}
              groupPredictions={groupPredictions}
              tieBreakResolutions={tieBreakResolutions}
            />
            {groupComplete && unresolvedGroupTies.length > 0 && (
              <TieBreakResolver
                ties={unresolvedGroupTies}
                tieBreakResolutions={tieBreakResolutions}
                onResolve={setTieBreakResolution}
                disabled={predictionsLocked || readOnlySubmitted}
                compact
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile-only sticky bottom bar with prev/next group nav. iOS safe-area
          aware so the buttons clear the home indicator. */}
      <div
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur-sm px-4 pt-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              if (prevGroup) setSelectedGroup(prevGroup)
            }}
            disabled={!prevGroup}
          >
            &larr; Group {prevGroup ?? ''}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              if (nextGroup) setSelectedGroup(nextGroup)
            }}
            disabled={!nextGroup}
          >
            Group {nextGroup ?? ''} &rarr;
          </Button>
        </div>
      </div>
    </div>
  )
}
