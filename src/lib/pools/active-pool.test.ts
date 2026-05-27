import { describe, expect, it } from 'vitest'
import type { Pool, PoolMembership } from '@/types'
import { resolveActivePool, resolveActivePoolForContext } from './active-pool'

function pool(slug: string): Pool {
  return {
    id: `pool-${slug}`,
    name: slug,
    slug,
    type: 'office',
    visibility: 'public',
    isActive: true,
    createdAt: '2026-05-01T00:00:00Z',
  }
}

function membership(slug: string, joinedAt = '2026-05-01T00:00:00Z'): PoolMembership {
  return {
    pool: { ...pool(slug), createdAt: joinedAt },
    role: 'member',
    joinedAt,
  }
}

describe('resolveActivePool', () => {
  it('returns null when the user has no memberships', () => {
    expect(resolveActivePool([])).toBeNull()
    expect(resolveActivePool([], 'spain')).toBeNull()
  })

  it('returns the preferred slug when the user is a member of that pool', () => {
    const memberships = [membership('all-offices'), membership('spain')]
    expect(resolveActivePool(memberships, 'spain')?.pool.slug).toBe('spain')
  })

  it('falls back to the first membership when the preferred slug is unknown', () => {
    const memberships = [membership('all-offices'), membership('spain')]
    expect(resolveActivePool(memberships, 'malta')?.pool.slug).toBe('all-offices')
  })

  it('falls back to the first membership when no preferred slug is provided', () => {
    const memberships = [membership('spain'), membership('all-offices')]
    expect(resolveActivePool(memberships)?.pool.slug).toBe('spain')
    expect(resolveActivePool(memberships, null)?.pool.slug).toBe('spain')
  })
})

describe('resolveActivePoolForContext', () => {
  it('uses the URL slug before membership fallback on pool-scoped pages', () => {
    const memberships = [membership('spain')]
    const availablePools = [pool('spain'), pool('malta')]

    expect(
      resolveActivePoolForContext('malta', 'spain', memberships, availablePools)?.slug,
    ).toBe('malta')
  })

  it('uses the stored membership fallback outside pool-scoped pages', () => {
    const memberships = [membership('all-offices'), membership('spain')]
    const availablePools = [pool('malta')]

    expect(
      resolveActivePoolForContext(null, 'spain', memberships, availablePools)?.slug,
    ).toBe('spain')
  })
})
