import { describe, expect, it } from 'vitest'
import { hasCompleteScore } from './completeness'

describe('prediction completeness helpers', () => {
  it('requires both score inputs before treating a match prediction as complete', () => {
    expect(hasCompleteScore(undefined, undefined)).toBe(false)
    expect(hasCompleteScore(1, undefined)).toBe(false)
    expect(hasCompleteScore(undefined, 0)).toBe(false)
    expect(hasCompleteScore(0, 0)).toBe(true)
    expect(hasCompleteScore(2, 1)).toBe(true)
  })
})
