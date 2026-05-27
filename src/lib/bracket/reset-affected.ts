import type { KnockoutMatch } from '@/types'

const DEPENDENTS: Record<string, string[]> = {
  'R32-1': ['R16-1'],
  'R32-2': ['R16-1'],
  'R32-3': ['R16-2'],
  'R32-4': ['R16-2'],
  'R32-5': ['R16-3'],
  'R32-6': ['R16-3'],
  'R32-7': ['R16-4'],
  'R32-8': ['R16-4'],
  'R32-9': ['R16-5'],
  'R32-10': ['R16-5'],
  'R32-11': ['R16-6'],
  'R32-12': ['R16-6'],
  'R32-13': ['R16-7'],
  'R32-14': ['R16-7'],
  'R32-15': ['R16-8'],
  'R32-16': ['R16-8'],
  'R16-1': ['QF-1'],
  'R16-2': ['QF-1'],
  'R16-3': ['QF-2'],
  'R16-4': ['QF-2'],
  'R16-5': ['QF-3'],
  'R16-6': ['QF-3'],
  'R16-7': ['QF-4'],
  'R16-8': ['QF-4'],
  'QF-1': ['SF-1'],
  'QF-2': ['SF-1'],
  'QF-3': ['SF-2'],
  'QF-4': ['SF-2'],
  'SF-1': ['F', '3RD'],
  'SF-2': ['F', '3RD'],
}

function matchupChanged(previous: KnockoutMatch, next: KnockoutMatch): boolean {
  return previous.teamAId !== next.teamAId || previous.teamBId !== next.teamBId
}

function collectDependents(matchIds: Iterable<string>): Set<string> {
  const resetMatchIds = new Set(matchIds)
  const queue = [...resetMatchIds]

  for (const matchId of queue) {
    for (const dependentId of DEPENDENTS[matchId] ?? []) {
      if (resetMatchIds.has(dependentId)) continue
      resetMatchIds.add(dependentId)
      queue.push(dependentId)
    }
  }

  return resetMatchIds
}

export function resetAffectedKnockoutPredictions({
  previousMatches,
  nextMatches,
  predictions,
}: {
  previousMatches: KnockoutMatch[]
  nextMatches: KnockoutMatch[]
  predictions: Record<string, number>
}): { predictions: Record<string, number>; resetMatchIds: Set<string> } {
  const previousById = new Map(previousMatches.map((match) => [match.id, match]))
  const directlyChangedIds = nextMatches
    .filter((next) => {
      const previous = previousById.get(next.id)
      return previous ? matchupChanged(previous, next) : false
    })
    .map((match) => match.id)

  const resetMatchIds = collectDependents(directlyChangedIds)
  const nextPredictions = { ...predictions }
  for (const matchId of resetMatchIds) {
    delete nextPredictions[matchId]
  }

  return { predictions: nextPredictions, resetMatchIds }
}
