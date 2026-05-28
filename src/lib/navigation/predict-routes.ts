import { GROUPS } from '@/lib/data/teams'
import type { GroupId } from '@/types'

export type PredictGroupSelection = GroupId | 'thirds'

export interface ResolveSelectedGroupResult {
  value: PredictGroupSelection
  canonical: boolean
}

const VALID_SELECTIONS: ReadonlySet<string> = new Set<string>([
  ...GROUPS,
  'thirds',
])

export function predictSummaryHref(): string {
  return '/predict/summary'
}

export function predictGroupsHref(group?: PredictGroupSelection): string {
  if (!group) return '/predict/groups'
  return `/predict/groups?group=${group}`
}

export function resolveSelectedGroup(
  rawParam: string | null | undefined,
  completedGroups: readonly string[],
): ResolveSelectedGroupResult {
  if (rawParam && VALID_SELECTIONS.has(rawParam)) {
    return { value: rawParam as PredictGroupSelection, canonical: true }
  }

  const completed = new Set(completedGroups)
  const firstIncomplete = GROUPS.find((group) => !completed.has(group))
  return { value: firstIncomplete ?? 'A', canonical: false }
}
