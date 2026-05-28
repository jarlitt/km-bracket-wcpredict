import { describe, expect, it } from 'vitest'
import {
  ANON_DRAFT_STORAGE_KEY,
  ANON_SCOPE,
  clearAnonDraft,
  defaultPredictionsState,
  predictionsStorageKey,
  readAnonDraft,
  readPredictionsFromStorage,
  writeAnonDraft,
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

describe('anon draft helpers', () => {
  it('writes the anon draft under the dedicated draft key', () => {
    const storage = new MemoryStorage()
    writeAnonDraft(storage, sampleState())

    expect(storage.has(ANON_DRAFT_STORAGE_KEY)).toBe(true)
  })

  it('reads back what was just written', () => {
    const storage = new MemoryStorage()
    writeAnonDraft(storage, sampleState())

    const result = readAnonDraft(storage)
    expect(result.groupPredictions).toEqual({ 1: { scoreA: 2, scoreB: 1 } })
    expect(result.knockoutPredictions).toEqual({ 'r16-1': 7 })
    expect(result.tieBreakResolutions).toEqual({ 'group:A:1,2': [2, 1] })
  })

  it('always returns submitted=false for anon drafts', () => {
    const storage = new MemoryStorage()
    writeAnonDraft(storage, { ...sampleState(), submitted: true })

    expect(readAnonDraft(storage).submitted).toBe(false)
  })

  it('returns the default state when no draft is stored', () => {
    expect(readAnonDraft(new MemoryStorage())).toEqual(defaultPredictionsState)
  })

  it('returns the default state when the stored draft is corrupt', () => {
    const storage = new MemoryStorage()
    storage.setItem(ANON_DRAFT_STORAGE_KEY, '{not-json')

    expect(readAnonDraft(storage)).toEqual(defaultPredictionsState)
  })

  it('clears the draft', () => {
    const storage = new MemoryStorage()
    writeAnonDraft(storage, sampleState())
    clearAnonDraft(storage)

    expect(storage.has(ANON_DRAFT_STORAGE_KEY)).toBe(false)
  })
})
