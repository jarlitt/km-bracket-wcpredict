import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock, type SupabaseMock } from '@/test/supabase-action-mock'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { loadPredictions, savePredictionDraft, submitPredictionsToDb } from './predictions'

function useUserClient(
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null,
): SupabaseMock {
  const mock = createSupabaseActionMock(user)
  createClientMock.mockResolvedValue(mock.client)
  return mock
}

function completeGroupPredictions(
  count: number,
): Record<number, { scoreA: number; scoreB: number }> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      index + 1,
      { scoreA: index % 5, scoreB: (index + 1) % 5 },
    ]),
  )
}

function knockoutPredictions(count: number): Record<string, number> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`match-${index + 1}`, index + 1]),
  )
}

function knockoutMatchups(count: number): Record<string, { teamAId: number | null; teamBId: number | null }> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `match-${index + 1}`,
      { teamAId: index + 1, teamBId: index + 101 },
    ]),
  )
}

function expectNoUpserts(client: SupabaseMock): void {
  expect(client.calls).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ method: 'upsert' })]),
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

function queuePoolResolution(client: SupabaseMock): void {
  client.queueResult({ data: { country: 'spain' }, error: null })
  client.queueResult({ data: { id: 'pool-1' }, error: null })
}

describe('prediction action guardrails', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for anonymous loadPredictions calls', async () => {
    useUserClient(null)

    await expect(loadPredictions()).resolves.toBeNull()

    expect(createClientMock).toHaveBeenCalledOnce()
  })

  it('loads saved knockout matchup snapshots with predictions', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({
      data: [{ match_id: 1, predicted_score_a: 2, predicted_score_b: 1 }],
      error: null,
    })
    client.queueResult({
      data: [{ match_id: 'R32-1', predicted_winner_id: 1, team_a_id: 1, team_b_id: 2 }],
      error: null,
    })
    client.queueResult({ data: { user_id: 'user-1' }, error: null })

    await expect(loadPredictions()).resolves.toEqual({
      groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
      knockoutPredictions: { 'R32-1': 1 },
      knockoutMatchups: { 'R32-1': { teamAId: 1, teamBId: 2 } },
      tieBreakResolutions: {},
      submitted: true,
    })
  })

  it('blocks non-members from saving prediction drafts', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)
    client.queueResult({ data: null, error: null })

    await expect(
      savePredictionDraft(completeGroupPredictions(1), knockoutPredictions(1)),
    ).resolves.toEqual({
      success: false,
      error: 'You are not a member of this pool',
    })

    expectMembershipScopedToUserAndPool(client)
    expectNoUpserts(client)
  })

  it('allows prediction draft edits after submission before first kickoff', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: null })

    await expect(
      savePredictionDraft(completeGroupPredictions(1), knockoutPredictions(1)),
    ).resolves.toEqual({ success: true })

    expectMembershipScopedToUserAndPool(client)
    expect(client.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'group_predictions', method: 'upsert' }),
        expect.objectContaining({ table: 'knockout_predictions', method: 'upsert' }),
      ]),
    )
  })

  it('blocks prediction draft edits after first kickoff', async () => {
    vi.setSystemTime(new Date('2026-06-11T19:00:00.000Z'))
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)

    await expect(
      savePredictionDraft(completeGroupPredictions(1), knockoutPredictions(1)),
    ).resolves.toEqual({
      success: false,
      error: 'Predictions are locked because the tournament has started',
    })

    expectNoUpserts(client)
  })

  it('blocks anonymous final submissions before database queries', async () => {
    useUserClient(null)

    await expect(
      submitPredictionsToDb(completeGroupPredictions(72), knockoutPredictions(32)),
    ).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })
  })

  it('blocks final submissions when auto-join finds a missing or inactive pool', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)
    client.queueResult({ data: null, error: null })
    client.queueResult({ data: null, error: null })

    await expect(
      submitPredictionsToDb(completeGroupPredictions(72), knockoutPredictions(32)),
    ).resolves.toEqual({
      success: false,
      error: 'Pool not found or inactive',
    })

    expectMembershipScopedToUserAndPool(client)
    expectNoUpserts(client)
  })

  it('blocks final submissions after first kickoff before database queries', async () => {
    vi.setSystemTime(new Date('2026-06-11T19:00:00.000Z'))
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)

    await expect(
      submitPredictionsToDb(completeGroupPredictions(72), knockoutPredictions(32)),
    ).resolves.toEqual({
      success: false,
      error: 'Predictions are locked because the tournament has started',
    })

    expectNoUpserts(client)
  })

  it('rejects incomplete final submissions before membership side effects', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)

    await expect(
      submitPredictionsToDb(completeGroupPredictions(71), knockoutPredictions(32)),
    ).resolves.toEqual({
      success: false,
      error: 'Expected 72 complete group predictions, got 71',
    })

    expectNoUpserts(client)
    expect(client.calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'pool_members', method: 'insert' }),
        expect.objectContaining({ table: 'submissions', method: 'insert' }),
      ]),
    )
  })

  it('propagates group prediction write errors during final submission', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({ error: { message: 'Group write failed' } })

    await expect(
      submitPredictionsToDb(completeGroupPredictions(72), knockoutPredictions(32)),
    ).resolves.toEqual({
      success: false,
      error: 'Failed to save group predictions: Group write failed',
    })

    expectMembershipScopedToUserAndPool(client)
    expect(client.calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'knockout_predictions', method: 'upsert' }),
        expect.objectContaining({ table: 'submissions', method: 'insert' }),
      ]),
    )
  })

  it('writes predictions and records complete final submissions', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: null })
    client.queueResult({ data: null, error: null })
    client.queueResult({ error: null })

    await expect(
      submitPredictionsToDb(
        completeGroupPredictions(72),
        knockoutPredictions(32),
        knockoutMatchups(32),
      ),
    ).resolves.toEqual({ success: true })

    expectMembershipScopedToUserAndPool(client)
    expect(client.calls).toContainEqual(
      expect.objectContaining({
        table: 'group_predictions',
        method: 'upsert',
        args: [
          expect.arrayContaining([
            expect.objectContaining({
              pool_id: 'pool-1',
              user_id: 'user-1',
              match_id: 1,
              predicted_score_a: 0,
              predicted_score_b: 1,
            }),
          ]),
          { onConflict: 'pool_id,user_id,match_id' },
        ],
      }),
    )
    expect(client.calls).toContainEqual(
      expect.objectContaining({
        table: 'knockout_predictions',
        method: 'upsert',
        args: [
          expect.arrayContaining([
            expect.objectContaining({
              pool_id: 'pool-1',
              user_id: 'user-1',
              match_id: 'match-1',
              team_a_id: 1,
              team_b_id: 101,
              predicted_winner_id: 1,
            }),
          ]),
          { onConflict: 'pool_id,user_id,match_id' },
        ],
      }),
    )
    expect(client.calls).toContainEqual(
      expect.objectContaining({
        table: 'submissions',
        method: 'insert',
        args: [
          expect.objectContaining({
            pool_id: 'pool-1',
            user_id: 'user-1',
            is_locked: true,
          }),
        ],
      }),
    )

    const groupUpsert = client.calls.find(
      (call) => call.table === 'group_predictions' && call.method === 'upsert',
    )
    const groupRows = groupUpsert?.args[0] as Array<Record<string, unknown>> | undefined
    expect(groupRows?.[0]).toEqual(
      expect.objectContaining({
        pool_id: 'pool-1',
        user_id: 'user-1',
        match_id: 1,
        predicted_score_a: 0,
        predicted_score_b: 1,
      }),
    )

    const knockoutUpsert = client.calls.find(
      (call) => call.table === 'knockout_predictions' && call.method === 'upsert',
    )
    const knockoutRows = knockoutUpsert?.args[0] as Array<Record<string, unknown>> | undefined
    expect(knockoutRows?.[0]).toEqual(
      expect.objectContaining({
        pool_id: 'pool-1',
        user_id: 'user-1',
        match_id: 'match-1',
        team_a_id: 1,
        team_b_id: 101,
        predicted_winner_id: 1,
      }),
    )
  })

  it('creates a missing profile before retrying pool auto-join', async () => {
    const client = useUserClient({
      id: 'user-1',
      email: 'jorge@example.com',
      user_metadata: { display_name: 'Jorge' },
    })
    queuePoolResolution(client)
    client.queueResult({ data: null, error: null })
    client.queueResult({ data: { id: 'pool-1', is_active: true }, error: null })
    client.queueResult({
      error: {
        code: '23503',
        message: 'insert or update on table "pool_members" violates foreign key constraint "pool_members_user_id_fkey"',
      },
    })
    client.queueResult({ error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: null })
    client.queueResult({ data: null, error: null })
    client.queueResult({ error: null })

    await expect(
      submitPredictionsToDb(
        completeGroupPredictions(72),
        knockoutPredictions(32),
        knockoutMatchups(32),
      ),
    ).resolves.toEqual({ success: true })

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

  it('submits without matchup storage when the database columns are not migrated yet', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({ error: null })
    client.queueResult({
      error: {
        message: "Could not find the 'team_a_id' column of 'knockout_predictions' in the schema cache",
      },
    })
    client.queueResult({ error: null })
    client.queueResult({ data: null, error: null })
    client.queueResult({ error: null })

    await expect(
      submitPredictionsToDb(
        completeGroupPredictions(72),
        knockoutPredictions(32),
        knockoutMatchups(32),
      ),
    ).resolves.toEqual({ success: true })

    const knockoutUpserts = client.calls.filter(
      (call) => call.table === 'knockout_predictions' && call.method === 'upsert',
    )
    expect(knockoutUpserts).toHaveLength(2)
    expect(knockoutUpserts[0].args[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ team_a_id: 1, team_b_id: 101 })]),
    )
    expect(knockoutUpserts[1].args[0]).toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({ team_a_id: expect.anything(), team_b_id: expect.anything() }),
      ]),
    )
  })

  it('updates prediction rows on existing submissions', async () => {
    const client = useUserClient({ id: 'user-1' })
    queuePoolResolution(client)
    client.queueResult({ data: { pool_id: 'pool-1' }, error: null })
    client.queueResult({ error: null })
    client.queueResult({ error: null })
    client.queueResult({ data: { user_id: 'user-1' }, error: null })

    await expect(
      submitPredictionsToDb(
        completeGroupPredictions(72),
        knockoutPredictions(32),
        knockoutMatchups(32),
      ),
    ).resolves.toEqual({ success: true })

    expect(client.calls).toEqual(
      expect.arrayContaining([
        { table: 'submissions', method: 'select', args: ['user_id'] },
        { table: 'submissions', method: 'eq', args: ['user_id', 'user-1'] },
        { table: 'submissions', method: 'eq', args: ['pool_id', 'pool-1'] },
      ]),
    )
    expect(client.calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'submissions', method: 'upsert' }),
        expect.objectContaining({ table: 'submissions', method: 'insert' }),
      ]),
    )
  })
})
