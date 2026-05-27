'use server'

import { validatePredictionSubmission } from '@/lib/predictions/validation'
import { isTournamentLocked } from '@/lib/matches/lock'
import { createClient } from '@/lib/supabase/server'
import type { KnockoutMatchup } from '@/types'
import type { User } from '@supabase/supabase-js'
import {
  ensureProfileForUser,
  isMissingProfileForMembershipError,
} from './profile-utils'

const LOCKED_ERROR = 'Predictions are locked because the tournament has started'

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
  knockoutMatchups: Record<string, KnockoutMatchup>
  tieBreakResolutions: Record<string, number[]>
  submitted: boolean
}

interface KnockoutPredictionRow {
  match_id: string
  predicted_winner_id: number
  team_a_id?: number | null
  team_b_id?: number | null
}

interface PredictionReadResponse<T> {
  data: T[] | null
  error: { message?: string } | null
}

function isMissingColumn(
  error: { message?: string } | null | undefined,
  columnName: string,
): boolean {
  return (
    typeof error?.message === 'string' &&
    error.message.includes(`'${columnName}' column`) &&
    error.message.includes('schema cache')
  )
}

function isMissingKnockoutMatchupColumn(error: { message?: string } | null | undefined): boolean {
  return isMissingColumn(error, 'team_a_id') || isMissingColumn(error, 'team_b_id')
}

async function ensureMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  poolId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('pool_members')
    .select('pool_id')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

/**
 * Looks up an active pool by id and returns true after making sure the user
 * is a member of it. Used by submit to auto-join when the user is signing
 * predictions from a brand-new account.
 */
async function ensureOrJoinMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  poolId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const isMember = await ensureMembership(supabase, user.id, poolId)
  if (isMember) return { ok: true }

  // Only auto-join active, existing pools.
  const poolCheck = await supabase
    .from('pools')
    .select('id, is_active')
    .eq('id', poolId)
    .maybeSingle()
  if (!poolCheck.data || !poolCheck.data.is_active) {
    return { ok: false, error: 'Pool not found or inactive' }
  }

  const { error } = await supabase.from('pool_members').insert({
    pool_id: poolId,
    user_id: user.id,
    role: 'member',
  })
  if (error) {
    // 23505 = unique_violation; the row showed up after our check (e.g. a
    // concurrent submit). Treat as already-member.
    if (error.code === '23505') return { ok: true }
    if (isMissingProfileForMembershipError(error)) {
      const profileError = await ensureProfileForUser(supabase, user)
      if (profileError) return { ok: false, error: `Failed to create profile: ${profileError}` }

      const { error: retryError } = await supabase.from('pool_members').insert({
        pool_id: poolId,
        user_id: user.id,
        role: 'member',
      })
      if (!retryError || retryError.code === '23505') return { ok: true }
      return { ok: false, error: `Failed to join pool: ${retryError.message}` }
    }
    return { ok: false, error: `Failed to join pool: ${error.message}` }
  }
  return { ok: true }
}

export async function loadPredictions(poolId: string): Promise<LoadResult | null> {
  if (!poolId) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const isMember = await ensureMembership(supabase, user.id, poolId)
  if (!isMember) return null

  const groupRes = await supabase
    .from('group_predictions')
    .select('match_id, predicted_score_a, predicted_score_b')
    .eq('user_id', user.id)
    .eq('pool_id', poolId)

  let knockoutRes: PredictionReadResponse<KnockoutPredictionRow> = await supabase
    .from('knockout_predictions')
    .select('match_id, predicted_winner_id, team_a_id, team_b_id')
    .eq('user_id', user.id)
    .eq('pool_id', poolId)

  if (isMissingKnockoutMatchupColumn(knockoutRes.error)) {
    knockoutRes = await supabase
      .from('knockout_predictions')
      .select('match_id, predicted_winner_id')
      .eq('user_id', user.id)
      .eq('pool_id', poolId)
  }

  const submissionRes = await supabase
    .from('submissions')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('pool_id', poolId)
    .maybeSingle()

  const groupPredictions: Record<number, { scoreA: number; scoreB: number }> = {}
  for (const row of groupRes.data ?? []) {
    groupPredictions[row.match_id] = {
      scoreA: row.predicted_score_a,
      scoreB: row.predicted_score_b,
    }
  }

  const knockoutPredictions: Record<string, number> = {}
  const knockoutMatchups: Record<string, KnockoutMatchup> = {}
  for (const row of knockoutRes.data ?? []) {
    knockoutPredictions[row.match_id] = row.predicted_winner_id
    if (row.team_a_id !== undefined || row.team_b_id !== undefined) {
      knockoutMatchups[row.match_id] = {
        teamAId: (row.team_a_id as number | null | undefined) ?? null,
        teamBId: (row.team_b_id as number | null | undefined) ?? null,
      }
    }
  }

  return {
    groupPredictions,
    knockoutPredictions,
    knockoutMatchups,
    tieBreakResolutions: {},
    submitted: !!submissionRes.data,
  }
}

export async function savePredictionDraft(
  poolId: string,
  groupPredictions: Record<number, { scoreA?: number; scoreB?: number }>,
  knockoutPredictions: Record<string, number>,
): Promise<SubmitResult> {
  if (!poolId) return { success: false, error: 'Missing pool' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (isTournamentLocked()) {
    return { success: false, error: LOCKED_ERROR }
  }

  const isMember = await ensureMembership(supabase, user.id, poolId)
  if (!isMember) return { success: false, error: 'You are not a member of this pool' }

  const now = new Date().toISOString()

  const groupRows = Object.entries(groupPredictions)
    .filter(
      ([, value]) =>
        typeof value.scoreA === 'number' && typeof value.scoreB === 'number',
    )
    .map(([matchId, value]) => ({
      pool_id: poolId,
      user_id: user.id,
      match_id: Number(matchId),
      predicted_score_a: value.scoreA as number,
      predicted_score_b: value.scoreB as number,
      updated_at: now,
    }))

  if (groupRows.length > 0) {
    const { error } = await supabase
      .from('group_predictions')
      .upsert(groupRows, { onConflict: 'pool_id,user_id,match_id' })
    if (error) return { success: false, error: error.message }
  }

  const knockoutRows = Object.entries(knockoutPredictions).map(
    ([matchId, winnerId]) => ({
      pool_id: poolId,
      user_id: user.id,
      match_id: matchId,
      predicted_winner_id: winnerId,
      updated_at: now,
    }),
  )

  if (knockoutRows.length > 0) {
    const { error } = await supabase
      .from('knockout_predictions')
      .upsert(knockoutRows, { onConflict: 'pool_id,user_id,match_id' })
    if (error) return { success: false, error: error.message }
  }

  return { success: true }
}

export async function submitPredictionsToDb(
  poolId: string,
  groupPredictions: Record<number, { scoreA?: number; scoreB?: number }>,
  knockoutPredictions: Record<string, number>,
  knockoutMatchups: Record<string, KnockoutMatchup> = {},
): Promise<SubmitResult> {
  if (!poolId) return { success: false, error: 'Missing pool' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (isTournamentLocked()) {
    return { success: false, error: LOCKED_ERROR }
  }

  const validation = validatePredictionSubmission({
    groupPredictions,
    knockoutPredictions,
  })
  if (!validation.ok) {
    return { success: false, error: validation.error }
  }

  const membership = await ensureOrJoinMembership(supabase, user, poolId)
  if (!membership.ok) return { success: false, error: membership.error }

  const groupRows: GroupPrediction[] = []
  for (const [matchId, { scoreA, scoreB }] of Object.entries(groupPredictions)) {
    if (typeof scoreA !== 'number' || typeof scoreB !== 'number') continue
    groupRows.push({ matchId: Number(matchId), scoreA, scoreB })
  }

  const knockoutRows: KnockoutPrediction[] = Object.entries(knockoutPredictions).map(
    ([matchId, winnerId]) => ({ matchId, winnerId }),
  )

  const now = new Date().toISOString()

  const groupUpsertData = groupRows.map((r) => ({
    pool_id: poolId,
    user_id: user.id,
    match_id: r.matchId,
    predicted_score_a: r.scoreA,
    predicted_score_b: r.scoreB,
    updated_at: now,
  }))

  const { error: groupError } = await supabase
    .from('group_predictions')
    .upsert(groupUpsertData, { onConflict: 'pool_id,user_id,match_id' })

  if (groupError) {
    return { success: false, error: `Failed to save group predictions: ${groupError.message}` }
  }

  const knockoutUpsertData = knockoutRows.map((r) => ({
    pool_id: poolId,
    user_id: user.id,
    match_id: r.matchId,
    team_a_id: knockoutMatchups[r.matchId]?.teamAId ?? null,
    team_b_id: knockoutMatchups[r.matchId]?.teamBId ?? null,
    predicted_winner_id: r.winnerId,
    updated_at: now,
  }))

  let { error: knockoutError } = await supabase
    .from('knockout_predictions')
    .upsert(knockoutUpsertData, { onConflict: 'pool_id,user_id,match_id' })

  if (isMissingKnockoutMatchupColumn(knockoutError)) {
    const fallbackKnockoutUpsertData = knockoutRows.map((r) => ({
      pool_id: poolId,
      user_id: user.id,
      match_id: r.matchId,
      predicted_winner_id: r.winnerId,
      updated_at: now,
    }))

    const fallbackResult = await supabase
      .from('knockout_predictions')
      .upsert(fallbackKnockoutUpsertData, { onConflict: 'pool_id,user_id,match_id' })
    knockoutError = fallbackResult.error
  }

  if (knockoutError) {
    return { success: false, error: `Failed to save knockout predictions: ${knockoutError.message}` }
  }

  const existingSubmission = await supabase
    .from('submissions')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('pool_id', poolId)
    .maybeSingle()

  if (existingSubmission.data) {
    return { success: true }
  }

  const { error: submitError } = await supabase
    .from('submissions')
    .insert({
      pool_id: poolId,
      user_id: user.id,
      submitted_at: now,
      is_locked: true,
    })

  if (submitError) {
    return { success: false, error: `Failed to record submission: ${submitError.message}` }
  }

  return { success: true }
}
