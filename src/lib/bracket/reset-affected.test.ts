import { describe, expect, it } from 'vitest'
import type { KnockoutMatch } from '@/types'
import { resetAffectedKnockoutPredictions } from './reset-affected'

function match(id: string, teamAId: number | null, teamBId: number | null): KnockoutMatch {
  return {
    id,
    round: id.startsWith('R32')
      ? 'R32'
      : id.startsWith('R16')
        ? 'R16'
        : id.startsWith('QF')
          ? 'QF'
          : id.startsWith('SF')
            ? 'SF'
            : id === 'F'
              ? 'F'
              : '3RD',
    position: 1,
    teamAId,
    teamBId,
    label: id,
  }
}

describe('resetAffectedKnockoutPredictions', () => {
  it('removes changed R32 picks and every downstream pick', () => {
    const previousMatches = [
      match('R32-1', 1, 2),
      match('R32-11', 11, 5),
      match('R32-12', 12, 6),
    ]
    const nextMatches = [
      match('R32-1', 1, 2),
      match('R32-11', 11, 6),
      match('R32-12', 12, 5),
    ]

    expect(
      resetAffectedKnockoutPredictions({
        previousMatches,
        nextMatches,
        predictions: {
          'R32-1': 1,
          'R32-11': 11,
          'R32-12': 12,
          'R16-1': 1,
          'R16-6': 11,
          'QF-3': 11,
          'SF-2': 11,
          F: 11,
          '3RD': 6,
        },
      }),
    ).toEqual({
      predictions: {
        'R32-1': 1,
        'R16-1': 1,
      },
      resetMatchIds: new Set(['R32-11', 'R32-12', 'R16-6', 'QF-3', 'SF-2', 'F', '3RD']),
    })
  })
})
