import type { TeamStanding } from '@/types';
import { GROUPS } from '@/lib/data/teams';
import {
  tieBreakResolutionKey,
  type TieBreakResolutions,
  type UnresolvedTie,
} from '@/lib/standings/calculate-standings';

const QUALIFYING_THIRD_PLACE_COUNT = 8;

interface DetermineBestThirdPlaceOptions {
  tieBreakResolutions?: TieBreakResolutions;
}

export interface ThirdPlaceEntry {
  groupId: string;
  standing: TeamStanding;
}

type ThirdPlaceMetric = (entry: ThirdPlaceEntry, tiedTeamIds: Set<number>) => number | string;

interface ThirdPlaceCriterion {
  metric: ThirdPlaceMetric;
  direction: 'asc' | 'desc';
}

function compareValues(a: number | string, b: number | string, direction: 'asc' | 'desc'): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
  }

  const diff = Number(a) - Number(b);
  return direction === 'asc' ? diff : -diff;
}

function thirdPlaceEntries(allGroupStandings: Record<string, TeamStanding[]>): ThirdPlaceEntry[] {
  const entries: ThirdPlaceEntry[] = [];

  for (const groupId of GROUPS) {
    const standings = allGroupStandings[groupId];
    if (standings && standings.length >= 3) {
      entries.push({ groupId, standing: standings[2] });
    }
  }

  return entries;
}

function getResolutionRank(tieBreakResolutions: TieBreakResolutions): ThirdPlaceMetric {
  return (entry, tiedTeamIds) => {
    const key = tieBreakResolutionKey('third-place', 'all', Array.from(tiedTeamIds));
    const resolution = tieBreakResolutions[key] ?? [];
    const index = resolution.indexOf(entry.standing.team.id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
}

function scoreCriteria(): ThirdPlaceCriterion[] {
  return [
    { metric: (entry) => entry.standing.points, direction: 'desc' },
    { metric: (entry) => entry.standing.goalDifference, direction: 'desc' },
    { metric: (entry) => entry.standing.goalsFor, direction: 'desc' },
  ];
}

function rankThirdPlaceEntries(
  entries: ThirdPlaceEntry[],
  criteria: ThirdPlaceCriterion[],
  criterionIndex = 0,
): ThirdPlaceEntry[] {
  if (entries.length <= 1 || criterionIndex >= criteria.length) return entries;

  const criterion = criteria[criterionIndex];
  const tiedTeamIds = new Set(entries.map((entry) => entry.standing.team.id));
  const buckets = new Map<number | string, ThirdPlaceEntry[]>();

  for (const entry of entries) {
    const value = criterion.metric(entry, tiedTeamIds);
    buckets.set(value, [...(buckets.get(value) ?? []), entry]);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => compareValues(a, b, criterion.direction))
    .flatMap(([, bucket]) => rankThirdPlaceEntries(bucket, criteria, criterionIndex + 1));
}

function findRemainingTies(
  entries: ThirdPlaceEntry[],
  criteria: ThirdPlaceCriterion[],
  criterionIndex = 0,
): ThirdPlaceEntry[][] {
  if (entries.length <= 1) return [];
  if (criterionIndex >= criteria.length) return [entries];

  const criterion = criteria[criterionIndex];
  const tiedTeamIds = new Set(entries.map((entry) => entry.standing.team.id));
  const buckets = new Map<number | string, ThirdPlaceEntry[]>();

  for (const entry of entries) {
    const value = criterion.metric(entry, tiedTeamIds);
    buckets.set(value, [...(buckets.get(value) ?? []), entry]);
  }

  return Array.from(buckets.values()).flatMap((bucket) =>
    findRemainingTies(bucket, criteria, criterionIndex + 1),
  );
}

export function determineBestThirdPlaceTeams(
  allGroupStandings: Record<string, TeamStanding[]>,
  options: DetermineBestThirdPlaceOptions = {},
): { qualifiedGroups: string[]; thirdPlaceTeams: TeamStanding[]; allThirdPlaceTeams: ThirdPlaceEntry[] } {
  const criteria: ThirdPlaceCriterion[] = [
    ...scoreCriteria(),
    { metric: getResolutionRank(options.tieBreakResolutions ?? {}), direction: 'asc' },
    // Conduct score is omitted until card/fair-play data exists; FIFA ranking is the next available criterion.
    { metric: (entry) => entry.standing.team.fifaRanking, direction: 'asc' },
    { metric: (entry) => entry.standing.team.name, direction: 'asc' },
  ];
  const thirdPlaceByGroup = rankThirdPlaceEntries(thirdPlaceEntries(allGroupStandings), criteria);

  const qualified = thirdPlaceByGroup.slice(0, 8);
  const qualifiedGroups = qualified
    .map((entry) => entry.groupId)
    .sort();

  const thirdPlaceTeams = qualified.map((entry) => entry.standing);

  return { qualifiedGroups, thirdPlaceTeams, allThirdPlaceTeams: thirdPlaceByGroup };
}

export function findUnresolvedThirdPlaceTies(
  allGroupStandings: Record<string, TeamStanding[]>,
): UnresolvedTie[] {
  return findRemainingTies(thirdPlaceEntries(allGroupStandings), scoreCriteria()).map((bucket) => ({
    groupId: 'third-place',
    key: tieBreakResolutionKey('third-place', 'all', bucket.map((entry) => entry.standing.team.id)),
    teamIds: bucket.map((entry) => entry.standing.team.id),
  }));
}

export function findQualificationRelevantThirdPlaceTies(
  allGroupStandings: Record<string, TeamStanding[]>,
): UnresolvedTie[] {
  const entries = thirdPlaceEntries(allGroupStandings);
  const rankedByScore = rankThirdPlaceEntries(entries, scoreCriteria());
  const positionByTeamId = new Map(
    rankedByScore.map((entry, index) => [entry.standing.team.id, index]),
  );

  return findRemainingTies(entries, scoreCriteria())
    .filter((bucket) => {
      const positions = bucket
        .map((entry) => positionByTeamId.get(entry.standing.team.id))
        .filter((position): position is number => position !== undefined);

      return (
        positions.some((position) => position < QUALIFYING_THIRD_PLACE_COUNT) &&
        positions.some((position) => position >= QUALIFYING_THIRD_PLACE_COUNT)
      );
    })
    .map((bucket) => ({
      groupId: 'third-place',
      key: tieBreakResolutionKey('third-place', 'all', bucket.map((entry) => entry.standing.team.id)),
      teamIds: bucket.map((entry) => entry.standing.team.id),
    }));
}
