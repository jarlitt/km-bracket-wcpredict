'use client'

import { useState, useEffect } from 'react'

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function madridToLocal(date: string, time: string): { date: string; time: string } {
  const [day, mon] = date.split(' ')
  const [h, m] = time.split(':').map(Number)
  const utc = new Date(Date.UTC(2026, MONTHS[mon], parseInt(day), h - 2, m))

  return {
    date: utc.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    time: utc.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
  }
}

/**
 * Converts stored Madrid (CEST/UTC+2) date+time to the user's local timezone.
 * Returns Madrid time during SSR, swaps to local on hydration.
 */
export function useLocalKickoff(date?: string, time?: string) {
  const [local, setLocal] = useState<{ date: string; time: string } | null>(null)

  useEffect(() => {
    if (date && time) {
      setLocal(madridToLocal(date, time))
    }
  }, [date, time])

  if (!date || !time) return null
  return local ?? { date, time }
}
