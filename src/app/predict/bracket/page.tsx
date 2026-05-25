'use client'

import { useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { BracketView } from '@/components/prediction/bracket-view'
import { usePredictions } from '@/context/predictions-context'
import { GROUPS } from '@/lib/data/teams'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { determineBestThirdPlaceTeams } from '@/lib/standings/best-third'
import { generateKnockoutBracket } from '@/lib/bracket/bracket-structure'
import type { KnockoutMatch } from '@/types'
import Link from 'next/link'

export default function BracketPage() {
  const {
    groupPredictions,
    knockoutPredictions,
    setKnockoutPrediction,
    completedGroups,
    submitted,
    totalKnockoutPredictions,
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

  const knockoutMatches = useMemo(
    () => generateKnockoutBracket(allStandings, qualifiedGroups),
    [allStandings, qualifiedGroups]
  )

  const resolvedMatches = useMemo(() => {
    const matchMap = new Map<string, KnockoutMatch>()
    knockoutMatches.forEach(m => matchMap.set(m.id, { ...m }))

    const bracketTree: Record<string, { teamASource: string; teamBSource: string }> = {
      'R16-1': { teamASource: 'R32-1', teamBSource: 'R32-2' },
      'R16-2': { teamASource: 'R32-3', teamBSource: 'R32-4' },
      'R16-3': { teamASource: 'R32-5', teamBSource: 'R32-6' },
      'R16-4': { teamASource: 'R32-7', teamBSource: 'R32-8' },
      'R16-5': { teamASource: 'R32-9', teamBSource: 'R32-10' },
      'R16-6': { teamASource: 'R32-11', teamBSource: 'R32-12' },
      'R16-7': { teamASource: 'R32-13', teamBSource: 'R32-14' },
      'R16-8': { teamASource: 'R32-15', teamBSource: 'R32-16' },
      'QF-1': { teamASource: 'R16-1', teamBSource: 'R16-2' },
      'QF-2': { teamASource: 'R16-3', teamBSource: 'R16-4' },
      'QF-3': { teamASource: 'R16-5', teamBSource: 'R16-6' },
      'QF-4': { teamASource: 'R16-7', teamBSource: 'R16-8' },
      'SF-1': { teamASource: 'QF-1', teamBSource: 'QF-2' },
      'SF-2': { teamASource: 'QF-3', teamBSource: 'QF-4' },
      F: { teamASource: 'SF-1', teamBSource: 'SF-2' },
      '3RD': { teamASource: 'SF-1', teamBSource: 'SF-2' },
    }

    const getWinner = (matchId: string): number | null => knockoutPredictions[matchId] ?? null
    const getLoser = (matchId: string): number | null => {
      const match = matchMap.get(matchId)
      const winner = getWinner(matchId)
      if (!match || !winner) return null
      return winner === match.teamAId ? match.teamBId : match.teamAId
    }

    for (const [matchId, sources] of Object.entries(bracketTree)) {
      const match = matchMap.get(matchId)
      if (!match) continue

      if (matchId === '3RD') {
        match.teamAId = getLoser(sources.teamASource)
        match.teamBId = getLoser(sources.teamBSource)
      } else {
        match.teamAId = getWinner(sources.teamASource) ?? match.teamAId
        match.teamBId = getWinner(sources.teamBSource) ?? match.teamBId
      }
    }

    return Array.from(matchMap.values())
  }, [knockoutMatches, knockoutPredictions])

  const handlePickWinner = useCallback((matchId: string, winnerId: number) => {
    setKnockoutPrediction(matchId, winnerId)
  }, [setKnockoutPrediction])

  const allComplete = completedGroups.length === 12

  if (!allComplete) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Knockout Bracket</h1>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <p className="text-amber-300 mb-4">
            Complete all group predictions first to generate your bracket.
          </p>
          <Link href="/predict/groups">
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
          Click on a team to pick the winner. Picks: {totalKnockoutPredictions}/32
        </p>
        <div className="flex gap-2 mt-3">
          <Link href="/predict/standings">
            <Button variant="outline" size="sm">Back to Standings</Button>
          </Link>
          <Link href="/predict/review">
            <Button size="sm">Review & Submit</Button>
          </Link>
        </div>
      </div>

      <BracketView
        matches={resolvedMatches}
        predictions={knockoutPredictions}
        onPickWinner={handlePickWinner}
        disabled={submitted}
      />

      <div className="flex justify-end">
        <Link href="/predict/review">
          <Button size="lg">Review & Submit</Button>
        </Link>
      </div>
    </div>
  )
}
