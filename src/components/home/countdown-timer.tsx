'use client'

import { useEffect, useState } from 'react'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(lockAt: string): TimeLeft | null {
  const diff = new Date(lockAt).getTime() - Date.now()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  }
}

export function CountdownTimer({ lockAt }: { lockAt: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() =>
    getTimeLeft(lockAt),
  )

  useEffect(() => {
    const tick = () => setTimeLeft(getTimeLeft(lockAt))
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [lockAt])

  if (!timeLeft) return null

  const units: { value: number; label: string }[] = [
    { value: timeLeft.days, label: 'DAYS' },
    { value: timeLeft.hours, label: 'HOURS' },
    { value: timeLeft.minutes, label: 'MIN' },
    { value: timeLeft.seconds, label: 'SEC' },
  ]

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-5 pb-2.5 pt-3.5">
      {units.map((u, i) => (
        <span key={u.label} className="flex items-center gap-2">
          {i > 0 && (
            <span className="text-lg font-semibold text-muted-foreground/60">
              :
            </span>
          )}
          <span className="flex flex-col items-center">
            <span className="text-2xl font-bold tabular-nums leading-none">
              {String(u.value).padStart(2, '0')}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {u.label}
            </span>
          </span>
        </span>
      ))}
    </div>
  )
}
