import {
  ANON_DRAFT_STORAGE_KEY,
  legacyAnonPredictionKeys,
  scopedPredictionsStorageKey,
  type PredictionsState,
} from '@/lib/predictions/storage'

export function migrateAnonDraftToCountryPool(
  storage: Storage,
  userId: string,
  poolId: string,
): boolean {
  const rawDraft = storage.getItem(ANON_DRAFT_STORAGE_KEY)
  let migrated = false

  if (rawDraft) {
    try {
      const draft = JSON.parse(rawDraft) as PredictionsState
      storage.setItem(
        scopedPredictionsStorageKey(userId, poolId),
        JSON.stringify({ ...draft, submitted: false }),
      )
      migrated = true
    } catch {
      migrated = false
    }
    storage.removeItem(ANON_DRAFT_STORAGE_KEY)
  }

  for (const key of legacyAnonPredictionKeys(storage)) {
    storage.removeItem(key)
  }

  return migrated
}
