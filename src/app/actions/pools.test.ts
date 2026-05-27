import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock, type SupabaseMock } from '@/test/supabase-action-mock'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { copyPredictionsBetweenPools, joinPool, leavePool } from './pools'

function useUserClient(
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null,
): SupabaseMock {
  const mock = createSupabaseActionMock(user)
  createClientMock.mockResolvedValue(mock.client)
  return mock
}

function expectNoInserts(client: SupabaseMock): void {
  expect(client.calls).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ method: 'insert' })]),
  )
}

function expectNoDeletes(client: SupabaseMock): void {
  expect(client.calls).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ method: 'delete' })]),
  )
}

function expectMembershipScopedToUserAndPool(client: SupabaseMock): void {
  expect(client.calls).toEqual(
    expect.arrayContaining([
      { table: 'pool_members', method: 'eq', args: ['pool_id', 'pool-1'] },
      { table: 'pool_members', method: 'eq', args: ['user_id', 'user-1'] },
    ]),
  )
}

function expectNoPredictionCalls(client: SupabaseMock): void {
  expect(client.client.from).not.toHaveBeenCalledWith('group_predictions')
  expect(client.client.from).not.toHaveBeenCalledWith('knockout_predictions')
}

describe('pool action guardrails', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires authentication before joining a pool', async () => {
    const client = useUserClient(null)

    await expect(joinPool('pool-1')).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })

    expect(createClientMock).toHaveBeenCalledOnce()
    expect(client.client.from).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'inactive',
      poolCheck: { data: { id: 'pool-1', is_active: false }, error: null },
    },
    {
      name: 'missing',
      poolCheck: { data: null, error: null },
    },
  ])('rejects $name pools before inserting membership', async ({ poolCheck }) => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult(poolCheck)

    await expect(joinPool('pool-1')).resolves.toEqual({
      success: false,
      error: 'Pool not found or inactive',
    })

    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'pools', method: 'select', args: ['id, is_active'] },
        { table: 'pools', method: 'eq', args: ['id', 'pool-1'] },
      ]),
    )
    expect(client.client.from).not.toHaveBeenCalledWith('pool_members')
    expectNoInserts(client)
  })

  it('rejects duplicate joins before inserting membership', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { id: 'pool-1', is_active: true }, error: null })
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })

    await expect(joinPool('pool-1')).resolves.toEqual({
      success: false,
      error: 'Already a member of this pool',
    })

    expectMembershipScopedToUserAndPool(client)
    expectNoInserts(client)
  })

  it('rejects copying from the destination pool before creating a Supabase client', async () => {
    await expect(
      joinPool('pool-1', { copyFromPoolId: 'pool-1' }),
    ).resolves.toEqual({
      success: false,
      error: 'Cannot copy from the same pool',
    })

    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('rejects replace-copying from the same pool before creating a Supabase client', async () => {
    await expect(copyPredictionsBetweenPools('pool-1', 'pool-1')).resolves.toEqual({
      success: false,
      error: 'Cannot copy from the same pool',
    })

    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('requires authentication before replace-copying predictions', async () => {
    const client = useUserClient(null)

    await expect(copyPredictionsBetweenPools('pool-2', 'pool-1')).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })

    expect(createClientMock).toHaveBeenCalledOnce()
    expect(client.client.from).not.toHaveBeenCalled()
  })

  it('blocks replace-copying predictions after first kickoff', async () => {
    vi.setSystemTime(new Date('2026-06-11T19:00:00.000Z'))
    const client = useUserClient({ id: 'user-1' })

    await expect(copyPredictionsBetweenPools('pool-2', 'pool-1')).resolves.toEqual({
      success: false,
      error: 'Predictions are locked because the tournament has started',
    })

    expect(client.client.from).not.toHaveBeenCalled()
  })

  it('requires membership in both source and destination pools before replacing predictions', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: null, error: null })

    await expect(copyPredictionsBetweenPools('pool-2', 'pool-1')).resolves.toEqual({
      success: false,
      error: 'You are not a member of the destination pool',
    })

    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'pool_members', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'pool_members', method: 'eq', args: ['user_id', 'user-1'] },
      ]),
    )
    expectNoPredictionCalls(client)
  })

  it('replaces destination predictions with source pool predictions', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({ data: { pool_id: 'pool-2' }, error: null })
    client.queueResult({
      data: [{ match_id: 7, predicted_score_a: 3, predicted_score_b: 2 }],
      error: null,
    })
    client.queueResult({
      data: [{ match_id: 'R32-1', predicted_winner_id: 5, team_a_id: 5, team_b_id: 6 }],
      error: null,
    })
    client.queueResult({ error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: null })

    await expect(copyPredictionsBetweenPools('pool-2', 'pool-1')).resolves.toEqual({
      success: true,
      data: { copiedGroup: 1, copiedKnockout: 1 },
    })

    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'group_predictions', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'knockout_predictions', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'group_predictions', method: 'insert', args: [
          [expect.objectContaining({
            pool_id: 'pool-1',
            user_id: 'user-1',
            match_id: 7,
            predicted_score_a: 3,
            predicted_score_b: 2,
          })],
        ] },
        { table: 'knockout_predictions', method: 'insert', args: [
          [expect.objectContaining({
            pool_id: 'pool-1',
            user_id: 'user-1',
            match_id: 'R32-1',
            team_a_id: 5,
            team_b_id: 6,
            predicted_winner_id: 5,
          })],
        ] },
      ]),
    )
  })

  it('rejects missing copy source membership before inserting membership', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { id: 'pool-1', is_active: true }, error: null })
    client.queueResult({ data: null, error: null })
    client.queueResult({ data: null, error: null })

    await expect(joinPool('pool-1', { copyFromPoolId: 'pool-2' })).resolves.toEqual({
      success: false,
      error: 'You are not a member of the source pool',
    })

    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'pool_members', method: 'eq', args: ['pool_id', 'pool-2'] },
        { table: 'pool_members', method: 'eq', args: ['user_id', 'user-1'] },
      ]),
    )
    expectNoInserts(client)
    expectNoPredictionCalls(client)
  })

  it('creates a missing profile before retrying pool join', async () => {
    const client = useUserClient({
      id: 'user-1',
      email: 'jorge@example.com',
      user_metadata: { display_name: 'Jorge' },
    })
    client.queueResult({ data: { id: 'pool-1', is_active: true }, error: null })
    client.queueResult({ data: null, error: null })
    client.queueResult({
      error: {
        code: '23503',
        message: 'insert or update on table "pool_members" violates foreign key constraint "pool_members_user_id_fkey"',
      },
    })
    client.queueResult({ error: null })
    client.queueResult({ error: null })

    await expect(joinPool('pool-1')).resolves.toEqual({
      success: true,
      data: { copiedGroup: 0, copiedKnockout: 0 },
    })

    expect(client.calls).toContainEqual({
      table: 'profiles',
      method: 'upsert',
      args: [
        {
          id: 'user-1',
          display_name: 'Jorge',
          avatar_url: null,
        },
        { onConflict: 'id' },
      ],
    })

    const membershipInserts = client.calls.filter(
      (call) => call.table === 'pool_members' && call.method === 'insert',
    )
    expect(membershipInserts).toHaveLength(2)
  })

  it('returns copy read errors before inserting destination membership', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { id: 'pool-1', is_active: true }, error: null })
    client.queueResult({ data: null, error: null })
    client.queueResult({ data: { pool_id: 'pool-2' }, error: null })
    client.queueResult({ data: null, error: { message: 'Source group read failed' } })
    client.queueResult({ data: [], error: null })

    await expect(joinPool('pool-1', { copyFromPoolId: 'pool-2' })).resolves.toEqual({
      success: false,
      error: 'Copy failed: Source group read failed',
    })

    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'group_predictions', method: 'eq', args: ['pool_id', 'pool-2'] },
        { table: 'knockout_predictions', method: 'eq', args: ['pool_id', 'pool-2'] },
      ]),
    )
    expect(client.calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'pool_members', method: 'insert' }),
        expect.objectContaining({ table: 'group_predictions', method: 'insert' }),
        expect.objectContaining({ table: 'knockout_predictions', method: 'insert' }),
      ]),
    )
  })

  it('cleans up destination rows when group copy insert fails after joining', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { id: 'pool-1', is_active: true }, error: null })
    client.queueResult({ data: null, error: null })
    client.queueResult({ data: { pool_id: 'pool-2' }, error: null })
    client.queueResult({
      data: [{ match_id: 1, predicted_score_a: 2, predicted_score_b: 1 }],
      error: null,
    })
    client.queueResult({ data: [], error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: { message: 'Group copy insert failed' } })
    client.queueResult({ error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: null })

    await expect(joinPool('pool-1', { copyFromPoolId: 'pool-2' })).resolves.toEqual({
      success: false,
      error: 'Copy failed: Group copy insert failed',
    })

    expect(client.calls).toEqual(
      expect.arrayContaining([
        {
          table: 'pool_members',
          method: 'insert',
          args: [{ pool_id: 'pool-1', user_id: 'user-1', role: 'member' }],
        },
        { table: 'group_predictions', method: 'delete', args: [] },
        { table: 'group_predictions', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'group_predictions', method: 'eq', args: ['user_id', 'user-1'] },
        { table: 'knockout_predictions', method: 'delete', args: [] },
        { table: 'knockout_predictions', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'knockout_predictions', method: 'eq', args: ['user_id', 'user-1'] },
        { table: 'pool_members', method: 'delete', args: [] },
        { table: 'pool_members', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'pool_members', method: 'eq', args: ['user_id', 'user-1'] },
      ]),
    )
  })

  it('requires authentication before leaving a pool', async () => {
    const client = useUserClient(null)

    await expect(leavePool('pool-1')).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })

    expect(createClientMock).toHaveBeenCalledOnce()
    expect(client.client.from).not.toHaveBeenCalled()
  })

  it('allows leaving after submission before first kickoff', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ error: null })

    await expect(leavePool('pool-1')).resolves.toEqual({
      success: true,
    })

    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'pool_members', method: 'delete', args: [] },
        { table: 'pool_members', method: 'eq', args: ['pool_id', 'pool-1'] },
        { table: 'pool_members', method: 'eq', args: ['user_id', 'user-1'] },
      ]),
    )
  })

  it('blocks leaving after first kickoff before deleting membership', async () => {
    vi.setSystemTime(new Date('2026-06-11T19:00:00.000Z'))
    const client = useUserClient({ id: 'user-1' })

    await expect(leavePool('pool-1')).resolves.toEqual({
      success: false,
      error: 'Pools are locked because the tournament has started',
    })

    expectNoDeletes(client)
  })
})
