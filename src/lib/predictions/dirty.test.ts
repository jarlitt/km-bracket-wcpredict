import { describe, expect, it } from 'vitest'
import { computeIsDirty } from './dirty'
import { defaultPredictionsState, type PredictionsState } from './storage'

function snap(overrides: Partial<PredictionsState> = {}): PredictionsState {
  return {
    ...defaultPredictionsState,
    submitted: true,
    ...overrides,
  }
}

describe('computeIsDirty', () => {
  it('returns false when the snapshot is null', () => {
    expect(computeIsDirty(snap({ groupPredictions: { 1: { scoreA: 1, scoreB: 0 } } }), null)).toBe(false)
  })

  it('returns false when state has not been submitted yet', () => {
    const baseline = snap({ groupPredictions: { 1: { scoreA: 1, scoreB: 0 } } })
    const live: PredictionsState = { ...baseline, submitted: false }
    expect(computeIsDirty(live, baseline)).toBe(false)
  })

  it('returns false when state and snapshot match exactly', () => {
    const baseline = snap({ groupPredictions: { 1: { scoreA: 1, scoreB: 0 } } })
    expect(computeIsDirty(baseline, baseline)).toBe(false)
  })

  it('returns true when a group score differs', () => {
    const baseline = snap({ groupPredictions: { 1: { scoreA: 1, scoreB: 0 } } })
    const live = snap({ groupPredictions: { 1: { scoreA: 2, scoreB: 0 } } })
    expect(computeIsDirty(live, baseline)).toBe(true)
  })

  it('returns true when a knockout pick differs', () => {
    const baseline = snap({ knockoutPredictions: { 'R32-1': 7 } })
    const live = snap({ knockoutPredictions: { 'R32-1': 8 } })
    expect(computeIsDirty(live, baseline)).toBe(true)
  })

  it('returns true when a tie-break resolution differs', () => {
    const baseline = snap({ tieBreakResolutions: { 'group:A:1,2': [1, 2] } })
    const live = snap({ tieBreakResolutions: { 'group:A:1,2': [2, 1] } })
    expect(computeIsDirty(live, baseline)).toBe(true)
  })

  it('returns true when a knockout matchup differs', () => {
    const baseline = snap({ knockoutMatchups: { 'R32-1': { teamAId: 1, teamBId: 2 } } })
    const live = snap({ knockoutMatchups: { 'R32-1': { teamAId: 1, teamBId: 3 } } })
    expect(computeIsDirty(live, baseline)).toBe(true)
  })

  it('treats { scoreA: undefined, scoreB: undefined } as equivalent to a missing entry', () => {
    const baseline = snap({ groupPredictions: {} })
    const live = snap({
      groupPredictions: { 1: { scoreA: undefined, scoreB: undefined } },
    })
    expect(computeIsDirty(live, baseline)).toBe(false)
  })

  it('ignores key insertion order in comparison', () => {
    const baseline = snap({
      groupPredictions: { 1: { scoreA: 1, scoreB: 0 }, 2: { scoreA: 2, scoreB: 1 } },
    })
    const live = snap({
      groupPredictions: { 2: { scoreA: 2, scoreB: 1 }, 1: { scoreA: 1, scoreB: 0 } },
    })
    expect(computeIsDirty(live, baseline)).toBe(false)
  })
})
