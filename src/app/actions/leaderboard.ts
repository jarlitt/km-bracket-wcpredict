'use server'

import { createClient } from '@/lib/supabase/server'
import { syncResultsIfStale } from '@/lib/sync/sync-results'

export interface LeaderboardEntry {
  userId: string
  displayName: string
  totalScore: number
  groupMatchPoints: number
  exactScoreBonus: number
  groupPositionPoints: number
  knockoutPoints: number
  rank: number
}

interface MemberRow {
  user_id: string
  profile: { display_name: string } | { display_name: string }[] | null
}

interface ScoreRow {
  user_id: string
  total_score: number
  group_match_points: number
  exact_score_bonus: number
  group_position_points: number
  knockout_points: number
}

export async function getLeaderboard(poolId: string): Promise<LeaderboardEntry[]> {
  if (!poolId) return []

  await syncResultsIfStale()

  const supabase = await createClient()

  const [membersRes, scoresRes] = await Promise.all([
    supabase
      .from('pool_members')
      .select('user_id, profile:profiles(display_name)')
      .eq('pool_id', poolId),
    supabase
      .from('user_scores')
      .select(
        'user_id, total_score, group_match_points, exact_score_bonus, group_position_points, knockout_points',
      )
      .eq('pool_id', poolId),
  ])

  const members = (membersRes.data as MemberRow[] | null) ?? []
  if (members.length === 0) return []

  const scoreMap = new Map<string, ScoreRow>()
  for (const s of (scoresRes.data as ScoreRow[] | null) ?? []) {
    scoreMap.set(s.user_id, s)
  }

  const entries = members.map((m) => {
    const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile
    const s = scoreMap.get(m.user_id)
    return {
      userId: m.user_id,
      displayName: profile?.display_name ?? 'Unknown',
      totalScore: s?.total_score ?? 0,
      groupMatchPoints: s?.group_match_points ?? 0,
      exactScoreBonus: s?.exact_score_bonus ?? 0,
      groupPositionPoints: s?.group_position_points ?? 0,
      knockoutPoints: s?.knockout_points ?? 0,
    }
  })

  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    return a.displayName.localeCompare(b.displayName)
  })

  return entries.map((entry, i) => ({ ...entry, rank: i + 1 }))
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}
