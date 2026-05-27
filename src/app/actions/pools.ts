'use server'

import { createClient } from '@/lib/supabase/server'
import type { Pool, PoolMembership, PoolRole, PoolType, PoolVisibility } from '@/types'
import type { User } from '@supabase/supabase-js'
import {
  buildGroupCopyRows,
  buildKnockoutCopyRows,
  type SourceKnockoutPrediction,
} from '@/lib/pools/copy-predictions'
import { validateJoinInput } from '@/lib/pools/copy-validation'
import { isTournamentLocked } from '@/lib/matches/lock'
import {
  ensureProfileForUser,
  isMissingProfileForMembershipError,
} from './profile-utils'

interface PoolRow {
  id: string
  name: string
  slug: string
  type: PoolType
  visibility: PoolVisibility
  is_active: boolean
  created_at: string
}

interface MembershipRow {
  pool_id: string
  role: PoolRole
  joined_at: string
  pool: PoolRow | PoolRow[]
}

interface PredictionReadResponse<T> {
  data: T[] | null
  error: { message?: string } | null
}

function poolRowToPool(row: PoolRow): Pool {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    visibility: row.visibility,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

function isMissingKnockoutMatchupColumn(error: { message?: string } | null | undefined): boolean {
  return (
    typeof error?.message === 'string' &&
    error.message.includes('schema cache') &&
    (error.message.includes("'team_a_id' column") ||
      error.message.includes("'team_b_id' column"))
  )
}

export async function listAvailablePools(): Promise<Pool[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pools')
    .select('id, name, slug, type, visibility, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error || !data) return []
  return data.map(poolRowToPool)
}

export async function listMyMemberships(): Promise<PoolMembership[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('pool_members')
    .select(
      'pool_id, role, joined_at, pool:pools(id, name, slug, type, visibility, is_active, created_at)',
    )
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  if (error || !data) return []

  return (data as MembershipRow[])
    .map((row) => {
      const pool = Array.isArray(row.pool) ? row.pool[0] : row.pool
      if (!pool) return null
      return {
        pool: poolRowToPool(pool),
        role: row.role,
        joinedAt: row.joined_at,
      } satisfies PoolMembership
    })
    .filter((m): m is PoolMembership => m !== null)
}

export async function getPoolBySlug(slug: string): Promise<Pool | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pools')
    .select('id, name, slug, type, visibility, is_active, created_at')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return null
  return poolRowToPool(data as PoolRow)
}

interface ActionResult<T = undefined> {
  success: boolean
  error?: string
  data?: T
}

interface CopyCounts {
  copiedGroup: number
  copiedKnockout: number
}

async function cleanupFailedCopy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poolId: string,
  userId: string,
): Promise<void> {
  const deleteScopedRows = async (table: string) => {
    try {
      await supabase.from(table).delete().eq('pool_id', poolId).eq('user_id', userId)
    } catch {
      // Best-effort cleanup should never hide the original copy error.
    }
  }

  await deleteScopedRows('group_predictions')
  await deleteScopedRows('knockout_predictions')
  await deleteScopedRows('pool_members')
}

async function ensurePoolMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poolId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('pool_members')
    .select('pool_id')
    .eq('pool_id', poolId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!data
}

async function readPredictionCopyRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourcePoolId: string,
  destinationPoolId: string,
  userId: string,
): Promise<
  | { ok: true; groupRows: ReturnType<typeof buildGroupCopyRows>; knockoutRows: ReturnType<typeof buildKnockoutCopyRows> }
  | { ok: false; error: string }
> {
  const [groupRes, initialKnockoutRes] = await Promise.all([
    supabase
      .from('group_predictions')
      .select('match_id, predicted_score_a, predicted_score_b')
      .eq('user_id', userId)
      .eq('pool_id', sourcePoolId),
    supabase
      .from('knockout_predictions')
      .select('match_id, predicted_winner_id, team_a_id, team_b_id')
      .eq('user_id', userId)
      .eq('pool_id', sourcePoolId),
  ])

  let knockoutRes: PredictionReadResponse<SourceKnockoutPrediction> = initialKnockoutRes
  if (isMissingKnockoutMatchupColumn(initialKnockoutRes.error)) {
    knockoutRes = await supabase
      .from('knockout_predictions')
      .select('match_id, predicted_winner_id')
      .eq('user_id', userId)
      .eq('pool_id', sourcePoolId)
  }

  if (groupRes.error) {
    return { ok: false, error: `Copy failed: ${groupRes.error.message}` }
  }
  if (knockoutRes.error) {
    return { ok: false, error: `Copy failed: ${knockoutRes.error.message}` }
  }

  return {
    ok: true,
    groupRows: buildGroupCopyRows(groupRes.data ?? [], {
      destinationPoolId,
      userId,
    }),
    knockoutRows: buildKnockoutCopyRows(knockoutRes.data ?? [], {
      destinationPoolId,
      userId,
    }),
  }
}

async function insertKnockoutCopyRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ReturnType<typeof buildKnockoutCopyRows>,
): Promise<string | null> {
  const { error } = await supabase.from('knockout_predictions').insert(rows)
  if (!error) return null
  if (!isMissingKnockoutMatchupColumn(error)) return error.message

  const fallbackRows = rows.map((row) => ({
    pool_id: row.pool_id,
    user_id: row.user_id,
    match_id: row.match_id,
    predicted_winner_id: row.predicted_winner_id,
    updated_at: row.updated_at,
  }))
  const { error: fallbackError } = await supabase
    .from('knockout_predictions')
    .insert(fallbackRows)
  return fallbackError?.message ?? null
}

async function insertPoolMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  poolId: string,
): Promise<string | null> {
  const membershipRow = {
    pool_id: poolId,
    user_id: user.id,
    role: 'member',
  }

  const { error } = await supabase.from('pool_members').insert(membershipRow)
  if (!error) return null
  if (error.code === '23505') return 'Already a member of this pool'
  if (!isMissingProfileForMembershipError(error)) return error.message

  const profileError = await ensureProfileForUser(supabase, user)
  if (profileError) return `Failed to create profile: ${profileError}`

  const { error: retryError } = await supabase.from('pool_members').insert(membershipRow)
  if (!retryError) return null
  if (retryError.code === '23505') return 'Already a member of this pool'
  return retryError.message
}

export async function joinPool(
  poolId: string,
  options: { copyFromPoolId?: string } = {},
): Promise<ActionResult<{ copiedGroup: number; copiedKnockout: number }>> {
  const validation = validateJoinInput({
    poolId,
    copyFromPoolId: options.copyFromPoolId,
  })
  if (!validation.ok) {
    return { success: false, error: validation.error }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const poolCheck = await supabase
    .from('pools')
    .select('id, is_active')
    .eq('id', poolId)
    .maybeSingle()
  if (!poolCheck.data || !poolCheck.data.is_active) {
    return { success: false, error: 'Pool not found or inactive' }
  }

  const existing = await supabase
    .from('pool_members')
    .select('pool_id')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing.data) {
    return { success: false, error: 'Already a member of this pool' }
  }

  // Validate the source pool is one the caller belongs to. RLS would already
  // protect us, but checking explicitly lets us return a friendlier error.
  if (options.copyFromPoolId) {
    const sourceMembership = await supabase
      .from('pool_members')
      .select('pool_id')
      .eq('pool_id', options.copyFromPoolId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!sourceMembership.data) {
      return { success: false, error: 'You are not a member of the source pool' }
    }
  }

  let groupRows: ReturnType<typeof buildGroupCopyRows> = []
  let knockoutRows: ReturnType<typeof buildKnockoutCopyRows> = []

  if (options.copyFromPoolId) {
    const copyRows = await readPredictionCopyRows(
      supabase,
      options.copyFromPoolId,
      poolId,
      user.id,
    )
    if (!copyRows.ok) return { success: false, error: copyRows.error }
    groupRows = copyRows.groupRows
    knockoutRows = copyRows.knockoutRows
  }

  const joinError = await insertPoolMembership(supabase, user, poolId)
  if (joinError) return { success: false, error: joinError }

  if (!options.copyFromPoolId) {
    return { success: true, data: { copiedGroup: 0, copiedKnockout: 0 } }
  }

  if (groupRows.length > 0) {
    const { error: insertGroupErr } = await supabase
      .from('group_predictions')
      .insert(groupRows)
    if (insertGroupErr) {
      await cleanupFailedCopy(supabase, poolId, user.id)
      return { success: false, error: `Copy failed: ${insertGroupErr.message}` }
    }
  }

  if (knockoutRows.length > 0) {
    const insertKnockoutError = await insertKnockoutCopyRows(supabase, knockoutRows)
    if (insertKnockoutError) {
      await cleanupFailedCopy(supabase, poolId, user.id)
      return { success: false, error: `Copy failed: ${insertKnockoutError}` }
    }
  }

  return {
    success: true,
    data: { copiedGroup: groupRows.length, copiedKnockout: knockoutRows.length },
  }
}

export async function copyPredictionsBetweenPools(
  sourcePoolId: string,
  destinationPoolId: string,
): Promise<ActionResult<CopyCounts>> {
  const validation = validateJoinInput({
    poolId: destinationPoolId,
    copyFromPoolId: sourcePoolId,
  })
  if (!validation.ok) {
    return { success: false, error: validation.error }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (isTournamentLocked()) {
    return {
      success: false,
      error: 'Predictions are locked because the tournament has started',
    }
  }

  const isDestinationMember = await ensurePoolMembership(
    supabase,
    destinationPoolId,
    user.id,
  )
  if (!isDestinationMember) {
    return {
      success: false,
      error: 'You are not a member of the destination pool',
    }
  }

  const isSourceMember = await ensurePoolMembership(supabase, sourcePoolId, user.id)
  if (!isSourceMember) {
    return { success: false, error: 'You are not a member of the source pool' }
  }

  const copyRows = await readPredictionCopyRows(
    supabase,
    sourcePoolId,
    destinationPoolId,
    user.id,
  )
  if (!copyRows.ok) return { success: false, error: copyRows.error }

  const deleteDestinationRows = async (table: string) => {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('pool_id', destinationPoolId)
      .eq('user_id', user.id)
    if (error) return error.message
    return null
  }

  const groupDeleteError = await deleteDestinationRows('group_predictions')
  if (groupDeleteError) return { success: false, error: `Copy failed: ${groupDeleteError}` }

  const knockoutDeleteError = await deleteDestinationRows('knockout_predictions')
  if (knockoutDeleteError) {
    return { success: false, error: `Copy failed: ${knockoutDeleteError}` }
  }

  if (copyRows.groupRows.length > 0) {
    const { error } = await supabase
      .from('group_predictions')
      .insert(copyRows.groupRows)
    if (error) return { success: false, error: `Copy failed: ${error.message}` }
  }

  if (copyRows.knockoutRows.length > 0) {
    const error = await insertKnockoutCopyRows(supabase, copyRows.knockoutRows)
    if (error) return { success: false, error: `Copy failed: ${error}` }
  }

  return {
    success: true,
    data: {
      copiedGroup: copyRows.groupRows.length,
      copiedKnockout: copyRows.knockoutRows.length,
    },
  }
}

export interface MyPoolSummary {
  pool: Pool
  role: PoolRole
  joinedAt: string
  submitted: boolean
  groupPredictionCount: number
  knockoutPredictionCount: number
  memberCount: number
  myRank: number | null
  myTotalScore: number | null
}

export async function getMyPoolSummaries(): Promise<MyPoolSummary[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const memberships = await listMyMemberships()
  if (memberships.length === 0) return []
  const poolIds = memberships.map((m) => m.pool.id)

  const [
    { data: submissionsData },
    { data: groupRows },
    { data: knockoutRows },
    { data: allMembers },
    { data: allScores },
  ] = await Promise.all([
    supabase
      .from('submissions')
      .select('pool_id')
      .eq('user_id', user.id)
      .in('pool_id', poolIds),
    supabase
      .from('group_predictions')
      .select('pool_id')
      .eq('user_id', user.id)
      .in('pool_id', poolIds),
    supabase
      .from('knockout_predictions')
      .select('pool_id')
      .eq('user_id', user.id)
      .in('pool_id', poolIds),
    supabase
      .from('pool_members')
      .select('pool_id, user_id')
      .in('pool_id', poolIds),
    supabase
      .from('user_scores')
      .select('pool_id, user_id, total_score')
      .in('pool_id', poolIds),
  ])

  const submittedPoolIds = new Set(
    (submissionsData ?? []).map((r) => r.pool_id as string),
  )

  const groupCount = new Map<string, number>()
  for (const r of groupRows ?? []) {
    const pid = r.pool_id as string
    groupCount.set(pid, (groupCount.get(pid) ?? 0) + 1)
  }
  const knockoutCount = new Map<string, number>()
  for (const r of knockoutRows ?? []) {
    const pid = r.pool_id as string
    knockoutCount.set(pid, (knockoutCount.get(pid) ?? 0) + 1)
  }

  const memberCount = new Map<string, number>()
  for (const r of allMembers ?? []) {
    const pid = r.pool_id as string
    memberCount.set(pid, (memberCount.get(pid) ?? 0) + 1)
  }

  // Compute rank per pool: order users by total_score desc, find my index.
  const scoresByPool = new Map<
    string,
    { user_id: string; total_score: number }[]
  >()
  for (const r of allScores ?? []) {
    const pid = r.pool_id as string
    if (!scoresByPool.has(pid)) scoresByPool.set(pid, [])
    scoresByPool.get(pid)!.push({
      user_id: r.user_id as string,
      total_score: (r.total_score as number) ?? 0,
    })
  }
  const myRankByPool = new Map<string, { rank: number; total: number }>()
  for (const [pid, scores] of scoresByPool) {
    scores.sort((a, b) => b.total_score - a.total_score)
    const idx = scores.findIndex((s) => s.user_id === user.id)
    if (idx >= 0) {
      myRankByPool.set(pid, {
        rank: idx + 1,
        total: scores[idx].total_score,
      })
    }
  }

  return memberships.map((m) => {
    const pid = m.pool.id
    const rank = myRankByPool.get(pid)
    return {
      pool: m.pool,
      role: m.role,
      joinedAt: m.joinedAt,
      submitted: submittedPoolIds.has(pid),
      groupPredictionCount: groupCount.get(pid) ?? 0,
      knockoutPredictionCount: knockoutCount.get(pid) ?? 0,
      memberCount: memberCount.get(pid) ?? 0,
      myRank: rank?.rank ?? null,
      myTotalScore: rank?.total ?? null,
    } satisfies MyPoolSummary
  })
}

export async function leavePool(poolId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  if (isTournamentLocked()) {
    return {
      success: false,
      error: 'Pools are locked because the tournament has started',
    }
  }

  const { error } = await supabase
    .from('pool_members')
    .delete()
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
