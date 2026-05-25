'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Group Standings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generated from your predicted scores. Top 2 + 8 best 3rd-place teams advance.
          </p>
        </div>
        <div className="flex gap-2">
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
        <div className="px-4 py-2.5 bg-card/80 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-bold text-sm">3rd-Place Ranking</h3>
          <span className="text-xs text-muted-foreground">Top 8 advance to Round of 32</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="w-8 text-center text-xs">#</TableHead>
              <TableHead className="text-xs">Team</TableHead>
              <TableHead className="w-14 text-center text-xs">Group</TableHead>
              <TableHead className="w-8 text-center text-xs">P</TableHead>
              <TableHead className="w-8 text-center text-xs">W</TableHead>
              <TableHead className="w-8 text-center text-xs">D</TableHead>
              <TableHead className="w-8 text-center text-xs">L</TableHead>
              <TableHead className="w-10 text-center text-xs">GD</TableHead>
              <TableHead className="w-10 text-center text-xs">GF</TableHead>
              <TableHead className="w-10 text-center text-xs font-bold">Pts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allThirdPlaceTeams.map((entry, index) => {
              const qualifies = index < 8
              return (
                <TableRow
                  key={entry.groupId}
                  className={cn(
                    'border-border/20',
                    qualifies && 'bg-blue-500/5',
                  )}
                >
                  <TableCell className="text-center text-xs font-medium">
                    {qualifies ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">
                        {index + 1}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{index + 1}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{entry.standing.team.flag}</span>
                      <span className="text-xs sm:text-sm font-medium">{entry.standing.team.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-[10px] px-1.5">{entry.groupId}</Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs">{entry.standing.played}</TableCell>
                  <TableCell className="text-center text-xs">{entry.standing.won}</TableCell>
                  <TableCell className="text-center text-xs">{entry.standing.drawn}</TableCell>
                  <TableCell className="text-center text-xs">{entry.standing.lost}</TableCell>
                  <TableCell className="text-center text-xs">
                    {entry.standing.goalDifference > 0 ? '+' : ''}{entry.standing.goalDifference}
                  </TableCell>
                  <TableCell className="text-center text-xs">{entry.standing.goalsFor}</TableCell>
                  <TableCell className="text-center text-sm font-bold">{entry.standing.points}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div className="px-4 py-2 border-t border-border/30 flex gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500/40" /> Advances to Round of 32
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted" /> Eliminated
          </span>
        </div>
      </div>

      {allComplete && (
        <div className="flex justify-end">
          <Link href="/predict/bracket">
            <Button size="lg">Continue to Knockout Bracket</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
