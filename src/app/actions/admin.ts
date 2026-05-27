'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser } from '@/lib/admin/access'
import { recalculateAllScores } from '@/lib/scoring/recalculate'

export async function saveGroupResult(
  matchId: number,
  scoreA: number,
  scoreB: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminUser()
    const supabase = createAdminClient()

    const { error } = await supabase.from('actual_group_results').upsert(
      {
        match_id: matchId,
        score_a: scoreA,
        score_b: scoreB,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'match_id' },
    )

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function saveKnockoutResult(
  matchId: string,
  winnerId: number,
  scoreA?: number,
  scoreB?: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminUser()
    const supabase = createAdminClient()

    const { error } = await supabase.from('actual_knockout_results').upsert(
      {
        match_id: matchId,
        winner_id: winnerId,
        score_a: scoreA ?? null,
        score_b: scoreB ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'match_id' },
    )

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function triggerRecalculate(): Promise<{
  success: boolean
  usersScored?: number
  error?: string
}> {
  try {
    await requireAdminUser()
    const result = await recalculateAllScores()
    return { success: true, usersScored: result.usersScored }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function triggerApiSync(): Promise<{
  success: boolean
  data?: Record<string, unknown>
  error?: string
}> {
  try {
    await requireAdminUser()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    if (!baseUrl) {
      return { success: false, error: 'No APP_URL configured' }
    }

    const protocol = baseUrl.startsWith('http') ? '' : 'https://'
    const res = await fetch(`${protocol}${baseUrl}/api/cron/sync-results`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET || ''}`,
      },
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || `HTTP ${res.status}` }
    }

    return { success: true, data }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function getAdminStats(): Promise<{
  totalUsers: number
  totalSubmissions: number
  groupResultsEntered: number
  knockoutResultsEntered: number
  pools: Array<{ id: string; name: string; slug: string; members: number; submissions: number }>
}> {
  await requireAdminUser()
  const supabase = createAdminClient()

  const [users, submissions, groupResults, knockoutResults, poolsRes, memberRows, submissionRows] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('submissions').select('user_id', { count: 'exact', head: true }),
    supabase.from('actual_group_results').select('match_id', { count: 'exact', head: true }),
    supabase.from('actual_knockout_results').select('match_id', { count: 'exact', head: true }),
    supabase
      .from('pools')
      .select('id, name, slug, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase.from('pool_members').select('pool_id'),
    supabase.from('submissions').select('pool_id'),
  ])

  const memberCounts = new Map<string, number>()
  for (const row of memberRows.data ?? []) {
    memberCounts.set(row.pool_id, (memberCounts.get(row.pool_id) ?? 0) + 1)
  }

  const submissionCounts = new Map<string, number>()
  for (const row of submissionRows.data ?? []) {
    submissionCounts.set(row.pool_id, (submissionCounts.get(row.pool_id) ?? 0) + 1)
  }

  const pools = (poolsRes.data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    slug: p.slug as string,
    members: memberCounts.get(p.id) ?? 0,
    submissions: submissionCounts.get(p.id) ?? 0,
  }))

  return {
    totalUsers: users.count ?? 0,
    totalSubmissions: submissions.count ?? 0,
    groupResultsEntered: groupResults.count ?? 0,
    knockoutResultsEntered: knockoutResults.count ?? 0,
    pools,
  }
}
