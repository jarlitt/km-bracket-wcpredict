import { describe, expect, it } from 'vitest'
import {
  buildGroupCopyRows,
  buildKnockoutCopyRows,
} from './copy-predictions'

describe('buildGroupCopyRows', () => {
  it('reassigns each row to the destination pool while preserving the prediction', () => {
    const rows = buildGroupCopyRows(
      [
        { match_id: 1, predicted_score_a: 2, predicted_score_b: 1 },
        { match_id: 2, predicted_score_a: 0, predicted_score_b: 0 },
      ],
      {
        destinationPoolId: 'dest-pool',
        userId: 'user-1',
        now: new Date('2026-06-01T00:00:00Z'),
      },
    )

    expect(rows).toEqual([
      {
        pool_id: 'dest-pool',
        user_id: 'user-1',
        match_id: 1,
        predicted_score_a: 2,
        predicted_score_b: 1,
        updated_at: '2026-06-01T00:00:00.000Z',
      },
      {
        pool_id: 'dest-pool',
        user_id: 'user-1',
        match_id: 2,
        predicted_score_a: 0,
        predicted_score_b: 0,
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ])
  })

  it('returns an empty list when the source pool has no predictions', () => {
    expect(
      buildGroupCopyRows([], { destinationPoolId: 'dest', userId: 'u' }),
    ).toEqual([])
  })
})

describe('buildKnockoutCopyRows', () => {
  it('copies knockout picks into the destination pool', () => {
    const rows = buildKnockoutCopyRows(
      [
        { match_id: 'R32-1', predicted_winner_id: 10, team_a_id: 10, team_b_id: 11 },
        { match_id: 'F', predicted_winner_id: 29, team_a_id: 29, team_b_id: 31 },
      ],
      {
        destinationPoolId: 'dest-pool',
        userId: 'user-1',
        now: new Date('2026-06-01T00:00:00Z'),
      },
    )

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      pool_id: 'dest-pool',
      user_id: 'user-1',
      match_id: 'R32-1',
      team_a_id: 10,
      team_b_id: 11,
      predicted_winner_id: 10,
    })
    expect(rows[1]).toMatchObject({
      pool_id: 'dest-pool',
      match_id: 'F',
      team_a_id: 29,
      team_b_id: 31,
      predicted_winner_id: 29,
    })
  })
})
