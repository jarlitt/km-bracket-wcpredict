import type { GroupMatch, Team, TeamStanding } from '@/types';
import { getTeamsByGroup } from '@/lib/data/teams';
import { getMatchesByGroup } from '@/lib/data/matches';

type ScorePrediction = { scoreA?: number; scoreB?: number };
type HeadToHeadMetricKey = keyof Pick<TeamStanding, 'points' | 'goalDifference' | 'goalsFor'>;
type StandingMetric = (standing: TeamStanding, tiedTeamIds: Set<number>) => number | string;
type SortDirection = 'asc' | 'desc';
export type TieBreakResolutionScope = 'group' | 'third-place';
export type TieBreakResolutions = Record<string, number[]>;

export interface UnresolvedTie {
  groupId: string;
  key: string;
  teamIds: number[];
}

interface CalculateGroupStandingsOptions {
  tieBreakResolutions?: TieBreakResolutions;
}

interface RankingCriterion {
  metric: StandingMetric;
  direction: SortDirection;
}

function createEmptyStanding(team: Team): TeamStanding {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function applyMatchResult(standing: TeamStanding, goalsFor: number, goalsAgainst: number): void {
  standing.played++;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    standing.won++;
    standing.points += 3;
  } else if (goalsFor === goalsAgainst) {
    standing.drawn++;
    standing.points += 1;
  } else {
    standing.lost++;
  }
}

function compareMetricValues(a: number | string, b: number | string, direction: SortDirection): number {
  if (typeof a === 'string' && typeof b === 'string') {
    return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
  }

  const diff = Number(a) - Number(b);
  return direction === 'asc' ? diff : -diff;
}

function addToMetric(metrics: Map<number, TeamStanding>, teamId: number, goalsFor: number, goalsAgainst: number): void {
  const standing = metrics.get(teamId);
  if (!standing) return;

  applyMatchResult(standing, goalsFor, goalsAgainst);
}

function calculateHeadToHeadStandings(
  standings: TeamStanding[],
  matches: GroupMatch[],
  predictions: Record<number, ScorePrediction>,
  tiedTeamIds: Set<number>,
): Map<number, TeamStanding> {
  const metrics = new Map<number, TeamStanding>();
  for (const standing of standings) {
    metrics.set(standing.team.id, createEmptyStanding(standing.team));
  }

  for (const match of matches) {
    if (!tiedTeamIds.has(match.teamAId) || !tiedTeamIds.has(match.teamBId)) continue;

    const prediction = predictions[match.id];
    if (!prediction) continue;

    const { scoreA, scoreB } = prediction;
    if (typeof scoreA !== 'number' || typeof scoreB !== 'number') continue;

    addToMetric(metrics, match.teamAId, scoreA, scoreB);
    addToMetric(metrics, match.teamBId, scoreB, scoreA);
  }

  return metrics;
}

export function tieBreakResolutionKey(
  scope: TieBreakResolutionScope,
  groupId: string,
  teamIds: number[],
): string {
  return `${scope}:${groupId}:${[...teamIds].sort((a, b) => a - b).join(',')}`;
}

function getResolutionRank(
  tieBreakResolutions: TieBreakResolutions,
  scope: TieBreakResolutionScope,
  groupId: string,
): StandingMetric {
  return (standing, tiedTeamIds) => {
    const key = tieBreakResolutionKey(scope, groupId, Array.from(tiedTeamIds));
    const resolution = tieBreakResolutions[key] ?? [];
    const index = resolution.indexOf(standing.team.id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
}

function groupByPoints(standings: TeamStanding[]): TeamStanding[][] {
  const groups: TeamStanding[][] = [];

  for (const standing of standings.sort((a, b) => b.points - a.points)) {
    const currentGroup = groups.at(-1);
    if (currentGroup && currentGroup[0].points === standing.points) {
      currentGroup.push(standing);
    } else {
      groups.push([standing]);
    }
  }

  return groups;
}

function rankTiedTeams(
  standings: TeamStanding[],
  criteria: RankingCriterion[],
  criterionIndex = 0,
): TeamStanding[] {
  if (standings.length <= 1 || criterionIndex >= criteria.length) return standings;

  const criterion = criteria[criterionIndex];
  const tiedTeamIds = new Set(standings.map((standing) => standing.team.id));
  const buckets = new Map<number | string, TeamStanding[]>();

  for (const standing of standings) {
    const value = criterion.metric(standing, tiedTeamIds);
    buckets.set(value, [...(buckets.get(value) ?? []), standing]);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => compareMetricValues(a, b, criterion.direction))
    .flatMap(([, bucket]) => rankTiedTeams(bucket, criteria, criterionIndex + 1));
}

function findRemainingTies(
  standings: TeamStanding[],
  criteria: RankingCriterion[],
  criterionIndex = 0,
): TeamStanding[][] {
  if (standings.length <= 1) return [];
  if (criterionIndex >= criteria.length) return [standings];

  const criterion = criteria[criterionIndex];
  const tiedTeamIds = new Set(standings.map((standing) => standing.team.id));
  const buckets = new Map<number | string, TeamStanding[]>();

  for (const standing of standings) {
    const value = criterion.metric(standing, tiedTeamIds);
    buckets.set(value, [...(buckets.get(value) ?? []), standing]);
  }

  return Array.from(buckets.values()).flatMap((bucket) =>
    findRemainingTies(bucket, criteria, criterionIndex + 1),
  );
}

function buildScoreCriteria(
  standings: TeamStanding[],
  matches: GroupMatch[],
  predictions: Record<number, ScorePrediction>,
): RankingCriterion[] {
  const headToHeadCache = new Map<string, Map<number, TeamStanding>>();

  const getHeadToHeadMetricValue = (
    standing: TeamStanding,
    tiedTeamIds: Set<number>,
    metric: HeadToHeadMetricKey,
  ): number => {
    const cacheKey = Array.from(tiedTeamIds).sort((a, b) => a - b).join(',');
    if (!headToHeadCache.has(cacheKey)) {
      headToHeadCache.set(
        cacheKey,
        calculateHeadToHeadStandings(standings, matches, predictions, tiedTeamIds),
      );
    }

    return headToHeadCache.get(cacheKey)?.get(standing.team.id)?.[metric] ?? 0;
  };

  return [
    {
      metric: (standing, tiedTeamIds) => getHeadToHeadMetricValue(standing, tiedTeamIds, 'points'),
      direction: 'desc',
    },
    {
      metric: (standing, tiedTeamIds) => getHeadToHeadMetricValue(standing, tiedTeamIds, 'goalDifference'),
      direction: 'desc',
    },
    {
      metric: (standing, tiedTeamIds) => getHeadToHeadMetricValue(standing, tiedTeamIds, 'goalsFor'),
      direction: 'desc',
    },
    { metric: (standing) => standing.goalDifference, direction: 'desc' },
    { metric: (standing) => standing.goalsFor, direction: 'desc' },
  ];
}

function calculateBaseStandings(
  groupId: string,
  predictions: Record<number, ScorePrediction>,
): { standings: TeamStanding[]; matches: GroupMatch[] } {
  const teams = getTeamsByGroup(groupId);
  const matches = getMatchesByGroup(groupId);

  const standingsMap = new Map<number, TeamStanding>();
  for (const team of teams) {
    standingsMap.set(team.id, createEmptyStanding(team));
  }

  for (const match of matches) {
    const prediction = predictions[match.id];
    if (!prediction) continue;
    const { scoreA, scoreB } = prediction;
    if (typeof scoreA !== 'number' || typeof scoreB !== 'number') continue;

    const standingA = standingsMap.get(match.teamAId)!;
    const standingB = standingsMap.get(match.teamBId)!;

    applyMatchResult(standingA, scoreA, scoreB);
    applyMatchResult(standingB, scoreB, scoreA);
  }

  return { standings: Array.from(standingsMap.values()), matches };
}

export function calculateGroupStandings(
  groupId: string,
  predictions: Record<number, ScorePrediction>,
  options: CalculateGroupStandingsOptions = {},
): TeamStanding[] {
  const { standings, matches } = calculateBaseStandings(groupId, predictions);
  const scoreCriteria = buildScoreCriteria(standings, matches, predictions);
  const criteria: RankingCriterion[] = [
    ...scoreCriteria,
    {
      metric: getResolutionRank(options.tieBreakResolutions ?? {}, 'group', groupId),
      direction: 'asc',
    },
    // Conduct score is omitted until card/fair-play data exists; FIFA ranking is the next available criterion.
    { metric: (standing) => standing.team.fifaRanking, direction: 'asc' },
    { metric: (standing) => standing.team.name, direction: 'asc' },
  ];

  return groupByPoints(standings).flatMap((pointsGroup) => rankTiedTeams(pointsGroup, criteria));
}

export function findUnresolvedGroupTies(
  groupId: string,
  predictions: Record<number, ScorePrediction>,
): UnresolvedTie[] {
  const { standings, matches } = calculateBaseStandings(groupId, predictions);
  const scoreCriteria = buildScoreCriteria(standings, matches, predictions);

  return groupByPoints(standings)
    .flatMap((pointsGroup) => findRemainingTies(pointsGroup, scoreCriteria))
    .map((bucket) => ({
      groupId,
      key: tieBreakResolutionKey('group', groupId, bucket.map((standing) => standing.team.id)),
      teamIds: bucket.map((standing) => standing.team.id),
    }));
}
