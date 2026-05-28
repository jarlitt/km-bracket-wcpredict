'use client'

import { useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { BracketView } from '@/components/prediction/bracket-view'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS } from '@/lib/data/teams'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { determineBestThirdPlaceTeams } from '@/lib/standings/best-third'
import { generateKnockoutBracket } from '@/lib/bracket/bracket-structure'
import {
  applyKnockoutMatchups,
  resolveKnockoutMatches,
} from '@/lib/bracket/resolve-bracket'
import Link from 'next/link'

function BracketPageInner() {
  const basePath = '/predict'
  const {
    groupPredictions,
    knockoutPredictions,
    knockoutMatchups,
    tieBreakResolutions,
    setKnockoutPrediction,
    completedGroups,
    submitted,
    predictionsLocked,
    totalKnockoutPredictions,
    autofillKnockoutDemo,
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

  const handlePickWinner = useCallback((matchId: string, winnerId: number) => {
    setKnockoutPrediction(matchId, winnerId)
  }, [setKnockoutPrediction])

  const allGroupsComplete = completedGroups.length === 12

  const displayedMatches = useMemo(() => {
    if (!submitted) return resolvedMatches
    return applyKnockoutMatchups(resolvedMatches, knockoutMatchups)
  }, [knockoutMatchups, submitted, resolvedMatches])

  if (!allGroupsComplete) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Knockout Bracket</h1>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <p className="text-amber-300 mb-4">
            Complete all group predictions first to generate your bracket.
          </p>
          <Link href={`${basePath}/groups`}>
            <Button>Go to Group Predictions</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knockout Bracket</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {predictionsLocked
            ? 'Your predictions are locked. View your summary for details.'
            : `Click on a team to pick the winner. Picks: ${totalKnockoutPredictions}/32`}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Link href={`${basePath}/thirds`}>
            <Button variant="outline" size="sm">Back to Best 3rds</Button>
          </Link>
          {submitted && (
            <Link href={`${basePath}/summary`}>
              <Button size="sm">View Summary</Button>
            </Link>
          )}
          {!predictionsLocked && (
            <button
              type="button"
              onClick={autofillKnockoutDemo}
              className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
            >
              <span className="dice-shake">🎲</span> Auto predict
            </button>
          )}
        </div>
      </div>

      <BracketView
        matches={displayedMatches}
        predictions={knockoutPredictions}
        onPickWinner={handlePickWinner}
        disabled={predictionsLocked}
      />

      <div className="flex gap-2 justify-between items-center">
        <Link href={`${basePath}/thirds`}>
          <Button variant="outline" size="sm">Back to Best 3rds</Button>
        </Link>
        {submitted && (
          <Link href={`${basePath}/summary`}>
            <Button size="sm">View Summary</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

export default function BracketPage() {
  return <BracketPageInner />
}
