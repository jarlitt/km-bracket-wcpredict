export interface GroupPredictionInput {
  scoreA?: number
  scoreB?: number
}

interface PredictionSubmissionInput {
  groupPredictions: Record<number, GroupPredictionInput>
  knockoutPredictions: Record<string, number>
}

type PredictionSubmissionValidation =
  | { ok: true }
  | { ok: false; error: string }

export function getCompleteGroupPredictionCount(
  groupPredictions: Record<number, GroupPredictionInput>,
): number {
  return Object.values(groupPredictions).filter(
    (value) => typeof value.scoreA === 'number' && typeof value.scoreB === 'number',
  ).length
}

export function validatePredictionSubmission({
  groupPredictions,
  knockoutPredictions,
}: PredictionSubmissionInput): PredictionSubmissionValidation {
  const completeGroupCount = getCompleteGroupPredictionCount(groupPredictions)
  if (completeGroupCount !== 72) {
    return {
      ok: false,
      error: `Expected 72 complete group predictions, got ${completeGroupCount}`,
    }
  }

  const knockoutCount = Object.keys(knockoutPredictions).length
  if (knockoutCount < 32) {
    return {
      ok: false,
      error: `Expected at least 32 knockout predictions, got ${knockoutCount}`,
    }
  }

  return { ok: true }
}
