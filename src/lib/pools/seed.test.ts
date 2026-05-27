import { describe, expect, it } from 'vitest'
import { PHASE_1_POOLS, PHASE_1_POOL_SLUGS, isOfficePoolSlug } from './seed'

describe('pool seed', () => {
  it('contains only country office pools', () => {
    expect(PHASE_1_POOL_SLUGS).toEqual([
      'spain',
      'malta',
      'nigeria',
      'south-africa',
      'zambia',
      'uk',
    ])
    expect(PHASE_1_POOLS).toHaveLength(6)
    expect(isOfficePoolSlug('all-offices')).toBe(false)
  })
})
