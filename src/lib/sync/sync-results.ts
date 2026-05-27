import { createAdminClient } from '@/lib/supabase/admin'
import { GROUP_MATCHES } from '@/lib/data/matches'
import { resolveTeamId } from '@/lib/data/team-mapping'
import { findKnockoutMatchIdByDate } from '@/lib/data/knockout-schedule'
import { recalculateAllScores } from '@/lib/scoring/recalculate'

const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260601-20260720&limit=200'

const DEFAULT_TTL_MS = 600_000 // 10 minutes

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  score: string
  winner: boolean
  team: { displayName: string; abbreviation: string }
}

interface EspnEvent {
  id: string
  date: string
  name: string
  season: { slug: string }
  competitions: Array<{
    status: { type: { completed: boolean; state: string } }
    competitors: EspnCompetitor[]
  }>
}

export interface SyncResult {
  ok: true
  source: string
  totalEvents: number
  groupSynced: number
  knockoutSynced: number
  usersScored: number
  skipped?: string[]
  errors?: string[]
}

async function fetchEspnEvents(): Promise<EspnEvent[]> {
  const res = await fetch(ESPN_URL, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`ESPN returned ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { events?: EspnEvent[] }
  return data.events ?? []
}

function findGroupMatchId(homeName: string, awayName: string): number | null {
  const homeId = resolveTeamId(homeName)
  const awayId = resolveTeamId(awayName)
  if (!homeId || !awayId) return null

  const match = GROUP_MATCHES.find(
    (m) =>
      (m.teamAId === homeId && m.teamBId === awayId) ||
      (m.teamAId === awayId && m.teamBId === homeId),
  )
  return match?.id ?? null
}

/**
 * Fetches completed results from ESPN, upserts them into Supabase,
 * and recalculates all user scores if any new results were found.
 */
export async function syncResults(): Promise<SyncResult> {
  const events = await fetchEspnEvents()
  const supabase = createAdminClient()

  let groupSynced = 0
  let knockoutSynced = 0
  const skipped: string[] = []
  const errors: string[] = []

  for (const event of events) {
    const comp = event.competitions[0]
    if (!comp.status.type.completed) continue

    const competitors = comp.competitors
    const home = competitors.find((c) => c.homeAway === 'home')
    const away = competitors.find((c) => c.homeAway === 'away')
    if (!home || !away) {
      skipped.push(`${event.id}: missing home/away`)
      continue
    }

    const homeScore = parseInt(home.score, 10)
    const awayScore = parseInt(away.score, 10)
    if (isNaN(homeScore) || isNaN(awayScore)) {
      skipped.push(`${event.id}: scores not numeric (${home.score}-${away.score})`)
      continue
    }

    const slug = event.season.slug

    if (slug === 'group-stage') {
      const matchId = findGroupMatchId(home.team.displayName, away.team.displayName)
      if (!matchId) {
        errors.push(
          `Could not match group: ${home.team.displayName} vs ${away.team.displayName}`,
        )
        continue
      }

      const groupMatch = GROUP_MATCHES.find((m) => m.id === matchId)!
      const homeIsTeamA = groupMatch.teamAId === resolveTeamId(home.team.displayName)
      const scoreA = homeIsTeamA ? homeScore : awayScore
      const scoreB = homeIsTeamA ? awayScore : homeScore

      const { error } = await supabase.from('actual_group_results').upsert(
        {
          match_id: matchId,
          score_a: scoreA,
          score_b: scoreB,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'match_id' },
      )

      if (error) {
        errors.push(`Group ${matchId}: ${error.message}`)
      } else {
        groupSynced++
      }
    } else {
      const ourMatchId = findKnockoutMatchIdByDate(event.date)
      if (!ourMatchId) {
        errors.push(`No knockout match ID for date ${event.date} (${event.name})`)
        continue
      }

      const winnerCompetitor = competitors.find((c) => c.winner)
      if (!winnerCompetitor) {
        skipped.push(`${ourMatchId}: no winner (draw or unresolved)`)
        continue
      }

      const winnerId = resolveTeamId(winnerCompetitor.team.displayName)
      if (!winnerId) {
        errors.push(
          `${ourMatchId}: could not resolve winner team "${winnerCompetitor.team.displayName}"`,
        )
        continue
      }

      const { error } = await supabase.from('actual_knockout_results').upsert(
        {
          match_id: ourMatchId,
          winner_id: winnerId,
          score_a: homeScore,
          score_b: awayScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'match_id' },
      )

      if (error) {
        errors.push(`Knockout ${ourMatchId}: ${error.message}`)
      } else {
        knockoutSynced++
      }
    }
  }

  let scoringResult: { usersScored: number; message?: string } = { usersScored: 0 }
  if (groupSynced > 0 || knockoutSynced > 0) {
    scoringResult = await recalculateAllScores()
  }

  return {
    ok: true,
    source: 'ESPN',
    totalEvents: events.length,
    groupSynced,
    knockoutSynced,
    usersScored: scoringResult.usersScored,
    skipped: skipped.length > 0 ? skipped : undefined,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Runs syncResults() only if the last sync was more than `ttlMs` ago.
 * Uses a "claim first, sync second" pattern to prevent concurrent syncs.
 * Fails silently (logs error, returns skipped) so page rendering is never blocked.
 */
export async function syncResultsIfStale(
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<{ skipped: boolean; result?: SyncResult }> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('sync_metadata')
      .select('last_synced_at')
      .eq('key', 'espn_sync')
      .single()

    if (error || !data) {
      console.error('sync_metadata read failed:', error?.message)
      return { skipped: true }
    }

    const lastSynced = new Date(data.last_synced_at).getTime()
    const now = Date.now()

    if (now - lastSynced < ttlMs) {
      return { skipped: true }
    }

    // Claim the slot before syncing to prevent concurrent syncs
    await supabase
      .from('sync_metadata')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('key', 'espn_sync')

    const result = await syncResults()
    return { skipped: false, result }
  } catch (err) {
    console.error('syncResultsIfStale error:', err instanceof Error ? err.message : err)
    return { skipped: true }
  }
}
