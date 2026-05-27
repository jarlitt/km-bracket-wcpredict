/**
 * One-time script to fetch all World Cup 2026 fixtures from API-Football
 * and output corrected match data for src/lib/data/matches.ts.
 *
 * Usage:
 *   API_FOOTBALL_KEY=your_key npx tsx scripts/sync-fixtures.ts
 *
 * This script is NOT part of the app build — it's a local dev tool.
 */

const API_KEY = process.env.API_FOOTBALL_KEY
if (!API_KEY) {
  console.error('Set API_FOOTBALL_KEY environment variable')
  process.exit(1)
}

const BASE_URL = 'https://v3.football.api-sports.io'

// Our internal team IDs keyed by common name variations
const TEAM_NAME_TO_ID: Record<string, number> = {
  'Mexico': 1, 'South Africa': 2, 'Korea Republic': 3, 'South Korea': 3,
  'Czechia': 4, 'Czech Republic': 4,
  'Canada': 5, 'Bosnia and Herzegovina': 6, 'Bosnia & Herzegovina': 6,
  'Qatar': 7, 'Switzerland': 8,
  'Brazil': 9, 'Morocco': 10, 'Haiti': 11, 'Scotland': 12,
  'USA': 13, 'United States': 13, 'Paraguay': 14,
  'Australia': 15, 'Türkiye': 16, 'Turkey': 16,
  'Germany': 17, 'Curaçao': 18, 'Curacao': 18,
  'Côte d\'Ivoire': 19, 'Ivory Coast': 19, 'Cote D\'Ivoire': 19,
  'Ecuador': 20,
  'Netherlands': 21, 'Japan': 22, 'Sweden': 23, 'Tunisia': 24,
  'Belgium': 25, 'Egypt': 26, 'IR Iran': 27, 'Iran': 27,
  'New Zealand': 28,
  'Spain': 29, 'Cabo Verde': 30, 'Cape Verde': 30,
  'Saudi Arabia': 31, 'Uruguay': 32,
  'France': 33, 'Senegal': 34, 'Iraq': 35, 'Norway': 36,
  'Argentina': 37, 'Algeria': 38, 'Austria': 39, 'Jordan': 40,
  'Portugal': 41, 'Congo DR': 42, 'DR Congo': 42,
  'Uzbekistan': 43, 'Colombia': 44,
  'England': 45, 'Croatia': 46, 'Ghana': 47, 'Panama': 48,
}

const GROUP_ID_MAP: Record<string, string> = {
  'Group A': 'A', 'Group B': 'B', 'Group C': 'C', 'Group D': 'D',
  'Group E': 'E', 'Group F': 'F', 'Group G': 'G', 'Group H': 'H',
  'Group I': 'I', 'Group J': 'J', 'Group K': 'K', 'Group L': 'L',
}

interface ApiFixture {
  fixture: { id: number; date: string }
  league: { round: string }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: { home: number | null; away: number | null }
}

async function fetchFixtures(): Promise<ApiFixture[]> {
  const res = await fetch(`${BASE_URL}/fixtures?league=1&season=2026`, {
    headers: { 'x-apisports-key': API_KEY! },
  })
  const data = await res.json()
  return data.response
}

function resolveTeamId(name: string): number | null {
  return TEAM_NAME_TO_ID[name] ?? null
}

async function main() {
  const fixtures = await fetchFixtures()
  const groupFixtures = fixtures.filter(f => f.league.round.startsWith('Group'))

  // Sort by group then by date
  groupFixtures.sort((a, b) => {
    const groupA = GROUP_ID_MAP[a.league.round] ?? ''
    const groupB = GROUP_ID_MAP[b.league.round] ?? ''
    if (groupA !== groupB) return groupA.localeCompare(groupB)
    return new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime()
  })

  const groupCounters: Record<string, number> = {}
  const MATCHES_PER_GROUP = 6

  console.log('export const GROUP_MATCHES: GroupMatch[] = [')

  for (const f of groupFixtures) {
    const groupId = GROUP_ID_MAP[f.league.round]
    if (!groupId) { console.error('Unknown round:', f.league.round); continue }

    const teamAId = resolveTeamId(f.teams.home.name)
    const teamBId = resolveTeamId(f.teams.away.name)

    if (!teamAId || !teamBId) {
      console.error(`Unknown team: "${f.teams.home.name}" or "${f.teams.away.name}"`)
      continue
    }

    groupCounters[groupId] = (groupCounters[groupId] ?? 0) + 1
    const matchNumberInGroup = groupCounters[groupId]
    const groupIndex = groupId.charCodeAt(0) - 'A'.charCodeAt(0)
    const matchId = groupIndex * MATCHES_PER_GROUP + matchNumberInGroup

    const utc = new Date(f.fixture.date)
    const day = utc.getUTCDate()
    const month = utc.toLocaleString('en', { month: 'short', timeZone: 'UTC' })
    const hours = String(utc.getUTCHours()).padStart(2, '0')
    const mins = String(utc.getUTCMinutes()).padStart(2, '0')

    console.log(
      `  { id: ${matchId}, groupId: '${groupId}', teamAId: ${teamAId}, teamBId: ${teamBId}, ` +
      `matchNumber: ${matchNumberInGroup}, date: '${day} ${month}', time: '${hours}:${mins}' },`
    )
  }

  console.log('];')
  console.log(`\n// ${groupFixtures.length} group fixtures processed`)

  // Also output the API-Football team ID mapping for the sync-results route
  console.log('\n// API-Football team ID → internal ID mapping:')
  const apiTeamIds = new Map<number, string>()
  for (const f of fixtures) {
    apiTeamIds.set(f.teams.home.id, f.teams.home.name)
    apiTeamIds.set(f.teams.away.id, f.teams.away.name)
  }
  console.log('export const API_TEAM_ID_TO_INTERNAL: Record<number, number> = {')
  for (const [apiId, name] of apiTeamIds) {
    const internalId = resolveTeamId(name)
    if (internalId) {
      console.log(`  ${apiId}: ${internalId}, // ${name}`)
    }
  }
  console.log('};')
}

main().catch(console.error)
