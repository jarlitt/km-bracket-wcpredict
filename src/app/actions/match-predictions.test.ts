import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock, type SupabaseMock } from '@/test/supabase-action-mock'

const { createClientMock, isTournamentLockedAsyncMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  isTournamentLockedAsyncMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/matches/lock-server', () => ({
  isTournamentLockedAsync: isTournamentLockedAsyncMock,
}))

import { getMatchPredictions } from './match-predictions'

function useUserClient(user: { id: string } | null): SupabaseMock {
  const mock = createSupabaseActionMock(user)
  createClientMock.mockResolvedValue(mock.client)
  return mock
}

function expectMembershipScopedToUserAndPool(client: SupabaseMock): void {
  expect(client.calls).toEqual(
    expect.arrayContaining([
      { table: 'pool_members', method: 'eq', args: ['pool_id', 'pool-1'] },
      { table: 'pool_members', method: 'eq', args: ['user_id', 'user-1'] },
    ]),
  )
}

function expectNoPredictionReads(client: SupabaseMock): void {
  expect(client.client.from).not.toHaveBeenCalledWith('group_predictions')
  expect(client.client.from).not.toHaveBeenCalledWith('knockout_predictions')
}

function expectMemberListScopedToPool(client: SupabaseMock): void {
  const memberListSelectIndex = client.calls.findIndex(
    (call) =>
      call.table === 'pool_members' &&
      call.method === 'select' &&
      call.args[0] === 'user_id, profile:profiles(display_name)',
  )

  expect(memberListSelectIndex).toBeGreaterThanOrEqual(0)
  expect(client.calls[memberListSelectIndex + 1]).toEqual({
    table: 'pool_members',
    method: 'eq',
    args: ['pool_id', 'pool-1'],
  })
}

describe('match prediction access guardrails', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    isTournamentLockedAsyncMock.mockResolvedValue(false)
  })

  it('returns null for missing pools before creating a Supabase client', async () => {
    await expect(getMatchPredictions('group', 1, '')).resolves.toBeNull()

    expect(createClientMock).not.toHaveBeenCalled()
  })

  it.each([
    { type: 'group' as const, matchId: 1 },
    { type: 'knockout' as const, matchId: 'R32-1' },
  ])('returns null for anonymous $type users before table reads', async ({ matchId, type }) => {
    const client = useUserClient(null)

    await expect(getMatchPredictions(type, matchId, 'pool-1')).resolves.toBeNull()

    expect(createClientMock).toHaveBeenCalledOnce()
    expect(client.client.from).not.toHaveBeenCalled()
  })

  it.each([
    { type: 'group' as const, matchId: 1 },
    { type: 'knockout' as const, matchId: 'R32-1' },
  ])('returns null for authenticated non-members before reading $type predictions', async ({
    matchId,
    type,
  }) => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: null, error: null })

    await expect(getMatchPredictions(type, matchId, 'pool-1')).resolves.toBeNull()

    expectMembershipScopedToUserAndPool(client)
    expectNoPredictionReads(client)
    expect(client.client.from).not.toHaveBeenCalledWith('actual_group_results')
    expect(client.client.from).not.toHaveBeenCalledWith('actual_knockout_results')
  })

  it('returns group predictions for authorized members', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({
      data: [{ user_id: 'user-1', profile: { display_name: 'Jorge' } }],
      error: null,
    })
    client.queueResult({ data: { score_a: 2, score_b: 1 }, error: null })
    client.queueResult({
      data: [{ user_id: 'user-1', predicted_score_a: 2, predicted_score_b: 1 }],
      error: null,
    })

    await expect(getMatchPredictions('group', 1, 'pool-1')).resolves.toEqual(
      expect.objectContaining({
        type: 'group',
        matchId: 1,
        actualScoreA: 2,
        actualScoreB: 1,
        predictions: [
          expect.objectContaining({
            userId: 'user-1',
            displayName: 'Jorge',
            predictedScoreA: 2,
            predictedScoreB: 1,
            points: 5,
            exactScore: true,
          }),
        ],
      }),
    )

    expectMemberListScopedToPool(client)
    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'group_predictions', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'group_predictions', method: 'eq', args: ['match_id', 1] },
      ]),
    )
  })

  it('returns knockout predictions for authorized members', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({
      data: [{ user_id: 'user-1', profile: { display_name: 'Jorge' } }],
      error: null,
    })
    client.queueResult({ data: { winner_id: 1 }, error: null })
    client.queueResult({
      data: [{ user_id: 'user-1', predicted_winner_id: 1 }],
      error: null,
    })

    await expect(getMatchPredictions('knockout', 'R32-1', 'pool-1')).resolves.toEqual(
      expect.objectContaining({
        type: 'knockout',
        matchId: 'R32-1',
        pointsPerWin: 2,
        actualWinnerId: 1,
        actualWinnerName: 'Mexico',
        predictions: [
          expect.objectContaining({
            userId: 'user-1',
            displayName: 'Jorge',
            predictedWinnerId: 1,
            predictedWinnerName: 'Mexico',
            points: 2,
            correct: true,
          }),
        ],
      }),
    )

    expectMemberListScopedToPool(client)
    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'knockout_predictions', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'knockout_predictions', method: 'eq', args: ['match_id', 'R32-1'] },
      ]),
    )
  })
})
