import { NextResponse } from 'next/server'
import { authorizeCronRequest } from '@/lib/cron/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { GROUP_MATCHES } from '@/lib/data/matches'
import { resolveTeamId } from '@/lib/data/team-mapping'
import { findKnockoutMatchIdByDate } from '@/lib/data/knockout-schedule'
import { recalculateAllScores } from '@/lib/scoring/recalculate'

export const dynamic = 'force-dynamic'

const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260601-20260720&limit=200'

type EspnSlug =
  | 'group-stage'
  | 'round-of-32'
  | 'round-of-16'
  | 'quarterfinals'
  | 'semifinals'
  | '3rd-place-match'
  | 'final'

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
  season: { slug: EspnSlug }
  competitions: Array<{
    status: { type: { completed: boolean; state: string } }
    competitors: EspnCompetitor[]
  }>
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

export async function GET(request: Request) {
  const auth = authorizeCronRequest({
    cronSecret: process.env.CRON_SECRET,
    authHeader: request.headers.get('authorization'),
  })
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
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

    return NextResponse.json({
      ok: true,
      source: 'ESPN',
      totalEvents: events.length,
      groupSynced,
      knockoutSynced,
      usersScored: scoringResult.usersScored,
      skipped: skipped.length > 0 ? skipped : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('sync-results error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
