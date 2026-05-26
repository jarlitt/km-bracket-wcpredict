'use server'

import { createClient } from '@/lib/supabase/server'

interface GroupPrediction {
  matchId: number
  scoreA: number
  scoreB: number
}

interface KnockoutPrediction {
  matchId: string
  winnerId: number
}

interface SubmitResult {
  success: boolean
  error?: string
}

interface LoadResult {
  groupPredictions: Record<number, { scoreA: number; scoreB: number }>
  knockoutPredictions: Record<string, number>
  submitted: boolean
}

export async function loadPredictions(): Promise<LoadResult | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [groupRes, knockoutRes, submissionRes] = await Promise.all([
    supabase
      .from('group_predictions')
      .select('match_id, predicted_score_a, predicted_score_b')
      .eq('user_id', user.id),
    supabase
      .from('knockout_predictions')
      .select('match_id, predicted_winner_id')
      .eq('user_id', user.id),
    supabase
      .from('submissions')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const groupPredictions: Record<number, { scoreA: number; scoreB: number }> = {}
  if (groupRes.data) {
    for (const row of groupRes.data) {
      groupPredictions[row.match_id] = {
        scoreA: row.predicted_score_a,
        scoreB: row.predicted_score_b,
      }
    }
  }

  const knockoutPredictions: Record<string, number> = {}
  if (knockoutRes.data) {
    for (const row of knockoutRes.data) {
      knockoutPredictions[row.match_id] = row.predicted_winner_id
    }
  }

  return {
    groupPredictions,
    knockoutPredictions,
    submitted: !!submissionRes.data,
  }
}

export async function submitPredictionsToDb(
  groupPredictions: Record<number, { scoreA: number; scoreB: number }>,
  knockoutPredictions: Record<string, number>
): Promise<SubmitResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const existingSub = await supabase
    .from('submissions')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingSub.data) {
    return { success: false, error: 'Predictions already submitted' }
  }

  const groupRows: GroupPrediction[] = Object.entries(groupPredictions).map(
    ([matchId, { scoreA, scoreB }]) => ({
      matchId: Number(matchId),
      scoreA,
      scoreB,
    })
  )

  if (groupRows.length !== 72) {
    return { success: false, error: `Expected 72 group predictions, got ${groupRows.length}` }
  }

  const knockoutRows: KnockoutPrediction[] = Object.entries(knockoutPredictions).map(
    ([matchId, winnerId]) => ({ matchId, winnerId })
  )

  if (knockoutRows.length < 32) {
    return { success: false, error: `Expected at least 32 knockout predictions, got ${knockoutRows.length}` }
  }

  const groupUpsertData = groupRows.map((r) => ({
    user_id: user.id,
    match_id: r.matchId,
    predicted_score_a: r.scoreA,
    predicted_score_b: r.scoreB,
    updated_at: new Date().toISOString(),
  }))

  const { error: groupError } = await supabase
    .from('group_predictions')
    .upsert(groupUpsertData, { onConflict: 'user_id,match_id' })

  if (groupError) {
    return { success: false, error: `Failed to save group predictions: ${groupError.message}` }
  }

  const knockoutUpsertData = knockoutRows.map((r) => ({
    user_id: user.id,
    match_id: r.matchId,
    predicted_winner_id: r.winnerId,
    updated_at: new Date().toISOString(),
  }))

  const { error: knockoutError } = await supabase
    .from('knockout_predictions')
    .upsert(knockoutUpsertData, { onConflict: 'user_id,match_id' })

  if (knockoutError) {
    return { success: false, error: `Failed to save knockout predictions: ${knockoutError.message}` }
  }

  const { error: submitError } = await supabase
    .from('submissions')
    .insert({
      user_id: user.id,
      submitted_at: new Date().toISOString(),
      is_locked: true,
    })

  if (submitError) {
    return { success: false, error: `Failed to record submission: ${submitError.message}` }
  }

  return { success: true }
}
