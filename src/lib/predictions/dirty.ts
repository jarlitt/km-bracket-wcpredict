import type { PredictionsState } from './storage'

/**
 * Returns `true` when `state` differs from `snapshot` in any field that
 * matters for a submission (group scores, knockout picks, knockout matchups,
 * tie-break resolutions). Returns `false` when:
 *
 * - The user has not yet submitted (no baseline exists).
 * - The snapshot is null.
 * - The two states are structurally equal.
 *
 * Comparison is done after canonicalising both inputs so that:
 * - Missing group-prediction entries and entries that are `undefined`/`undefined`
 *   are treated as equivalent (the UI clears entries by writing
 *   `{ scoreA: undefined, scoreB: undefined }` mid-edit).
 * - Object key insertion order is irrelevant.
 */
export function computeIsDirty(
  state: PredictionsState,
  snapshot: PredictionsState | null,
): boolean {
  if (snapshot === null) return false
  if (!state.submitted) return false

  return (
    !groupPredictionsEqual(state.groupPredictions, snapshot.groupPredictions) ||
    !shallowRecordEqual(state.knockoutPredictions, snapshot.knockoutPredictions) ||
    !knockoutMatchupsEqual(state.knockoutMatchups, snapshot.knockoutMatchups) ||
    !tieBreakResolutionsEqual(state.tieBreakResolutions, snapshot.tieBreakResolutions)
  )
}

function groupPredictionsEqual(
  a: PredictionsState['groupPredictions'],
  b: PredictionsState['groupPredictions'],
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const av = a[Number(key)]
    const bv = b[Number(key)]
    const aEmpty = !av || (av.scoreA === undefined && av.scoreB === undefined)
    const bEmpty = !bv || (bv.scoreA === undefined && bv.scoreB === undefined)
    if (aEmpty && bEmpty) continue
    if (aEmpty !== bEmpty) return false
    if (!av || !bv) return false
    if (av.scoreA !== bv.scoreA || av.scoreB !== bv.scoreB) return false
  }
  return true
}

function shallowRecordEqual<V>(a: Record<string, V>, b: Record<string, V>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

function knockoutMatchupsEqual(
  a: PredictionsState['knockoutMatchups'],
  b: PredictionsState['knockoutMatchups'],
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const av = a[key]
    const bv = b[key]
    if (!av && !bv) continue
    if (!av || !bv) return false
    if (av.teamAId !== bv.teamAId || av.teamBId !== bv.teamBId) return false
  }
  return true
}

function tieBreakResolutionsEqual(
  a: PredictionsState['tieBreakResolutions'],
  b: PredictionsState['tieBreakResolutions'],
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const av = a[key] ?? []
    const bv = b[key] ?? []
    if (av.length !== bv.length) return false
    for (let i = 0; i < av.length; i++) {
      if (av[i] !== bv[i]) return false
    }
  }
  return true
}
