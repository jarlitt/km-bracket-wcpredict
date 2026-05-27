import { describe, expect, it } from 'vitest'
import type { UserPredictions, TeamStanding } from '@/types'
import { GROUPS, TEAMS } from '@/lib/data/teams'
import { calculateScore } from './calculate-score'

const teamById = (id: number) => {
  const team = TEAMS.find((t) => t.id === id)
  if (!team) throw new Error(`Unknown team ${id}`)
  return team
}

/** Empty per-group standings so position scoring is a no-op for these tests. */
function emptyStandings(): Record<string, TeamStanding[]> {
  const out: Record<string, TeamStanding[]> = {}
  for (const g of GROUPS) {
    out[g] = []
  }
  return out
}

describe('calculateScore', () => {
  it('awards 3 points for a correct outcome', () => {
    const predictions: UserPredictions = {
      groupPredictions: { 1: { scoreA: 2, scoreB: 0 } },
      knockoutPredictions: {},
      submitted: true,
    }
    const actual = {
      groupResults: { 1: { scoreA: 3, scoreB: 1 } },
      knockoutResults: {},
      actualGroupStandings: emptyStandings(),
    }
    const score = calculateScore(predictions, actual)
    expect(score.groupMatchPoints).toBe(3)
    expect(score.exactScoreBonus).toBe(0)
    expect(score.total).toBe(3)
  })

  it('awards 5 points (3 + 2) for an exact scoreline', () => {
    const predictions: UserPredictions = {
      groupPredictions: { 1: { scoreA: 3, scoreB: 1 } },
      knockoutPredictions: {},
      submitted: true,
    }
    const actual = {
      groupResults: { 1: { scoreA: 3, scoreB: 1 } },
      knockoutResults: {},
      actualGroupStandings: emptyStandings(),
    }
    const score = calculateScore(predictions, actual)
    expect(score.groupMatchPoints).toBe(3)
    expect(score.exactScoreBonus).toBe(2)
    expect(score.total).toBe(5)
  })

  it('awards no points for a wrong outcome even with the same total goals', () => {
    const predictions: UserPredictions = {
      groupPredictions: { 1: { scoreA: 1, scoreB: 2 } },
      knockoutPredictions: {},
      submitted: true,
    }
    const actual = {
      groupResults: { 1: { scoreA: 2, scoreB: 1 } },
      knockoutResults: {},
      actualGroupStandings: emptyStandings(),
    }
    expect(calculateScore(predictions, actual).total).toBe(0)
  })

  it('awards knockout points using the round-specific table', () => {
    const winner = teamById(1).id
    const predictions: UserPredictions = {
      groupPredictions: {},
      knockoutPredictions: {
        'R32-1': winner,
        'R16-1': winner,
        'QF-1': winner,
        'SF-1': winner,
        '3RD': winner,
        F: winner,
      },
      submitted: true,
    }
    const actual = {
      groupResults: {},
      knockoutResults: {
        'R32-1': winner,
        'R16-1': winner,
        'QF-1': winner,
        'SF-1': winner,
        '3RD': winner,
        F: winner,
      },
      actualGroupStandings: emptyStandings(),
    }
    const score = calculateScore(predictions, actual)
    // 2 + 4 + 6 + 8 + 5 + 15 = 40
    expect(score.knockoutPoints).toBe(40)
  })

  it('skips matches with missing results', () => {
    const predictions: UserPredictions = {
      groupPredictions: {
        1: { scoreA: 1, scoreB: 0 },
        2: { scoreA: 1, scoreB: 0 },
      },
      knockoutPredictions: {},
      submitted: true,
    }
    const actual = {
      groupResults: { 1: { scoreA: 1, scoreB: 0 } },
      knockoutResults: {},
      actualGroupStandings: emptyStandings(),
    }
    expect(calculateScore(predictions, actual).total).toBe(5)
  })
})
