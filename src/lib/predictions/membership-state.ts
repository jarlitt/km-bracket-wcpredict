import type { PredictionsState } from './storage'

export function reconcilePredictionStateForMembership(
  state: PredictionsState,
  isMember: boolean,
  options: { membershipRefreshPending?: boolean } = {},
): PredictionsState {
  if (isMember || options.membershipRefreshPending || !state.submitted) {
    return state
  }

  return {
    ...state,
    submitted: false,
  }
}
