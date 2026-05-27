import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock, type SupabaseMock } from '@/test/supabase-action-mock'

const { createClientMock, createAdminClientMock, recalculateAllScoresMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    createAdminClientMock: vi.fn(),
    recalculateAllScoresMock: vi.fn(),
  }),
)

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}))

vi.mock('@/lib/scoring/recalculate', () => ({
  recalculateAllScores: recalculateAllScoresMock,
}))

import { getAdminStats, saveGroupResult } from './admin'

function useUserClient(user: { id: string } | null): SupabaseMock {
  const mock = createSupabaseActionMock(user)
  createClientMock.mockResolvedValue(mock.client)
  return mock
}

function useAdminClient(): SupabaseMock {
  const mock = createSupabaseActionMock(null)
  createAdminClientMock.mockReturnValue(mock.client)
  return mock
}

function expectProfileAdminCheck(client: SupabaseMock, userId: string): void {
  expect(client.calls).toEqual(
    expect.arrayContaining([
      { table: 'profiles', method: 'select', args: ['is_admin'] },
      { table: 'profiles', method: 'eq', args: ['id', userId] },
      { table: 'profiles', method: 'single', args: [] },
    ]),
  )
}

describe('admin action security', () => {
  beforeEach(() => {
    createClientMock.mockReset()
    createAdminClientMock.mockReset()
    recalculateAllScoresMock.mockReset()
  })

  it('blocks anonymous saveGroupResult calls before creating an admin client', async () => {
    useUserClient(null)

    await expect(saveGroupResult(1, 2, 0)).resolves.toEqual({
      success: false,
      error: 'Not authenticated',
    })

    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('blocks non-admin saveGroupResult calls before creating an admin client', async () => {
    const userClient = useUserClient({ id: 'user-1' })
    userClient.queueResult({ data: { is_admin: false }, error: null })

    await expect(saveGroupResult(1, 2, 0)).resolves.toEqual({
      success: false,
      error: 'Not an admin',
    })

    expectProfileAdminCheck(userClient, 'user-1')
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('allows admin saveGroupResult calls and writes through the admin client', async () => {
    const userClient = useUserClient({ id: 'admin-1' })
    const adminClient = useAdminClient()
    userClient.queueResult({ data: { is_admin: true }, error: null })
    adminClient.queueResult({ error: null })

    await expect(saveGroupResult(12, 3, 1)).resolves.toEqual({ success: true })

    expect(createAdminClientMock).toHaveBeenCalledOnce()
    expect(adminClient.calls).toContainEqual({
      table: 'actual_group_results',
      method: 'upsert',
      args: [
        expect.objectContaining({
          match_id: 12,
          score_a: 3,
          score_b: 1,
          updated_at: expect.any(String),
        }),
        { onConflict: 'match_id' },
      ],
    })
  })

  it('requires admin access before getAdminStats creates an admin client', async () => {
    useUserClient(null)

    await expect(getAdminStats()).rejects.toThrow('Not authenticated')
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('blocks non-admin getAdminStats calls before creating an admin client', async () => {
    const userClient = useUserClient({ id: 'user-1' })
    userClient.queueResult({ data: { is_admin: false }, error: null })

    await expect(getAdminStats()).rejects.toThrow('Not an admin')
    expectProfileAdminCheck(userClient, 'user-1')
    expect(createAdminClientMock).not.toHaveBeenCalled()
  })

  it('allows admin getAdminStats calls and returns aggregate pool stats', async () => {
    const userClient = useUserClient({ id: 'admin-1' })
    const adminClient = useAdminClient()
    userClient.queueResult({ data: { is_admin: true }, error: null })
    adminClient.queueResult({ count: 3, data: null, error: null })
    adminClient.queueResult({ count: 2, data: null, error: null })
    adminClient.queueResult({ count: 10, data: null, error: null })
    adminClient.queueResult({ count: 4, data: null, error: null })
    adminClient.queueResult({
      data: [{ id: 'pool-1', name: 'Main Pool', slug: 'main', is_active: true }],
      error: null,
    })
    adminClient.queueResult({
      data: [{ pool_id: 'pool-1' }, { pool_id: 'pool-1' }],
      error: null,
    })
    adminClient.queueResult({ data: [{ pool_id: 'pool-1' }], error: null })

    await expect(getAdminStats()).resolves.toEqual({
      totalUsers: 3,
      totalSubmissions: 2,
      groupResultsEntered: 10,
      knockoutResultsEntered: 4,
      pools: [
        {
          id: 'pool-1',
          name: 'Main Pool',
          slug: 'main',
          members: 2,
          submissions: 1,
        },
      ],
    })

    expectProfileAdminCheck(userClient, 'admin-1')
    expect(createAdminClientMock).toHaveBeenCalledOnce()
  })
})
