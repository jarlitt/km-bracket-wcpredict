'use client'

import { useSyncExternalStore } from 'react'

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function utcToLocal(
  date: string,
  time: string,
): { date: string; time: string; weekday: string } {
  const [day, mon] = date.split(' ')
  const [h, m] = time.split(':').map(Number)
  const utc = new Date(Date.UTC(2026, MONTHS[mon], parseInt(day), h, m))

  return {
    date: utc.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    time: utc.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
    weekday: utc.toLocaleDateString(undefined, { weekday: 'long' }),
  }
}

function subscribeNoop() {
  return () => {}
}

function clientSnapshot() {
  return true
}

function serverSnapshot() {
  return false
}

/**
 * Converts stored UTC date+time to the user's local timezone.
 * Returns the raw UTC string during SSR, swaps to local on hydration.
 */
export function useLocalKickoff(date?: string, time?: string) {
  // useSyncExternalStore gives us SSR/client divergence without needing
  // useEffect+setState, which avoids react-hooks/set-state-in-effect.
  const isClient = useSyncExternalStore(
    subscribeNoop,
    clientSnapshot,
    serverSnapshot,
  )

  if (!date || !time) return null
  if (!isClient) return { date, time, weekday: '' }
  return utcToLocal(date, time)
}
