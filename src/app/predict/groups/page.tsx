'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GroupMatchCard } from '@/components/prediction/group-match-card'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS, getTeamsByGroup } from '@/lib/data/teams'
import { getMatchesByGroup } from '@/lib/data/matches'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

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
}: {
  groupId: string
  groupPredictions: Record<number, { scoreA: number; scoreB: number }>
}) {
  const standings = useMemo(
    () => calculateGroupStandings(groupId, groupPredictions),
    [groupId, groupPredictions]
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
            <th className="w-7 text-center py-1.5 font-medium">GD</th>
            <th className="w-8 text-center py-1.5 font-bold pr-3">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => (
            <tr key={s.team.id} className={cn(
              'border-b border-border/10 last:border-0',
              i < 2 && 'bg-emerald-500/5',
            )}>
              <td className="pl-3 pr-1 py-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{s.team.flag}</span>
                  <span className="font-medium truncate max-w-[100px] sm:max-w-none">{s.team.name}</span>
                </div>
              </td>
              <td className="text-center py-1">{s.played}</td>
              <td className="text-center py-1">{s.won}</td>
              <td className="text-center py-1">{s.drawn}</td>
              <td className="text-center py-1">{s.lost}</td>
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

export default function GroupsPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const { groupPredictions, setGroupPrediction, completedGroups, submitted, totalGroupPredictions, autofillGroupDemo } = usePredictions()

  const matches = getMatchesByGroup(selectedGroup)
  const groupComplete = completedGroups.includes(selectedGroup)
  const allComplete = completedGroups.length === 12

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Group Stage Predictions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Predict the score for each of the 72 group matches
        </p>
        {allComplete && (
          <div className="mt-3">
            <Link href="/predict/standings">
              <Button size="sm">Next: View Standings</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Sticky group selector (+ mini standings on mobile only) */}
      <div className="sticky top-35 z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/30 space-y-3">
        <GroupSelector
          selectedGroup={selectedGroup}
          onSelect={setSelectedGroup}
          completedGroups={completedGroups}
        />
        {/* Mobile-only inline standings */}
        <div className="lg:hidden">
          <MiniStandings groupId={selectedGroup} groupPredictions={groupPredictions} />
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
            {!submitted && (
              <button
                onClick={() => autofillGroupDemo(selectedGroup)}
                className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
              >
                <span className="dice-shake">🎲</span> Auto predict
              </button>
            )}
          </div>

          {matches.map(match => (
            <GroupMatchCard
              key={match.id}
              match={match}
              prediction={groupPredictions[match.id]}
              onPredictionChange={setGroupPrediction}
              disabled={submitted}
            />
          ))}

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center pt-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  const idx = GROUPS.indexOf(selectedGroup as any)
                  if (idx > 0) setSelectedGroup(GROUPS[idx - 1])
                }}
                disabled={selectedGroup === 'A'}
              >
                &larr; Group {GROUPS[GROUPS.indexOf(selectedGroup as any) - 1] ?? ''}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => {
                  const idx = GROUPS.indexOf(selectedGroup as any)
                  if (idx < GROUPS.length - 1) setSelectedGroup(GROUPS[idx + 1])
                }}
                disabled={selectedGroup === 'L'}
              >
                Group {GROUPS[GROUPS.indexOf(selectedGroup as any) + 1] ?? ''} &rarr;
              </Button>
            </div>

            {allComplete && (
              <Link href="/predict/standings" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Continue to Standings</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Right: sticky standings sidebar (desktop only, 1/3 width) */}
        <div className="hidden lg:block w-1/3 shrink-0">
          <div className="sticky top-56">
            <MiniStandings groupId={selectedGroup} groupPredictions={groupPredictions} />
          </div>
        </div>
      </div>
    </div>
  )
}
