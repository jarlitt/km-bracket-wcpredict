import { describe, expect, it } from 'vitest'
import type { Team, TeamStanding } from '@/types'
import { generateKnockoutBracket } from './bracket-structure'

function team(id: number, groupId: string): Team {
  return {
    id,
    name: `${groupId}${id}`,
    code: `${groupId}${id}`,
    flag: '',
    flagSlug: `${groupId}${id}`,
    groupId,
    fifaRanking: id,
  }
}

function standing(groupId: string, position: number): TeamStanding {
  return {
    team: team(groupId.charCodeAt(0) * 10 + position, groupId),
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }
}

function standings(): Record<string, TeamStanding[]> {
  return Object.fromEntries(
    'ABCDEFGHIJKL'.split('').map((groupId) => [
      groupId,
      [standing(groupId, 1), standing(groupId, 2), standing(groupId, 3)],
    ]),
  )
}

describe('generateKnockoutBracket', () => {
  it('places best-third teams by the qualified-groups mapping, not ranking order', () => {
    const allStandings = standings()
    const rankedThirds = 'ABCDEFGH'
      .split('')
      .map((groupId) => allStandings[groupId][2])

    const matches = generateKnockoutBracket(
      allStandings,
      rankedThirds.map((entry) => entry.team.groupId),
      rankedThirds,
    )

    expect(matches.find((match) => match.id === 'R32-11')?.teamBId).toBe(allStandings.H[2].team.id)
    expect(matches.find((match) => match.id === 'R32-12')?.teamBId).toBe(allStandings.E[2].team.id)

    const swappedThirds = [...rankedThirds]
    ;[swappedThirds[4], swappedThirds[5]] = [swappedThirds[5], swappedThirds[4]]
    const swappedMatches = generateKnockoutBracket(
      allStandings,
      swappedThirds.map((entry) => entry.team.groupId),
      swappedThirds,
    )

    expect(swappedMatches.find((match) => match.id === 'R32-11')?.teamBId).toBe(allStandings.H[2].team.id)
    expect(swappedMatches.find((match) => match.id === 'R32-12')?.teamBId).toBe(allStandings.E[2].team.id)
  })
})
