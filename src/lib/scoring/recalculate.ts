import { createAdminClient } from '@/lib/supabase/admin'
import { calculateScore } from './calculate-score'
import { calculateGroupStandings } from '@/lib/standings/calculate-standings'
import { GROUPS } from '@/lib/data/teams'
import type { UserPredictions, TeamStanding } from '@/types'

/**
 * Recalculates scores for every submitted (pool, user) pair.
 *
 * Reads actual results from DB, runs each pool submission through the scoring
 * engine, and writes one row per (pool_id, user_id) into user_scores.
 */
export async function recalculateAllScores() {
  const supabase = createAdminClient()

  const [groupResultsRes, knockoutResultsRes, submissionsRes] = await Promise.all([
    supabase.from('actual_group_results').select('*'),
    supabase.from('actual_knockout_results').select('*'),
    supabase.from('submissions').select('pool_id, user_id'),
  ])

  const groupResults: Record<number, { scoreA: number; scoreB: number }> = {}
  for (const row of groupResultsRes.data ?? []) {
    groupResults[row.match_id] = { scoreA: row.score_a, scoreB: row.score_b }
  }

  const knockoutResults: Record<string, number> = {}
  for (const row of knockoutResultsRes.data ?? []) {
    knockoutResults[row.match_id] = row.winner_id
  }

  if (
    Object.keys(groupResults).length === 0 &&
    Object.keys(knockoutResults).length === 0
  ) {
    return { usersScored: 0, message: 'No results to score against' }
  }

  const actualGroupStandings: Record<string, TeamStanding[]> = {}
  for (const groupId of GROUPS) {
    actualGroupStandings[groupId] = calculateGroupStandings(groupId, groupResults)
  }

  const submissions = (submissionsRes.data ?? []) as Array<{ pool_id: string; user_id: string }>
  if (submissions.length === 0) {
    return { usersScored: 0, message: 'No submitted users' }
  }

  let usersScored = 0

  for (const { pool_id, user_id } of submissions) {
    const [userGroupRes, userKnockoutRes] = await Promise.all([
      supabase
        .from('group_predictions')
        .select('match_id, predicted_score_a, predicted_score_b')
        .eq('user_id', user_id)
        .eq('pool_id', pool_id),
      supabase
        .from('knockout_predictions')
        .select('match_id, predicted_winner_id')
        .eq('user_id', user_id)
        .eq('pool_id', pool_id),
    ])

    const userGroupPreds: Record<number, { scoreA: number; scoreB: number }> = {}
    for (const row of userGroupRes.data ?? []) {
      userGroupPreds[row.match_id] = {
        scoreA: row.predicted_score_a,
        scoreB: row.predicted_score_b,
      }
    }

    const userKnockoutPreds: Record<string, number> = {}
    for (const row of userKnockoutRes.data ?? []) {
      userKnockoutPreds[row.match_id] = row.predicted_winner_id
    }

    const predictions: UserPredictions = {
      groupPredictions: userGroupPreds,
      knockoutPredictions: userKnockoutPreds,
      submitted: true,
    }

    const score = calculateScore(predictions, {
      groupResults,
      knockoutResults,
      actualGroupStandings,
    })

    const { error } = await supabase.from('user_scores').upsert(
      {
        pool_id,
        user_id,
        total_score: score.total,
        group_match_points: score.groupMatchPoints,
        exact_score_bonus: score.exactScoreBonus,
        group_position_points: score.groupPositionPoints,
        knockout_points: score.knockoutPoints,
        score_breakdown: score.details,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pool_id,user_id' },
    )

    if (error) {
      console.error(
        `Failed to update score for pool=${pool_id} user=${user_id}:`,
        error.message,
      )
    } else {
      usersScored++
    }
  }

  return { usersScored }
}
