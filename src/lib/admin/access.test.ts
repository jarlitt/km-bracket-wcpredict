import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock, type SupabaseMock } from '@/test/supabase-action-mock'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { getAdminAccess, requireAdminUser } from './access'

function useUserClient(user: { id: string } | null): SupabaseMock {
  const mock = createSupabaseActionMock(user)
  createClientMock.mockResolvedValue(mock.client)
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

describe('admin access', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('returns unauthenticated access without querying profiles', async () => {
    const client = useUserClient(null)

    await expect(getAdminAccess()).resolves.toEqual({
      ok: false,
      reason: 'not_authenticated',
    })

    expect(client.client.from).not.toHaveBeenCalled()
  })

  it('returns non-admin access when the profile is not an admin', async () => {
    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { is_admin: false }, error: null })

    await expect(getAdminAccess()).resolves.toEqual({
      ok: false,
      reason: 'not_admin',
    })

    expectProfileAdminCheck(client, 'user-1')
  })

  it('returns the user id for admins', async () => {
    const client = useUserClient({ id: 'admin-1' })
    client.queueResult({ data: { is_admin: true }, error: null })

    await expect(getAdminAccess()).resolves.toEqual({
      ok: true,
      userId: 'admin-1',
    })

    expectProfileAdminCheck(client, 'admin-1')
  })

  it('throws the same errors expected by admin server actions', async () => {
    useUserClient(null)
    await expect(requireAdminUser()).rejects.toThrow('Not authenticated')

    const client = useUserClient({ id: 'user-1' })
    client.queueResult({ data: { is_admin: false }, error: null })
    await expect(requireAdminUser()).rejects.toThrow('Not an admin')
  })
})
