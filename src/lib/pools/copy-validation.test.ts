import { describe, expect, it } from 'vitest'
import { validateJoinInput } from './copy-validation'

describe('validateJoinInput', () => {
  it('accepts a plain join with no source pool', () => {
    expect(validateJoinInput({ poolId: 'pool-1' })).toEqual({ ok: true })
  })

  it('accepts a copy from a different pool', () => {
    expect(
      validateJoinInput({ poolId: 'pool-1', copyFromPoolId: 'pool-2' }),
    ).toEqual({ ok: true })
  })

  it('rejects when poolId is empty', () => {
    expect(validateJoinInput({ poolId: '' })).toEqual({
      ok: false,
      error: 'Missing pool',
    })
  })

  it('rejects copying from the destination pool itself', () => {
    expect(
      validateJoinInput({ poolId: 'pool-1', copyFromPoolId: 'pool-1' }),
    ).toEqual({
      ok: false,
      error: 'Cannot copy from the same pool',
    })
  })
})
