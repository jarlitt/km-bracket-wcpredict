import type { KnockoutMatch, KnockoutMatchup } from '@/types'

const BRACKET_TREE: Record<string, { teamASource: string; teamBSource: string }> = {
  'R16-1': { teamASource: 'R32-1', teamBSource: 'R32-2' },
  'R16-2': { teamASource: 'R32-3', teamBSource: 'R32-4' },
  'R16-3': { teamASource: 'R32-5', teamBSource: 'R32-6' },
  'R16-4': { teamASource: 'R32-7', teamBSource: 'R32-8' },
  'R16-5': { teamASource: 'R32-9', teamBSource: 'R32-10' },
  'R16-6': { teamASource: 'R32-11', teamBSource: 'R32-12' },
  'R16-7': { teamASource: 'R32-13', teamBSource: 'R32-14' },
  'R16-8': { teamASource: 'R32-15', teamBSource: 'R32-16' },
  'QF-1': { teamASource: 'R16-1', teamBSource: 'R16-2' },
  'QF-2': { teamASource: 'R16-3', teamBSource: 'R16-4' },
  'QF-3': { teamASource: 'R16-5', teamBSource: 'R16-6' },
  'QF-4': { teamASource: 'R16-7', teamBSource: 'R16-8' },
  'SF-1': { teamASource: 'QF-1', teamBSource: 'QF-2' },
  'SF-2': { teamASource: 'QF-3', teamBSource: 'QF-4' },
  F: { teamASource: 'SF-1', teamBSource: 'SF-2' },
  '3RD': { teamASource: 'SF-1', teamBSource: 'SF-2' },
}

export function resolveKnockoutMatches(
  knockoutMatches: KnockoutMatch[],
  knockoutPredictions: Record<string, number>,
): KnockoutMatch[] {
  const matchMap = new Map<string, KnockoutMatch>()
  knockoutMatches.forEach((match) => matchMap.set(match.id, { ...match }))

  const getWinner = (matchId: string): number | null => knockoutPredictions[matchId] ?? null
  const getLoser = (matchId: string): number | null => {
    const match = matchMap.get(matchId)
    const winner = getWinner(matchId)
    if (!match || !winner) return null
    return winner === match.teamAId ? match.teamBId : match.teamAId
  }

  for (const [matchId, sources] of Object.entries(BRACKET_TREE)) {
    const match = matchMap.get(matchId)
    if (!match) continue

    if (matchId === '3RD') {
      match.teamAId = getLoser(sources.teamASource)
      match.teamBId = getLoser(sources.teamBSource)
    } else {
      match.teamAId = getWinner(sources.teamASource) ?? match.teamAId
      match.teamBId = getWinner(sources.teamBSource) ?? match.teamBId
    }
  }

  return Array.from(matchMap.values())
}

export function matchupsFromKnockoutMatches(
  matches: KnockoutMatch[],
): Record<string, KnockoutMatchup> {
  return Object.fromEntries(
    matches.map((match) => [
      match.id,
      { teamAId: match.teamAId, teamBId: match.teamBId },
    ]),
  )
}

export function applyKnockoutMatchups(
  matches: KnockoutMatch[],
  matchups: Record<string, KnockoutMatchup>,
): KnockoutMatch[] {
  if (Object.keys(matchups).length === 0) return matches

  return matches.map((match) => {
    const matchup = matchups[match.id]
    if (!matchup) return match
    return {
      ...match,
      teamAId: matchup.teamAId,
      teamBId: matchup.teamBId,
    }
  })
}
