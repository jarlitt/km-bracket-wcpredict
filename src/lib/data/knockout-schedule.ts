/**
 * Maps each knockout match ID to its scheduled UTC datetime.
 * Used to match external API events (ESPN, etc.) to our match IDs by date+time.
 *
 * Times are UTC (Z suffix). Year is 2026.
 */
export const KNOCKOUT_SCHEDULE_UTC: Record<string, string> = {
  'R32-1':  '2026-06-29T20:30Z',
  'R32-2':  '2026-06-30T21:00Z',
  'R32-3':  '2026-06-28T19:00Z',
  'R32-4':  '2026-06-30T01:00Z',
  'R32-5':  '2026-07-02T23:00Z',
  'R32-6':  '2026-07-02T19:00Z',
  'R32-7':  '2026-07-02T00:00Z',
  'R32-8':  '2026-07-01T20:00Z',
  'R32-9':  '2026-06-29T17:00Z',
  'R32-10': '2026-06-30T17:00Z',
  'R32-11': '2026-07-01T01:00Z',
  'R32-12': '2026-07-01T16:00Z',
  'R32-13': '2026-07-03T22:00Z',
  'R32-14': '2026-07-03T18:00Z',
  'R32-15': '2026-07-03T03:00Z',
  'R32-16': '2026-07-04T01:30Z',
  'R16-1':  '2026-07-04T21:00Z',
  'R16-2':  '2026-07-04T17:00Z',
  'R16-3':  '2026-07-06T19:00Z',
  'R16-4':  '2026-07-07T00:00Z',
  'R16-5':  '2026-07-05T20:00Z',
  'R16-6':  '2026-07-06T00:00Z',
  'R16-7':  '2026-07-07T16:00Z',
  'R16-8':  '2026-07-07T20:00Z',
  'QF-1':   '2026-07-09T20:00Z',
  'QF-2':   '2026-07-10T19:00Z',
  'QF-3':   '2026-07-11T21:00Z',
  'QF-4':   '2026-07-12T01:00Z',
  'SF-1':   '2026-07-14T19:00Z',
  'SF-2':   '2026-07-15T19:00Z',
  '3RD':    '2026-07-18T21:00Z',
  'F':      '2026-07-19T19:00Z',
}

function toUtcMs(iso: string): number {
  return new Date(iso).getTime()
}

/**
 * Finds the knockout match ID for a given UTC datetime.
 * Allows up to 30 minutes of drift in case the API slightly differs.
 */
export function findKnockoutMatchIdByDate(utcDate: string): string | null {
  const targetMs = toUtcMs(utcDate)
  const TOLERANCE_MS = 30 * 60 * 1000

  for (const [matchId, scheduled] of Object.entries(KNOCKOUT_SCHEDULE_UTC)) {
    if (Math.abs(toUtcMs(scheduled) - targetMs) <= TOLERANCE_MS) {
      return matchId
    }
  }
  return null
}
