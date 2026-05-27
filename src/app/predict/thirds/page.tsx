'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
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
import Link from 'next/link'
import { TeamFlag } from '@/components/team-flag'
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

export default function ThirdsPage() {
  const basePath = '/predict'
  const {
    groupPredictions,
    tieBreakResolutions,
    setTieBreakResolution,
    completedGroups,
    predictionsLocked,
    submitted,
    editingSubmission,
  } = usePredictions()
  const readOnlySubmitted = submitted && !editingSubmission

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
      <div>
        <h1 className="text-2xl font-bold">Best 3rds</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The eight best third-place teams advance to the knockout stage. Resolve only best-third ties here.
        </p>
        <div className="flex gap-2 mt-3">
          <Link href={`${basePath}/groups`}>
            <Button variant="outline" size="sm">Edit Scores</Button>
          </Link>
          {allComplete && (
            <Link href={`${basePath}/bracket`}>
              <Button size="sm">Next: Bracket</Button>
            </Link>
          )}
        </div>
      </div>

      {!allComplete && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-300">
            Complete all group predictions to see accurate standings.
            You have {completedGroups.length}/12 groups complete.
          </p>
          <Link href={`${basePath}/groups`}>
            <Button variant="outline" size="sm" className="mt-2">Go to Group Predictions</Button>
          </Link>
        </div>
      )}

      {allComplete && qualificationRelevantTieKeys.size > 0 && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <p className="text-sm text-blue-100">
            {readOnlySubmitted
              ? 'Some third-place teams are tied around the qualification cutoff. Edit your submission to adjust who advances.'
              : 'Some third-place teams are tied around the qualification cutoff. Use the arrows to choose who advances. Bracket slots are assigned from FIFA\u2019s matchup table.'}
          </p>
          <TieBreakerRulesHelp type="third-place" />
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
                const canMoveTie = isQualificationRelevantTie && !predictionsLocked && !readOnlySubmitted
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

      <div className="flex gap-2 justify-between items-center">
        <Link href={`${basePath}/groups`}>
          <Button variant="outline" size="sm">Edit Scores</Button>
        </Link>
        {allComplete && (
          <Link href={`${basePath}/bracket`}>
            <Button size="sm">Next: Bracket</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
