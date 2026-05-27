import { cache } from 'react'

import { GROUP_MATCHES } from '@/lib/data/matches'
import { createClient } from '@/lib/supabase/server'
import type { GroupMatch } from '@/types'

const TOURNAMENT_YEAR = 2026
const MONTH_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
}

export function parseGroupMatchKickoffUtc(
  match: Pick<GroupMatch, 'date' | 'time'>,
): Date | null {
  if (!match.date || !match.time) return null

  const [dayText, monthText] = match.date.split(' ')
  const [hourText, minuteText] = match.time.split(':')
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const month = MONTH_INDEX[monthText]

  if (
    month === undefined ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null
  }

  return new Date(Date.UTC(TOURNAMENT_YEAR, month, day, hour, minute))
}

function firstGroupKickoff(): Date {
  const kickoffs = GROUP_MATCHES
    .map(parseGroupMatchKickoffUtc)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  if (kickoffs.length === 0) {
    throw new Error('No group match kickoff dates are configured')
  }

  return kickoffs[0]
}

export const FIRST_MATCH_KICKOFF_UTC = firstGroupKickoff()

export function isLockedAt(now: Date, lockAt: Date): boolean {
  return now.getTime() >= lockAt.getTime()
}

export function isTournamentLocked(now = new Date()): boolean {
  return isLockedAt(now, FIRST_MATCH_KICKOFF_UTC)
}

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
