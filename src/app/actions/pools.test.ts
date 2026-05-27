import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseActionMock } from '@/test/supabase-action-mock'

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

import { getPoolBySlug, listAvailablePools } from './pools'

describe('pool actions', () => {
  beforeEach(() => {
    createClientMock.mockReset()
  })

  it('listAvailablePools returns an array of pools', async () => {
    const mock = createSupabaseActionMock(null)
    createClientMock.mockResolvedValue(mock.client)
    mock.queueResult({
      data: [
        {
          id: 'pool-1',
          name: 'Pool One',
          slug: 'pool-one',
          type: 'office',
          visibility: 'public',
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    })

    const pools = await listAvailablePools()
    expect(pools).toEqual([
      expect.objectContaining({ id: 'pool-1', slug: 'pool-one', isActive: true }),
    ])
  })

  it('listAvailablePools returns empty array on error', async () => {
    const mock = createSupabaseActionMock(null)
    createClientMock.mockResolvedValue(mock.client)
    mock.queueResult({ data: null, error: { message: 'fail' } })

    const pools = await listAvailablePools()
    expect(pools).toEqual([])
  })

  it('getPoolBySlug returns a pool when found', async () => {
    const mock = createSupabaseActionMock(null)
    createClientMock.mockResolvedValue(mock.client)
    mock.queueResult({
      data: {
        id: 'pool-1',
        name: 'Pool One',
        slug: 'pool-one',
        type: 'office',
        visibility: 'public',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    })

    const pool = await getPoolBySlug('pool-one')
    expect(pool).toEqual(
      expect.objectContaining({ id: 'pool-1', slug: 'pool-one' }),
    )
  })

  it('getPoolBySlug returns null when not found', async () => {
    const mock = createSupabaseActionMock(null)
    createClientMock.mockResolvedValue(mock.client)
    mock.queueResult({ data: null, error: null })

    const pool = await getPoolBySlug('nonexistent')
    expect(pool).toBeNull()
  })
})
