import { describe, expect, it } from 'vitest'
import type { Team, TeamStanding } from '@/types'
import {
  determineBestThirdPlaceTeams,
  findQualificationRelevantThirdPlaceTies,
  findUnresolvedThirdPlaceTies,
} from './best-third'
import { tieBreakResolutionKey } from './calculate-standings'

function team(id: number, name: string, groupId: string, fifaRanking: number): Team {
  return {
    id,
    name,
    code: name.slice(0, 3).toUpperCase(),
    flag: '',
    flagSlug: name.toLowerCase(),
    groupId,
    fifaRanking,
  }
}

function standing(teamValue: Team, points: number, goalDifference: number, goalsFor: number): TeamStanding {
  return {
    team: teamValue,
    played: 3,
    won: 0,
    drawn: points,
    lost: 3 - points,
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
    goalDifference,
    points,
  }
}

describe('determineBestThirdPlaceTeams', () => {
  it('detects third-place teams tied after score-based criteria', () => {
    const allGroupStandings = {
      A: [standing(team(101, 'A1', 'A', 1), 9, 3, 3), standing(team(102, 'A2', 'A', 2), 6, 2, 2), standing(team(1, 'A3', 'A', 10), 4, 0, 2)],
      B: [standing(team(201, 'B1', 'B', 3), 9, 3, 3), standing(team(202, 'B2', 'B', 4), 6, 2, 2), standing(team(2, 'B3', 'B', 20), 4, 0, 2)],
    }

    expect(findUnresolvedThirdPlaceTies(allGroupStandings)).toEqual([
      {
        groupId: 'third-place',
        key: tieBreakResolutionKey('third-place', 'all', [1, 2]),
        teamIds: [1, 2],
      },
    ])
  })

  it('uses manual resolution before FIFA ranking for third-place ties', () => {
    const allGroupStandings = {
      A: [standing(team(101, 'A1', 'A', 1), 9, 3, 3), standing(team(102, 'A2', 'A', 2), 6, 2, 2), standing(team(1, 'A3', 'A', 10), 4, 0, 2)],
      B: [standing(team(201, 'B1', 'B', 3), 9, 3, 3), standing(team(202, 'B2', 'B', 4), 6, 2, 2), standing(team(2, 'B3', 'B', 20), 4, 0, 2)],
    }

    const result = determineBestThirdPlaceTeams(allGroupStandings, {
      tieBreakResolutions: {
        [tieBreakResolutionKey('third-place', 'all', [1, 2])]: [2, 1],
      },
    })

    expect(result.allThirdPlaceTeams.map((entry) => entry.standing.team.id)).toEqual([2, 1])
  })

  it('only marks third-place ties crossing the qualification cutoff as relevant', () => {
    const allGroupStandings = Object.fromEntries(
      'ABCDEFGHIJKL'.split('').map((groupId, index) => {
        const top = standing(team(100 + index, `${groupId}1`, groupId, 1), 9, 3, 3)
        const second = standing(team(200 + index, `${groupId}2`, groupId, 2), 6, 2, 2)
        const third =
          groupId === 'A' || groupId === 'B'
            ? standing(team(300 + index, `${groupId}3`, groupId, 50 + index), 5, 1, 4)
            : groupId === 'H' || groupId === 'I'
              ? standing(team(300 + index, `${groupId}3`, groupId, 50 + index), 2, -1, 3)
              : standing(team(300 + index, `${groupId}3`, groupId, 50 + index), 4 - Math.floor(index / 3), 0, 2)

        return [groupId, [top, second, third]]
      }),
    )

    const relevantTies = findQualificationRelevantThirdPlaceTies(allGroupStandings)

    expect(relevantTies).toHaveLength(1)
    expect(relevantTies[0].teamIds).toEqual([307, 308])
  })
})
