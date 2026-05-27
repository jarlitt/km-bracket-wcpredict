import { describe, expect, it } from 'vitest'
import {
  ANON_SCOPE,
  defaultPredictionsState,
  predictionsStorageKey,
  readPredictionsFromStorage,
  writePredictionsToStorage,
  type StorageLike,
  type PredictionsState,
} from './storage'

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  has(key: string): boolean {
    return this.data.has(key)
  }
  size(): number {
    return this.data.size
  }
}

const POOL = 'pool-uuid-1'
const USER = 'user-uuid-1'

function sampleState(): PredictionsState {
  return {
    groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
    knockoutPredictions: { 'r16-1': 7 },
    knockoutMatchups: { 'r16-1': { teamAId: 7, teamBId: 8 } },
    tieBreakResolutions: { 'group:A:1,2': [2, 1] },
    submitted: true,
  }
}

describe('predictionsStorageKey', () => {
  it('builds the wc2026 prefix + scope + pool key', () => {
    expect(predictionsStorageKey('anon', POOL)).toBe(
      `wc2026-predictions:anon:${POOL}`,
    )
    expect(predictionsStorageKey(USER, POOL)).toBe(
      `wc2026-predictions:${USER}:${POOL}`,
    )
  })
})

describe('writePredictionsToStorage', () => {
  it('writes under the anon scope when no user id', () => {
    const storage = new MemoryStorage()
    writePredictionsToStorage(storage, null, POOL, sampleState())

    expect(storage.has(predictionsStorageKey(ANON_SCOPE, POOL))).toBe(true)
    expect(storage.has(predictionsStorageKey(USER, POOL))).toBe(false)
  })

  it('writes under the user scope when a user id is provided', () => {
    const storage = new MemoryStorage()
    writePredictionsToStorage(storage, USER, POOL, sampleState())

    expect(storage.has(predictionsStorageKey(USER, POOL))).toBe(true)
    expect(storage.has(predictionsStorageKey(ANON_SCOPE, POOL))).toBe(false)
  })
})

describe('readPredictionsFromStorage', () => {
  it('returns the default state when nothing is stored', () => {
    const storage = new MemoryStorage()
    expect(readPredictionsFromStorage(storage, USER, POOL)).toEqual(
      defaultPredictionsState,
    )
  })

  it('forces submitted=false even if localStorage said true', () => {
    const storage = new MemoryStorage()
    writePredictionsToStorage(storage, USER, POOL, sampleState())
    const result = readPredictionsFromStorage(storage, USER, POOL)
    expect(result.submitted).toBe(false)
    expect(result.groupPredictions).toEqual({ 1: { scoreA: 2, scoreB: 1 } })
    expect(result.knockoutPredictions).toEqual({ 'r16-1': 7 })
    expect(result.knockoutMatchups).toEqual({ 'r16-1': { teamAId: 7, teamBId: 8 } })
    expect(result.tieBreakResolutions).toEqual({ 'group:A:1,2': [2, 1] })
  })

  it('returns anon-scoped state when no user id is provided', () => {
    const storage = new MemoryStorage()
    writePredictionsToStorage(storage, null, POOL, sampleState())
    const result = readPredictionsFromStorage(storage, null, POOL)
    expect(result.groupPredictions).toEqual({ 1: { scoreA: 2, scoreB: 1 } })
    expect(result.tieBreakResolutions).toEqual({ 'group:A:1,2': [2, 1] })
  })

  it('migrates anon predictions into the user scope on first authed read', () => {
    const storage = new MemoryStorage()
    writePredictionsToStorage(storage, null, POOL, sampleState())

    expect(storage.has(predictionsStorageKey(ANON_SCOPE, POOL))).toBe(true)
    expect(storage.has(predictionsStorageKey(USER, POOL))).toBe(false)

    const result = readPredictionsFromStorage(storage, USER, POOL)

    expect(result.groupPredictions).toEqual({ 1: { scoreA: 2, scoreB: 1 } })
    expect(result.knockoutPredictions).toEqual({ 'r16-1': 7 })
    expect(result.knockoutMatchups).toEqual({ 'r16-1': { teamAId: 7, teamBId: 8 } })
    expect(result.tieBreakResolutions).toEqual({ 'group:A:1,2': [2, 1] })
    // The anon entry is consumed and the user entry is now populated.
    expect(storage.has(predictionsStorageKey(ANON_SCOPE, POOL))).toBe(false)
    expect(storage.has(predictionsStorageKey(USER, POOL))).toBe(true)
  })

  it('prefers the user-scoped entry over anon when both exist', () => {
    const storage = new MemoryStorage()
    writePredictionsToStorage(storage, null, POOL, {
      ...defaultPredictionsState,
      groupPredictions: { 1: { scoreA: 9, scoreB: 9 } },
    })
    writePredictionsToStorage(storage, USER, POOL, sampleState())

    const result = readPredictionsFromStorage(storage, USER, POOL)
    expect(result.groupPredictions).toEqual({ 1: { scoreA: 2, scoreB: 1 } })
    // Anon entry untouched when the user already has data.
    expect(storage.has(predictionsStorageKey(ANON_SCOPE, POOL))).toBe(true)
  })

  it('returns defaults when the stored JSON is corrupt', () => {
    const storage = new MemoryStorage()
    storage.setItem(predictionsStorageKey(USER, POOL), '{not-valid-json')
    expect(readPredictionsFromStorage(storage, USER, POOL)).toEqual(
      defaultPredictionsState,
    )
  })

  it('backfills missing tie-break resolutions for older stored drafts', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      predictionsStorageKey(USER, POOL),
      JSON.stringify({
        groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
        knockoutPredictions: { 'r16-1': 7 },
        submitted: true,
      }),
    )

    expect(readPredictionsFromStorage(storage, USER, POOL).tieBreakResolutions).toEqual({})
  })

  it('backfills missing knockout matchups for older stored drafts', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      predictionsStorageKey(USER, POOL),
      JSON.stringify({
        groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
        knockoutPredictions: { 'r16-1': 7 },
        tieBreakResolutions: { 'group:A:1,2': [2, 1] },
        submitted: true,
      }),
    )

    expect(readPredictionsFromStorage(storage, USER, POOL).knockoutMatchups).toEqual({})
  })
})
