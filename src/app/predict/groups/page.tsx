'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GroupMatchCard } from '@/components/prediction/group-match-card'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS, getTeamsByGroup } from '@/lib/data/teams'
import { getMatchesByGroup } from '@/lib/data/matches'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function GroupsPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const { groupPredictions, setGroupPrediction, completedGroups, submitted, autofillDemo, resetPredictions, totalGroupPredictions } = usePredictions()

  const teams = getTeamsByGroup(selectedGroup)
  const matches = getMatchesByGroup(selectedGroup)
  const groupComplete = completedGroups.includes(selectedGroup)
  const allComplete = completedGroups.length === 12

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Group Stage Predictions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Predict the score for each of the 72 group matches
          </p>
        </div>
        <div className="flex gap-2">
          {!submitted && (
            <>
              <Button variant="outline" size="sm" onClick={autofillDemo} className="text-xs">
                Autofill Demo
              </Button>
              {totalGroupPredictions > 0 && (
                <Button variant="ghost" size="sm" onClick={resetPredictions} className="text-xs text-muted-foreground">
                  Reset
                </Button>
              )}
            </>
          )}
          {allComplete && (
            <Link href="/predict/standings">
              <Button>Next: View Standings</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {GROUPS.map(group => {
          const isComplete = completedGroups.includes(group)
          const isSelected = selectedGroup === group
          return (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={cn(
                'w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-sm font-bold transition-all',
                isSelected && 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background',
                !isSelected && isComplete && 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30',
                !isSelected && !isComplete && 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/50',
              )}
            >
              {group}
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">Group {selectedGroup}</h2>
            {groupComplete && (
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs">
                Complete
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {teams.map(team => (
              <div key={team.id} className="flex items-center gap-1 text-xs">
                <span>{team.flag}</span>
                <span className="hidden sm:inline text-muted-foreground">{team.code}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {matches.map(match => (
            <GroupMatchCard
              key={match.id}
              match={match}
              prediction={groupPredictions[match.id]}
              onPredictionChange={setGroupPrediction}
              disabled={submitted}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const idx = GROUPS.indexOf(selectedGroup as any)
              if (idx > 0) setSelectedGroup(GROUPS[idx - 1])
            }}
            disabled={selectedGroup === 'A'}
          >
            Previous Group
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const idx = GROUPS.indexOf(selectedGroup as any)
              if (idx < GROUPS.length - 1) setSelectedGroup(GROUPS[idx + 1])
            }}
            disabled={selectedGroup === 'L'}
          >
            Next Group
          </Button>
        </div>

        {allComplete && (
          <Link href="/predict/standings">
            <Button>Continue to Standings</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
