import { describe, expect, it } from 'vitest'
import { reconcilePredictionStateForMembership } from './membership-state'
import type { PredictionsState } from './storage'

const submittedState: PredictionsState = {
  groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
  knockoutPredictions: { 'r16-1': 7 },
  knockoutMatchups: { 'r16-1': { teamAId: 7, teamBId: 8 } },
  tieBreakResolutions: {},
  submitted: true,
}

describe('reconcilePredictionStateForMembership', () => {
  it('keeps predictions but clears submitted when a user leaves the pool', () => {
    expect(
      reconcilePredictionStateForMembership(submittedState, false),
    ).toEqual({
      groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
      knockoutPredictions: { 'r16-1': 7 },
      knockoutMatchups: { 'r16-1': { teamAId: 7, teamBId: 8 } },
      tieBreakResolutions: {},
      submitted: false,
    })
  })

  it('leaves submitted state untouched while the user remains a member', () => {
    expect(reconcilePredictionStateForMembership(submittedState, true)).toBe(
      submittedState,
    )
  })

  it('leaves submitted state untouched while a membership refresh is pending', () => {
    expect(
      reconcilePredictionStateForMembership(submittedState, false, {
        membershipRefreshPending: true,
      }),
    ).toBe(submittedState)
  })
})
