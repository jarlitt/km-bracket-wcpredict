import { describe, expect, it } from 'vitest'
import {
  getCompleteGroupPredictionCount,
  validatePredictionSubmission,
  type GroupPredictionInput,
} from './validation'

function completeGroupPredictions(count: number): Record<number, GroupPredictionInput> {
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

describe('getCompleteGroupPredictionCount', () => {
  it('ignores incomplete group predictions when counting completion', () => {
    const predictions: Record<number, GroupPredictionInput> = {
      1: { scoreA: 1, scoreB: 0 },
      2: { scoreA: 2 },
      3: { scoreB: 2 },
      4: {},
    }

    expect(getCompleteGroupPredictionCount(predictions)).toBe(1)
  })
})

describe('validatePredictionSubmission', () => {
  it('accepts exactly 72 complete group predictions and at least 32 knockout predictions', () => {
    expect(
      validatePredictionSubmission({
        groupPredictions: completeGroupPredictions(72),
        knockoutPredictions: knockoutPredictions(32),
      }),
    ).toEqual({ ok: true })
  })

  it('rejects too few complete group predictions', () => {
    expect(
      validatePredictionSubmission({
        groupPredictions: completeGroupPredictions(71),
        knockoutPredictions: knockoutPredictions(32),
      }),
    ).toEqual({
      ok: false,
      error: 'Expected 72 complete group predictions, got 71',
    })
  })

  it('rejects too few knockout predictions', () => {
    expect(
      validatePredictionSubmission({
        groupPredictions: completeGroupPredictions(72),
        knockoutPredictions: knockoutPredictions(31),
      }),
    ).toEqual({
      ok: false,
      error: 'Expected at least 32 knockout predictions, got 31',
    })
  })
})
