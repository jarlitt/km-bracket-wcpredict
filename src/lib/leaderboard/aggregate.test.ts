import { describe, expect, it } from 'vitest'
import { aggregateLeaderboard } from './aggregate'

const pools = [
  { id: 'pool-spain', slug: 'spain', name: 'Spain Office' },
  { id: 'pool-malta', slug: 'malta', name: 'Malta Office' },
]

const profiles = [
  { id: 'u1', display_name: 'Ana', country: 'spain' },
  { id: 'u2', display_name: 'Bea', country: 'spain' },
  { id: 'u3', display_name: 'Carl', country: 'malta' },
]

describe('aggregateLeaderboard', () => {
  it('ranks countries by average score and exposes secondary stats', () => {
    const result = aggregateLeaderboard(
      [
        { user_id: 'u1', pool_id: 'pool-spain', total_score: 100 },
        { user_id: 'u2', pool_id: 'pool-spain', total_score: 50 },
        { user_id: 'u3', pool_id: 'pool-malta', total_score: 90 },
      ],
      profiles,
      pools,
    )

    expect(result.countryStandings).toEqual([
      { slug: 'malta', name: 'Malta Office', avgScore: 90, totalScore: 90, memberCount: 1 },
      { slug: 'spain', name: 'Spain Office', avgScore: 75, totalScore: 150, memberCount: 2 },
    ])
  })

  it('includes countries with zero submitted members', () => {
    const result = aggregateLeaderboard([], profiles, pools)
    expect(result.countryStandings).toEqual([
      { slug: 'spain', name: 'Spain Office', avgScore: 0, totalScore: 0, memberCount: 0 },
      { slug: 'malta', name: 'Malta Office', avgScore: 0, totalScore: 0, memberCount: 0 },
    ])
  })

  it('ranks global players by score then display name', () => {
    const result = aggregateLeaderboard(
      [
        { user_id: 'u2', pool_id: 'pool-spain', total_score: 100 },
        { user_id: 'u1', pool_id: 'pool-spain', total_score: 100 },
        { user_id: 'u3', pool_id: 'pool-malta', total_score: 90 },
      ],
      profiles,
      pools,
    )

    expect(result.globalPlayers.map((p) => [p.rank, p.displayName, p.totalScore])).toEqual([
      [1, 'Ana', 100],
      [2, 'Bea', 100],
      [3, 'Carl', 90],
    ])
  })
})
