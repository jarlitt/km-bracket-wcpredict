/**
 * Pure validation rules for the copy-predictions flow. These live outside the
 * server action so we can unit-test them without standing up Supabase mocks.
 */

export interface JoinPoolInput {
  poolId: string
  copyFromPoolId?: string | null
}

export type JoinValidation =
  | { ok: true }
  | { ok: false; error: string }

export function validateJoinInput(input: JoinPoolInput): JoinValidation {
  if (!input.poolId) {
    return { ok: false, error: 'Missing pool' }
  }
  if (input.copyFromPoolId && input.copyFromPoolId === input.poolId) {
    return { ok: false, error: 'Cannot copy from the same pool' }
  }
  return { ok: true }
}
