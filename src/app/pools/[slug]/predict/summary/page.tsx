'use client'

import { useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { GroupStandingsTable } from '@/components/prediction/group-standings-table'
import { BracketView } from '@/components/prediction/bracket-view'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS, getTeamById } from '@/lib/data/teams'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { determineBestThirdPlaceTeams } from '@/lib/standings/best-third'
import { generateKnockoutBracket } from '@/lib/bracket/bracket-structure'
import { applyKnockoutMatchups, resolveKnockoutMatches } from '@/lib/bracket/resolve-bracket'
import Link from 'next/link'
import { TeamFlag } from '@/components/team-flag'

export default function SummaryPage() {
  const { slug } = useParams<{ slug: string }>()
  const basePath = `/pools/${slug}/predict`
  const {
    groupPredictions,
    knockoutPredictions,
    knockoutMatchups,
    tieBreakResolutions,
    submitted,
    predictionsLocked,
    completedGroups,
    totalGroupPredictions,
    totalKnockoutPredictions,
  } = usePredictions()

  const allStandings = useMemo(() => {
    const standings: Record<string, ReturnType<typeof calculateGroupStandings>> = {}
    for (const group of GROUPS) {
      standings[group] = calculateGroupStandings(group, groupPredictions, { tieBreakResolutions })
    }
    return standings
  }, [groupPredictions, tieBreakResolutions])

  const { qualifiedGroups } = useMemo(
    () => determineBestThirdPlaceTeams(allStandings, { tieBreakResolutions }),
    [allStandings, tieBreakResolutions]
  )

  const knockoutMatches = useMemo(
    () => generateKnockoutBracket(allStandings, qualifiedGroups),
    [allStandings, qualifiedGroups]
  )

  const resolvedMatches = useMemo(
    () => resolveKnockoutMatches(knockoutMatches, knockoutPredictions),
    [knockoutMatches, knockoutPredictions],
  )

  const displayedMatches = useMemo(
    () => applyKnockoutMatchups(resolvedMatches, knockoutMatchups),
    [knockoutMatchups, resolvedMatches],
  )

  if (!submitted) {
    const allGroupsComplete = completedGroups.length === 12
    const allKnockoutComplete = totalKnockoutPredictions >= 32

    let nextHref = `${basePath}/groups`
    let nextLabel = 'Start Group Predictions'
    if (allGroupsComplete && allKnockoutComplete) {
      nextHref = `${basePath}/bracket`
      nextLabel = 'Go to Bracket to Submit'
    } else if (allGroupsComplete) {
      nextHref = `${basePath}/bracket`
      nextLabel = 'Continue to Bracket'
    } else if (totalGroupPredictions > 0) {
      nextLabel = 'Continue Group Predictions'
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your prediction summary will appear here once you submit.
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/30 p-8 sm:p-12 text-center space-y-4">
          <div className="text-5xl">📋</div>
          <h2 className="text-lg font-semibold">No predictions submitted yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Complete all 72 group match scores and 32 knockout picks, then submit from the Bracket step to see your full summary here.
          </p>

          <div className="flex items-center justify-center gap-6 pt-2">
            <div className="text-center">
              <div className="text-2xl font-bold">{totalGroupPredictions}/72</div>
              <p className="text-xs text-muted-foreground mt-0.5">Groups</p>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div className="text-center">
              <div className="text-2xl font-bold">{totalKnockoutPredictions}/32</div>
              <p className="text-xs text-muted-foreground mt-0.5">Knockout</p>
            </div>
          </div>

          <div className="pt-2">
            <Link href={nextHref}>
              <Button>{nextLabel}</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const finalPick = knockoutPredictions['F']
  const finalTeam = finalPick ? getTeamById(finalPick) : null
  const thirdPick = knockoutPredictions['3RD']
  const thirdTeam = thirdPick ? getTeamById(thirdPick) : null

  const finalMatch = displayedMatches.find(m => m.id === 'F')
  const runnerUpId = finalMatch && finalPick
    ? (finalMatch.teamAId === finalPick ? finalMatch.teamBId : finalMatch.teamAId)
    : null
  const runnerUp = runnerUpId ? getTeamById(runnerUpId) : null

  const noop = () => {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prediction Summary</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {predictionsLocked
            ? 'Your predictions are locked in. Good luck!'
            : 'Your predictions are submitted. You can edit and resubmit until kickoff.'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <span className="text-2xl">🏆</span>
          <div>
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider font-semibold">Champion</p>
            {finalTeam ? (
              <p className="text-base font-bold text-emerald-300 flex items-center gap-1.5">
                <TeamFlag team={finalTeam} size={22} /> {finalTeam.name}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">-</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Runner-up</p>
            {runnerUp ? (
              <p className="text-sm font-medium flex items-center gap-1.5"><TeamFlag team={runnerUp} size={16} /> {runnerUp.name}</p>
            ) : <p className="text-xs text-muted-foreground">-</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">3rd Place</p>
            {thirdTeam ? (
              <p className="text-sm font-medium flex items-center gap-1.5"><TeamFlag team={thirdTeam} size={16} /> {thirdTeam.name}</p>
            ) : <p className="text-xs text-muted-foreground">-</p>}
          </div>
        </div>

        <div className="flex gap-3 sm:ml-auto">
          <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Groups</p>
            <div className="text-lg font-bold leading-tight">{totalGroupPredictions}/72</div>
            <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 text-[10px]">Complete</Badge>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Knockout</p>
            <div className="text-lg font-bold leading-tight">{totalKnockoutPredictions}/32</div>
            <Badge className="mt-1 bg-emerald-500/20 text-emerald-400 text-[10px]">Complete</Badge>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-bold mb-4">Group Standings</h2>
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
        <h2 className="text-lg font-bold mb-4">Knockout Bracket</h2>
        <BracketView
          matches={displayedMatches}
          predictions={knockoutPredictions}
          onPickWinner={noop}
          disabled
        />
      </div>

      <div className="flex gap-2">
        <Link href={`${basePath}/bracket`}>
          <Button variant="outline" size="sm">View Bracket</Button>
        </Link>
      </div>
    </div>
  )
}
