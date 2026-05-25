'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GroupStandingsTable } from '@/components/prediction/group-standings-table'
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

  const { qualifiedGroups } = useMemo(
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

      <div className="rounded-xl border border-border/50 bg-card/30 p-4">
        <h3 className="font-bold text-sm mb-3">Advancement Summary</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500/40" />
            <span className="text-muted-foreground">Top 2 per group (24 teams)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500/40" />
            <span className="text-muted-foreground">
              Best 3rd-place ({qualifiedGroups.length}/8):
              {qualifiedGroups.length > 0 && (
                <span className="ml-1 text-blue-400">
                  {qualifiedGroups.map(g => `Group ${g}`).join(', ')}
                </span>
              )}
            </span>
          </div>
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
