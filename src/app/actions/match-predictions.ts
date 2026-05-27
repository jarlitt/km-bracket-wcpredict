'use server'

import { createClient } from '@/lib/supabase/server'
import { GROUP_MATCHES } from '@/lib/data/matches'
import { getTeamById } from '@/lib/data/teams'
import { isTournamentLockedAsync } from '@/lib/matches/lock-server'

const KNOCKOUT_POINTS: Record<string, number> = {
  R32: 2,
  R16: 4,
  QF: 6,
  SF: 8,
  '3RD': 5,
  F: 15,
}

function knockoutRoundKey(matchId: string): string {
  if (matchId === '3RD') return '3RD'
  if (matchId === 'F') return 'F'
  return matchId.split('-')[0]
}

function getOutcome(scoreA: number, scoreB: number): 'A' | 'B' | 'D' {
  if (scoreA > scoreB) return 'A'
  if (scoreB > scoreA) return 'B'
  return 'D'
}

export interface GroupUserPrediction {
  userId: string
  displayName: string
  predictedScoreA: number
  predictedScoreB: number
  points: number
  outcomeCorrect: boolean
  exactScore: boolean
}

export interface GroupPredictionsPayload {
  type: 'group'
  matchId: number
  teamAName: string
  teamBName: string
  actualScoreA: number | null
  actualScoreB: number | null
  predictions: GroupUserPrediction[]
}

export interface KnockoutUserPrediction {
  userId: string
  displayName: string
  predictedWinnerName: string
  predictedWinnerId: number
  points: number
  correct: boolean
}

export interface KnockoutPredictionsPayload {
  type: 'knockout'
  matchId: string
  pointsPerWin: number
  actualWinnerId: number | null
  actualWinnerName: string | null
  predictions: KnockoutUserPrediction[]
}

export type MatchPredictionsPayload =
  | GroupPredictionsPayload
  | KnockoutPredictionsPayload
  | null

export async function getMatchPredictions(
  type: 'group' | 'knockout',
  matchId: string | number,
  poolId: string,
): Promise<MatchPredictionsPayload> {
  if (!poolId) return null
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const locked = await isTournamentLockedAsync()

  if (!locked) {
    const membership = await supabase
      .from('pool_members')
      .select('pool_id')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership.data) return null
  }

  const membersRes = await supabase
    .from('pool_members')
    .select('user_id, profile:profiles(display_name)')
    .eq('pool_id', poolId)

  const nameMap = new Map<string, string>()
  for (const row of membersRes.data ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile
    nameMap.set(row.user_id, profile?.display_name ?? 'Unknown')
  }

  if (type === 'group') {
    const numericId = typeof matchId === 'number' ? matchId : Number(matchId)
    const match = GROUP_MATCHES.find((m) => m.id === numericId)
    if (!match) return null

    const [predRes, actualRes] = await Promise.all([
      supabase
        .from('group_predictions')
        .select('user_id, predicted_score_a, predicted_score_b')
        .eq('match_id', numericId)
        .eq('pool_id', poolId),
      supabase
        .from('actual_group_results')
        .select('score_a, score_b')
        .eq('match_id', numericId)
        .maybeSingle(),
    ])

    const actualScoreA = actualRes.data?.score_a ?? null
    const actualScoreB = actualRes.data?.score_b ?? null
    const hasResult = actualScoreA !== null && actualScoreB !== null

    const rawRows = locked
      ? (predRes.data ?? [])
      : (predRes.data ?? []).filter((row) => row.user_id === user.id)

    const predictions: GroupUserPrediction[] = rawRows.map((row) => {
      const ps = row.predicted_score_a as number
      const pb = row.predicted_score_b as number
      let points = 0
      let outcomeCorrect = false
      let exactScore = false

      if (hasResult) {
        const predOutcome = getOutcome(ps, pb)
        const actualOutcome = getOutcome(actualScoreA!, actualScoreB!)
        outcomeCorrect = predOutcome === actualOutcome
        if (outcomeCorrect) {
          points += 3
          if (ps === actualScoreA && pb === actualScoreB) {
            exactScore = true
            points += 2
          }
        }
      }

      return {
        userId: row.user_id,
        displayName: nameMap.get(row.user_id) ?? 'Unknown',
        predictedScoreA: ps,
        predictedScoreB: pb,
        points,
        outcomeCorrect,
        exactScore,
      }
    })

    predictions.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName))

    return {
      type: 'group',
      matchId: numericId,
      teamAName: getTeamById(match.teamAId).name,
      teamBName: getTeamById(match.teamBId).name,
      actualScoreA,
      actualScoreB,
      predictions,
    }
  }

  const koId = String(matchId)
  const roundKey = knockoutRoundKey(koId)
  const pointsPerWin = KNOCKOUT_POINTS[roundKey] ?? 0

  const [predRes, actualRes] = await Promise.all([
    supabase
      .from('knockout_predictions')
      .select('user_id, predicted_winner_id')
      .eq('match_id', koId)
      .eq('pool_id', poolId),
    supabase
      .from('actual_knockout_results')
      .select('winner_id')
      .eq('match_id', koId)
      .maybeSingle(),
  ])

  const actualWinnerId = (actualRes.data?.winner_id as number | undefined) ?? null
  const actualWinnerName = actualWinnerId ? getTeamById(actualWinnerId).name : null

  const koRows = locked
    ? (predRes.data ?? [])
    : (predRes.data ?? []).filter((row) => row.user_id === user.id)

  const predictions: KnockoutUserPrediction[] = koRows.map((row) => {
    const winnerId = row.predicted_winner_id as number
    const correct = actualWinnerId !== null && winnerId === actualWinnerId
    return {
      userId: row.user_id,
      displayName: nameMap.get(row.user_id) ?? 'Unknown',
      predictedWinnerId: winnerId,
      predictedWinnerName: getTeamById(winnerId).name,
      points: correct ? pointsPerWin : 0,
      correct,
    }
  })

  predictions.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName))

  return {
    type: 'knockout',
    matchId: koId,
    pointsPerWin,
    actualWinnerId,
    actualWinnerName,
    predictions,
  }
}
