import { describe, expect, it } from 'vitest'
import { defaultPredictionsState } from './storage'
import { migrateAnonDraftToCountryPool } from './anon-migration'

function storageWith(entries: Record<string, string>): Storage {
  const data = new Map(Object.entries(entries))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('migrateAnonDraftToCountryPool', () => {
  it('moves anon:draft to the user/pool scope', () => {
    const draft = {
      ...defaultPredictionsState,
      groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
    }
    const storage = storageWith({ 'wc2026-predictions:anon:draft': JSON.stringify(draft) })

    const migrated = migrateAnonDraftToCountryPool(storage, 'user-1', 'pool-spain')

    expect(migrated).toBe(true)
    expect(storage.getItem('wc2026-predictions:anon:draft')).toBeNull()
    expect(JSON.parse(storage.getItem('wc2026-predictions:user-1:pool-spain') ?? '{}')).toMatchObject({
      groupPredictions: { 1: { scoreA: 2, scoreB: 1 } },
      submitted: false,
    })
  })

  it('returns false when there is no anon draft', () => {
    const storage = storageWith({})
    expect(migrateAnonDraftToCountryPool(storage, 'user-1', 'pool-spain')).toBe(false)
  })

  it('clears legacy anon pool keys', () => {
    const storage = storageWith({
      'wc2026-predictions:anon:old-pool': JSON.stringify(defaultPredictionsState),
    })
    migrateAnonDraftToCountryPool(storage, 'user-1', 'pool-spain')
    expect(storage.getItem('wc2026-predictions:anon:old-pool')).toBeNull()
  })
})
