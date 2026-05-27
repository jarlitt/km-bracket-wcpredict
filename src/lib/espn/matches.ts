import { resolveTeamId } from '@/lib/data/team-mapping'
import { TEAMS } from '@/lib/data/teams'
import { GROUP_MATCHES } from '@/lib/data/matches'
import { findKnockoutMatchIdByDate } from '@/lib/data/knockout-schedule'
import type { Team } from '@/types'

const ESPN_URL =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260601-20260720&limit=200'

export type MatchRound =
  | 'group-stage'
  | 'round-of-32'
  | 'round-of-16'
  | 'quarterfinals'
  | 'semifinals'
  | '3rd-place-match'
  | 'final'

export type MatchState = 'pre' | 'in' | 'post'

export interface MatchTeam {
  name: string
  abbreviation: string
  score: number | null
  winner: boolean
  flag: string | null
  team: Team | null
}

export interface LiveMatch {
  id: string
  date: string
  round: MatchRound
  roundLabel: string
  status: {
    state: MatchState
    completed: boolean
    detail: string
    shortDetail: string
  }
  home: MatchTeam
  away: MatchTeam
  venue: string | null
  /** Internal ID used to look up user predictions. Null for placeholder fixtures. */
  internalId:
    | { type: 'group'; matchId: number }
    | { type: 'knockout'; matchId: string }
    | null
}

const ROUND_LABEL: Record<MatchRound, string> = {
  'group-stage': 'Group Stage',
  'round-of-32': 'Round of 32',
  'round-of-16': 'Round of 16',
  quarterfinals: 'Quarterfinal',
  semifinals: 'Semifinal',
  '3rd-place-match': '3rd Place',
  final: 'Final',
}

interface EspnRaw {
  events?: Array<{
    id: string
    date: string
    season: { slug: MatchRound }
    competitions: Array<{
      status: {
        type: {
          state: MatchState
          completed: boolean
          detail: string
          shortDetail: string
        }
      }
      venue?: { fullName: string }
      competitors: Array<{
        homeAway: 'home' | 'away'
        score: string
        winner: boolean
        team: { displayName: string; abbreviation: string }
      }>
    }>
  }>
}

function buildTeam(
  displayName: string,
  abbreviation: string,
  score: string,
  winner: boolean,
): MatchTeam {
  const id = resolveTeamId(displayName)
  const team = id ? TEAMS.find((t) => t.id === id) ?? null : null
  const numericScore = score === '' ? null : Number.parseInt(score, 10)

  return {
    name: displayName,
    abbreviation,
    score: Number.isFinite(numericScore as number) ? (numericScore as number) : null,
    winner,
    flag: team?.flag ?? null,
    team,
  }
}

/**
 * Fetches all WC 2026 matches from ESPN.
 * Cached for 10 minutes via Next.js fetch caching — a single network call
 * serves every visitor across that window.
 */
export async function fetchLiveMatches(): Promise<LiveMatch[]> {
  const res = await fetch(ESPN_URL, {
    next: { revalidate: 600 },
  })

  if (!res.ok) {
    throw new Error(`ESPN returned ${res.status}`)
  }

  const data = (await res.json()) as EspnRaw
  const events = data.events ?? []

  return events.map((event) => {
    const comp = event.competitions[0]
    const home = comp.competitors.find((c) => c.homeAway === 'home')!
    const away = comp.competitors.find((c) => c.homeAway === 'away')!

    return {
      id: event.id,
      date: event.date,
      round: event.season.slug,
      roundLabel: ROUND_LABEL[event.season.slug] ?? event.season.slug,
      status: {
        state: comp.status.type.state,
        completed: comp.status.type.completed,
        detail: comp.status.type.detail,
        shortDetail: comp.status.type.shortDetail,
      },
      home: buildTeam(home.team.displayName, home.team.abbreviation, home.score, home.winner),
      away: buildTeam(away.team.displayName, away.team.abbreviation, away.score, away.winner),
      venue: comp.venue?.fullName ?? null,
      internalId: resolveInternalId(event.season.slug, event.date, home.team.displayName, away.team.displayName),
    }
  })
}

function resolveInternalId(
  slug: MatchRound,
  date: string,
  homeName: string,
  awayName: string,
): LiveMatch['internalId'] {
  if (slug === 'group-stage') {
    const homeId = resolveTeamId(homeName)
    const awayId = resolveTeamId(awayName)
    if (!homeId || !awayId) return null
    const match = GROUP_MATCHES.find(
      (m) =>
        (m.teamAId === homeId && m.teamBId === awayId) ||
        (m.teamAId === awayId && m.teamBId === homeId),
    )
    return match ? { type: 'group', matchId: match.id } : null
  }

  const koMatchId = findKnockoutMatchIdByDate(date)
  return koMatchId ? { type: 'knockout', matchId: koMatchId } : null
}
