import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { FIRST_MATCH_KICKOFF_UTC, isLockedAt } from './lock'

export const getTournamentLockAt = cache(async (): Promise<Date> => {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('tournament_settings')
      .select('lock_at')
      .eq('id', 1)
      .maybeSingle()
    return data?.lock_at ? new Date(data.lock_at as string) : FIRST_MATCH_KICKOFF_UTC
  } catch {
    return FIRST_MATCH_KICKOFF_UTC
  }
})

export async function isTournamentLockedAsync(now = new Date()): Promise<boolean> {
  return isLockedAt(now, await getTournamentLockAt())
}
