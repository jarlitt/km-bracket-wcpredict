'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { GroupStandingsTable } from '@/components/prediction/group-standings-table'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS, getTeamById } from '@/lib/data/teams'
import { getMatchesByGroup } from '@/lib/data/matches'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { determineBestThirdPlaceTeams } from '@/lib/standings/best-third'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ReviewPage() {
  const {
    groupPredictions,
    knockoutPredictions,
    submitted,
    submitPredictions,
    completedGroups,
    totalGroupPredictions,
  } = usePredictions()

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

  const totalKnockoutPicks = Object.keys(knockoutPredictions).length
  const allGroupsComplete = completedGroups.length === 12
  const canSubmit = allGroupsComplete && totalKnockoutPicks >= 31 && !submitted

  const handleSubmit = () => {
    if (!canSubmit) return
    submitPredictions()
    toast.success('Predictions submitted and locked!')
  }

  const finalPick = knockoutPredictions['F']
  const finalTeam = finalPick ? getTeamById(finalPick) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Your Predictions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Double-check everything before submitting. Once submitted, predictions are locked.
        </p>
      </div>

      {submitted && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-emerald-300 font-medium">
            Your predictions have been submitted and locked.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Group Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalGroupPredictions}/72</div>
            {allGroupsComplete ? (
              <Badge className="mt-2 bg-emerald-500/20 text-emerald-400">Complete</Badge>
            ) : (
              <Badge variant="destructive" className="mt-2">Incomplete</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Knockout Picks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalKnockoutPicks}/32</div>
            {totalKnockoutPicks >= 31 ? (
              <Badge className="mt-2 bg-emerald-500/20 text-emerald-400">Complete</Badge>
            ) : (
              <Badge variant="secondary" className="mt-2">In Progress</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Predicted Champion</CardTitle>
          </CardHeader>
          <CardContent>
            {finalTeam ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl">{finalTeam.flag}</span>
                <span className="text-xl font-bold">{finalTeam.name}</span>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">Not yet picked</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-bold mb-4">Group Standings Preview</h2>
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
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-bold mb-4">Knockout Picks Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Object.entries(knockoutPredictions).map(([matchId, winnerId]) => {
            const team = getTeamById(winnerId)
            return (
              <div key={matchId} className="flex items-center gap-2 p-2 rounded-lg bg-card/30 border border-border/30">
                <span className="text-lg">{team.flag}</span>
                <div>
                  <p className="text-xs font-medium">{team.name}</p>
                  <p className="text-[10px] text-muted-foreground">{matchId}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Link href="/predict/groups">
            <Button variant="outline">Edit Groups</Button>
          </Link>
          <Link href="/predict/bracket">
            <Button variant="outline">Edit Bracket</Button>
          </Link>
        </div>

        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={canSubmit ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
        >
          {submitted ? 'Already Submitted' : 'Submit Predictions'}
        </Button>
      </div>
    </div>
  )
}
