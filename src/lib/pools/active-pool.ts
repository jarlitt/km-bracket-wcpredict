import type { Pool, PoolMembership } from '@/types'

/**
 * Choose which pool should be active for the current user, given the list of
 * pools they are a member of and an optional preferred slug (from cookie or
 * localStorage). Preference order:
 *   1. Preferred slug, if the user is a member of that pool
 *   2. First membership in the list (already sorted by joined date by callers)
 *   3. null when the user has no memberships
 */
export function resolveActivePool(
  memberships: PoolMembership[],
  preferredSlug?: string | null,
): PoolMembership | null {
  if (memberships.length === 0) return null
  if (preferredSlug) {
    const match = memberships.find((m) => m.pool.slug === preferredSlug)
    if (match) return match
  }
  return memberships[0]
}

export function resolveActivePoolForContext(
  urlSlug: string | null,
  storedSlug: string | null,
  memberships: PoolMembership[],
  availablePools: Pool[],
): Pool | null {
  if (urlSlug) {
    const fromUrl = availablePools.find((pool) => pool.slug === urlSlug)
    if (fromUrl) return fromUrl
  }

  const fromMembership = resolveActivePool(memberships, storedSlug)?.pool
  if (fromMembership) return fromMembership

  if (storedSlug) {
    return availablePools.find((pool) => pool.slug === storedSlug) ?? null
  }

  return null
}

export const ACTIVE_POOL_STORAGE_KEY = 'wc2026-active-pool-slug'

export function readActivePoolSlug(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACTIVE_POOL_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeActivePoolSlug(slug: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (slug) {
      window.localStorage.setItem(ACTIVE_POOL_STORAGE_KEY, slug)
    } else {
      window.localStorage.removeItem(ACTIVE_POOL_STORAGE_KEY)
    }
  } catch {
    // ignore quota / private-mode failures
  }
}
