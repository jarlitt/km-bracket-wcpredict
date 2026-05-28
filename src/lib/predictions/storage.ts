/**
 * Pure helpers for the prediction draft localStorage layer.
 *
 * Anonymous users save under the `anon` scope. The first time a freshly
 * signed-up user reads predictions for a pool, anything stored under that
 * pool's anon scope is promoted into the user's scope, so picks made
 * pre-signup carry across.
 */

export const STORAGE_PREFIX = 'wc2026-predictions'
export const ANON_SCOPE = 'anon'

export interface PredictionsState {
  groupPredictions: Record<number, { scoreA?: number; scoreB?: number }>
  knockoutPredictions: Record<string, number>
  knockoutMatchups: Record<string, { teamAId: number | null; teamBId: number | null }>
  tieBreakResolutions: Record<string, number[]>
  submitted: boolean
}

export const defaultPredictionsState: PredictionsState = {
  groupPredictions: {},
  knockoutPredictions: {},
  knockoutMatchups: {},
  tieBreakResolutions: {},
  submitted: false,
}

/** Minimal subset of the Storage interface we need; lets tests inject a fake. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function predictionsStorageKey(scope: string, poolId: string): string {
  return `${STORAGE_PREFIX}:${scope}:${poolId}`
}

/**
 * Read predictions for a (user, pool) scope from the given storage.
 *
 * If `userId` is set and there's nothing yet under the user's scope, anything
 * found under the anon scope is migrated over (and removed from anon) so the
 * draft survives signup.
 *
 * `submitted` is never trusted from localStorage — DB is the source of truth.
 */
export function readPredictionsFromStorage(
  storage: StorageLike,
  userId: string | null,
  poolId: string,
): PredictionsState {
  const scope = userId ?? ANON_SCOPE
  const userKey = predictionsStorageKey(scope, poolId)
  let raw = safeGet(storage, userKey)

  if (!raw && userId) {
    const anonKey = predictionsStorageKey(ANON_SCOPE, poolId)
    const anonRaw = safeGet(storage, anonKey)
    if (anonRaw) {
      safeSet(storage, userKey, anonRaw)
      safeRemove(storage, anonKey)
      raw = anonRaw
    }
  }

  if (!raw) return defaultPredictionsState

  try {
    const parsed = JSON.parse(raw) as Partial<PredictionsState>
    return {
      groupPredictions: parsed.groupPredictions ?? {},
      knockoutPredictions: parsed.knockoutPredictions ?? {},
      knockoutMatchups: parsed.knockoutMatchups ?? {},
      tieBreakResolutions: parsed.tieBreakResolutions ?? {},
      submitted: false,
    }
  } catch {
    return defaultPredictionsState
  }
}

export function writePredictionsToStorage(
  storage: StorageLike,
  userId: string | null,
  poolId: string,
  state: PredictionsState,
): void {
  const scope = userId ?? ANON_SCOPE
  safeSet(storage, predictionsStorageKey(scope, poolId), JSON.stringify(state))
}

export const PREDICTIONS_STORAGE_PREFIX = STORAGE_PREFIX
export const ANON_DRAFT_STORAGE_KEY = `${STORAGE_PREFIX}:${ANON_SCOPE}:draft`

export function scopedPredictionsStorageKey(userId: string, poolId: string): string {
  return `${STORAGE_PREFIX}:${userId}:${poolId}`
}

/**
 * Read the single anonymous-user draft. Used while no user/pool is known yet
 * so the picks survive a sign-up/login + remount cycle.
 *
 * `submitted` is forced to `false` — the anon scope can never represent a
 * real submission.
 */
export function readAnonDraft(storage: StorageLike): PredictionsState {
  const raw = safeGet(storage, ANON_DRAFT_STORAGE_KEY)
  if (!raw) return defaultPredictionsState

  try {
    const parsed = JSON.parse(raw) as Partial<PredictionsState>
    return {
      groupPredictions: parsed.groupPredictions ?? {},
      knockoutPredictions: parsed.knockoutPredictions ?? {},
      knockoutMatchups: parsed.knockoutMatchups ?? {},
      tieBreakResolutions: parsed.tieBreakResolutions ?? {},
      submitted: false,
    }
  } catch {
    return defaultPredictionsState
  }
}

export function writeAnonDraft(storage: StorageLike, state: PredictionsState): void {
  safeSet(storage, ANON_DRAFT_STORAGE_KEY, JSON.stringify(state))
}

export function clearAnonDraft(storage: StorageLike): void {
  safeRemove(storage, ANON_DRAFT_STORAGE_KEY)
}

export function legacyAnonPredictionKeys(storage: Storage): string[] {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(`${STORAGE_PREFIX}:${ANON_SCOPE}:`) && key !== ANON_DRAFT_STORAGE_KEY) {
      keys.push(key)
    }
  }
  return keys
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value)
  } catch {
    /* quota / private-mode */
  }
}

function safeRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    /* quota / private-mode */
  }
}
