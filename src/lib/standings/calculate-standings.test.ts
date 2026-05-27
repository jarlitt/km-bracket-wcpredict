import { describe, expect, it } from 'vitest'
import {
  calculateGroupStandings,
  findUnresolvedGroupTies,
  tieBreakResolutionKey,
} from './calculate-standings'
import { getMatchesByGroup } from '@/lib/data/matches'

describe('calculateGroupStandings', () => {
  it('returns 4 teams with zeroed stats when there are no predictions', () => {
    const standings = calculateGroupStandings('A', {})
    expect(standings).toHaveLength(4)
    for (const s of standings) {
      expect(s.played).toBe(0)
      expect(s.points).toBe(0)
    }
  })

  it('ranks the team with three wins above the field', () => {
    const predictions: Record<number, { scoreA: number; scoreB: number }> = {}
    const matches = getMatchesByGroup('A')
    const winnerId = 1
    for (const m of matches) {
      if (m.teamAId === winnerId) {
        predictions[m.id] = { scoreA: 2, scoreB: 0 }
      } else if (m.teamBId === winnerId) {
        predictions[m.id] = { scoreA: 0, scoreB: 2 }
      } else {
        predictions[m.id] = { scoreA: 0, scoreB: 0 }
      }
    }
    const standings = calculateGroupStandings('A', predictions)
    expect(standings[0].team.id).toBe(winnerId)
    expect(standings[0].won).toBe(3)
    expect(standings[0].points).toBe(9)
    expect(standings[0].goalsFor).toBe(6)
    expect(standings[0].goalsAgainst).toBe(0)
  })

  it('ignores predictions where either score is missing', () => {
    const matches = getMatchesByGroup('A')
    const partial: Record<number, { scoreA?: number; scoreB?: number }> = {
      [matches[0].id]: { scoreA: 1 },
    }
    const standings = calculateGroupStandings('A', partial)
    for (const s of standings) {
      expect(s.played).toBe(0)
    }
  })

  it('uses head-to-head points before overall goal difference for tied teams', () => {
    const predictions: Record<number, { scoreA: number; scoreB: number }> = {
      1: { scoreA: 1, scoreB: 0 }, // Mexico beats South Africa head-to-head
      2: { scoreA: 0, scoreB: 0 },
      3: { scoreA: 0, scoreB: 4 },
      4: { scoreA: 0, scoreB: 3 },
      5: { scoreA: 0, scoreB: 1 },
      6: { scoreA: 1, scoreB: 0 },
    }

    const standings = calculateGroupStandings('A', predictions)

    expect(standings[0].team.name).toBe('Mexico')
    expect(standings[1].team.name).toBe('South Africa')
    expect(standings[0].points).toBe(standings[1].points)
    expect(standings[0].goalDifference).toBeLessThan(standings[1].goalDifference)
  })

  it('detects teams that are still tied after score-based FIFA criteria', () => {
    const predictions = Object.fromEntries(
      getMatchesByGroup('A').map((match) => [match.id, { scoreA: 0, scoreB: 0 }]),
    )

    const unresolvedTies = findUnresolvedGroupTies('A', predictions)

    expect(unresolvedTies).toEqual([
      {
        groupId: 'A',
        key: tieBreakResolutionKey('group', 'A', [1, 2, 3, 4]),
        teamIds: [1, 2, 3, 4],
      },
    ])
  })

  it('uses manual tie resolution before FIFA ranking for unresolved score ties', () => {
    const predictions = Object.fromEntries(
      getMatchesByGroup('A').map((match) => [match.id, { scoreA: 0, scoreB: 0 }]),
    )
    const tieBreakResolutions = {
      [tieBreakResolutionKey('group', 'A', [1, 2, 3, 4])]: [2, 4, 3, 1],
    }

    const standings = calculateGroupStandings('A', predictions, { tieBreakResolutions })

    expect(standings.map((standing) => standing.team.id)).toEqual([2, 4, 3, 1])
  })
})
