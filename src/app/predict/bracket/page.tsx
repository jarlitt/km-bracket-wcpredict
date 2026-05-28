'use client'

import { useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { BracketView } from '@/components/prediction/bracket-view'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS } from '@/lib/data/teams'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { determineBestThirdPlaceTeams } from '@/lib/standings/best-third'
import { generateKnockoutBracket } from '@/lib/bracket/bracket-structure'
import { resolveKnockoutMatches } from '@/lib/bracket/resolve-bracket'
import { predictGroupsHref } from '@/lib/navigation/predict-routes'
import Link from 'next/link'

function BracketPageInner() {
  const basePath = '/predict'
  const {
    groupPredictions,
    knockoutPredictions,
    tieBreakResolutions,
    setKnockoutPrediction,
    completedGroups,
    submitted,
    predictionsLocked,
    totalKnockoutPredictions,
    autofillKnockoutDemo,
    submittedSnapshot,
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

  const highlightChanged = useMemo(() => {
    if (!submittedSnapshot) return undefined
    const baseline = submittedSnapshot.knockoutMatchups
    const changed = new Set<string>()
    for (const match of knockoutMatches) {
      if (match.round !== 'R32') continue
      if (match.id in knockoutPredictions) continue
      const base = baseline[match.id]
      if (!base) continue
      if (base.teamAId !== match.teamAId || base.teamBId !== match.teamBId) {
        changed.add(match.id)
      }
    }
    return changed.size > 0 ? changed : undefined
  }, [knockoutMatches, knockoutPredictions, submittedSnapshot])

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
    <div className="space-y-6 pb-24 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Knockout Bracket</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {predictionsLocked
            ? 'Your predictions are locked. View your summary for details.'
            : `Click on a team to pick the winner. Picks: ${totalKnockoutPredictions}/32`}
        </p>
        {!predictionsLocked && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              type="button"
              onClick={autofillKnockoutDemo}
              className="text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5"
            >
              <span className="dice-shake">🎲</span> Auto predict
            </button>
          </div>
        )}
      </div>

      <BracketView
        matches={resolvedMatches}
        predictions={knockoutPredictions}
        onPickWinner={handlePickWinner}
        disabled={predictionsLocked}
        highlightChanged={highlightChanged}
      />

      {/* Inline bottom CTAs on desktop — duplicated by the mobile sticky bar
          below so we hide the inline version on small screens. */}
      <div className="hidden sm:flex gap-2 justify-between items-center">
        <Link href={predictGroupsHref('thirds')}>
          <Button variant="outline" size="sm">Back to Best 3rds</Button>
        </Link>
        {submitted && (
          <Link href={`${basePath}/summary`}>
            <Button size="sm">View Summary</Button>
          </Link>
        )}
      </div>

      {/* Mobile-only sticky bottom bar with the same CTAs. iOS safe-area
          aware so the buttons clear the home indicator. */}
      <div
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/95 backdrop-blur-sm px-4 pt-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2">
          <Link href={predictGroupsHref('thirds')} className="flex-1">
            <Button variant="outline" className="w-full">&larr; Best 3rds</Button>
          </Link>
          {submitted && (
            <Link href={`${basePath}/summary`} className="flex-1">
              <Button className="w-full">View Summary</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BracketPage() {
  return <BracketPageInner />
}
