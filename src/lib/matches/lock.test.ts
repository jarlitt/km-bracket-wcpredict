import { describe, expect, it } from 'vitest'
import {
  FIRST_MATCH_KICKOFF_UTC,
  isTournamentLocked,
  parseGroupMatchKickoffUtc,
} from './lock'

describe('match lock helpers', () => {
  it('parses fixture date and time as a UTC kickoff in 2026', () => {
    expect(parseGroupMatchKickoffUtc({ date: '11 Jun', time: '19:00' })?.toISOString())
      .toBe('2026-06-11T19:00:00.000Z')
  })

  it('returns null for incomplete fixture timing', () => {
    expect(parseGroupMatchKickoffUtc({ date: '11 Jun' })).toBeNull()
    expect(parseGroupMatchKickoffUtc({ time: '19:00' })).toBeNull()
  })

  it('locks predictions at the first group match kickoff', () => {
    expect(FIRST_MATCH_KICKOFF_UTC.toISOString()).toBe('2026-06-11T19:00:00.000Z')
    expect(isTournamentLocked(new Date('2026-06-11T18:59:59.999Z'))).toBe(false)
    expect(isTournamentLocked(new Date('2026-06-11T19:00:00.000Z'))).toBe(true)
  })
})
