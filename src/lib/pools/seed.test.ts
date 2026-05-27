import { describe, expect, it } from 'vitest'
import { PHASE_1_POOLS, PHASE_1_POOL_SLUGS, isOfficePoolSlug } from './seed'

describe('PHASE_1_POOLS', () => {
  it('seeds the seven office pools requested for Phase 1', () => {
    expect(PHASE_1_POOL_SLUGS).toEqual([
      'all-offices',
      'spain',
      'malta',
      'nigeria',
      'south-africa',
      'zambia',
      'uk',
    ])
  })

  it('uses unique slugs', () => {
    const unique = new Set(PHASE_1_POOL_SLUGS)
    expect(unique.size).toBe(PHASE_1_POOL_SLUGS.length)
  })

  it('marks every seeded pool as a public office pool', () => {
    for (const pool of PHASE_1_POOLS) {
      expect(pool.type).toBe('office')
      expect(pool.visibility).toBe('public')
    }
  })
})

describe('isOfficePoolSlug', () => {
  it('returns true for seeded office slugs', () => {
    expect(isOfficePoolSlug('spain')).toBe(true)
    expect(isOfficePoolSlug('all-offices')).toBe(true)
  })

  it('returns false for unknown slugs', () => {
    expect(isOfficePoolSlug('not-real')).toBe(false)
    expect(isOfficePoolSlug('')).toBe(false)
  })
})
