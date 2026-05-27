/**
 * Pure helpers for translating one user's predictions from a source pool
 * into the rows we'll insert against a destination pool.
 *
 * Keeping these pure makes the copy logic easy to test without touching
 * Supabase, and prevents server actions from drifting into ad-hoc shaping.
 */

export interface GroupPredictionRow {
  pool_id: string
  user_id: string
  match_id: number
  predicted_score_a: number
  predicted_score_b: number
  updated_at: string
}

export interface KnockoutPredictionRow {
  pool_id: string
  user_id: string
  match_id: string
  team_a_id: number | null
  team_b_id: number | null
  predicted_winner_id: number
  updated_at: string
}

export interface SourceGroupPrediction {
  match_id: number
  predicted_score_a: number
  predicted_score_b: number
}

export interface SourceKnockoutPrediction {
  match_id: string
  predicted_winner_id: number
  team_a_id?: number | null
  team_b_id?: number | null
}

export interface CopyContext {
  destinationPoolId: string
  userId: string
  now?: Date
}

export function buildGroupCopyRows(
  source: SourceGroupPrediction[],
  ctx: CopyContext,
): GroupPredictionRow[] {
  const ts = (ctx.now ?? new Date()).toISOString()
  return source.map((row) => ({
    pool_id: ctx.destinationPoolId,
    user_id: ctx.userId,
    match_id: row.match_id,
    predicted_score_a: row.predicted_score_a,
    predicted_score_b: row.predicted_score_b,
    updated_at: ts,
  }))
}

export function buildKnockoutCopyRows(
  source: SourceKnockoutPrediction[],
  ctx: CopyContext,
): KnockoutPredictionRow[] {
  const ts = (ctx.now ?? new Date()).toISOString()
  return source.map((row) => ({
    pool_id: ctx.destinationPoolId,
    user_id: ctx.userId,
    match_id: row.match_id,
    team_a_id: row.team_a_id ?? null,
    team_b_id: row.team_b_id ?? null,
    predicted_winner_id: row.predicted_winner_id,
    updated_at: ts,
  }))
}
