'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GroupStandingsTable } from '@/components/prediction/group-standings-table'
import { cn } from '@/lib/utils'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS } from '@/lib/data/teams'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { determineBestThirdPlaceTeams } from '@/lib/standings/best-third'
import Link from 'next/link'

export default function StandingsPage() {
  const { groupPredictions, completedGroups } = usePredictions()

  const allStandings = useMemo(() => {
    const standings: Record<string, ReturnType<typeof calculateGroupStandings>> = {}
    for (const group of GROUPS) {
      standings[group] = calculateGroupStandings(group, groupPredictions)
    }
    return standings
  }, [groupPredictions])

  const { qualifiedGroups, thirdPlaceTeams, allThirdPlaceTeams } = useMemo(
    () => determineBestThirdPlaceTeams(allStandings),
    [allStandings]
  )

  const allComplete = completedGroups.length === 12

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Group Standings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          These standings are auto-generated from your predicted scores — for your review only. Top 2 + 8 best 3rd-place teams advance to the knockout stage.
        </p>
        <div className="flex gap-2 mt-3">
          <Link href="/predict/groups">
            <Button variant="outline" size="sm">Edit Scores</Button>
          </Link>
          {allComplete && (
            <Link href="/predict/bracket">
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
          <Link href="/predict/groups">
            <Button variant="outline" size="sm" className="mt-2">Go to Group Predictions</Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {GROUPS.map(group => (
          <GroupStandingsTable
            key={group}
            groupId={group}
            standings={allStandings[group]}
            qualifiedThirdGroups={qualifiedGroups}
          />
        ))}
      </div>

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
              <col className="w-[32px]" />
              <col className="w-[32px]" />
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
                <th className="text-center text-xs px-0.5 py-2">GF</th>
                <th className="text-center text-xs px-0.5 py-2">GA</th>
                <th className="text-center text-xs px-0.5 py-2">GD</th>
                <th className="text-center text-xs font-bold px-0.5 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {allThirdPlaceTeams.map((entry, index) => {
                const qualifies = index < 8
                return (
                  <tr
                    key={entry.groupId}
                    className={cn(
                      'border-b border-border/20',
                      qualifies && 'bg-blue-500/5',
                    )}
                  >
                    <td className="sticky left-0 z-10 pl-3 pr-2 py-2 overflow-hidden bg-card shadow-[2px_0_4px_-1px_rgba(0,0,0,0.4)]">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {qualifies ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 shrink-0">
                            {index + 1}
                          </span>
                        ) : (
                          <span className="w-5 text-center text-xs text-muted-foreground shrink-0">{index + 1}</span>
                        )}
                        <span className="text-base shrink-0">{entry.standing.team.flag}</span>
                        <span className="text-xs font-medium truncate">{entry.standing.team.name}</span>
                      </div>
                    </td>
                    <td className="text-center px-0.5 py-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5">{entry.groupId}</Badge>
                    </td>
                    <td className="text-center text-xs px-0.5 py-2">{entry.standing.played}</td>
                    <td className="text-center text-xs px-0.5 py-2">{entry.standing.won}</td>
                    <td className="text-center text-xs px-0.5 py-2">{entry.standing.drawn}</td>
                    <td className="text-center text-xs px-0.5 py-2">{entry.standing.lost}</td>
                    <td className="text-center text-xs px-0.5 py-2">{entry.standing.goalsFor}</td>
                    <td className="text-center text-xs px-0.5 py-2">{entry.standing.goalsAgainst}</td>
                    <td className="text-center text-xs px-0.5 py-2">
                      {entry.standing.goalDifference > 0 ? '+' : ''}{entry.standing.goalDifference}
                    </td>
                    <td className="text-center text-sm font-bold px-0.5 py-2">{entry.standing.points}</td>
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
        <Link href="/predict/groups">
          <Button variant="outline" size="sm">Edit Scores</Button>
        </Link>
        {allComplete && (
          <Link href="/predict/bracket">
            <Button size="sm">Next: Bracket</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
