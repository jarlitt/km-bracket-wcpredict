import type { Team, TeamStanding } from '@/types';
import { getTeamsByGroup } from '@/lib/data/teams';
import { getMatchesByGroup } from '@/lib/data/matches';

type ScorePrediction = { scoreA: number; scoreB: number };

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

function compareStandings(a: TeamStanding, b: TeamStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  if (a.team.fifaRanking !== b.team.fifaRanking) return a.team.fifaRanking - b.team.fifaRanking;
  return a.team.name.localeCompare(b.team.name);
}

export function calculateGroupStandings(
  groupId: string,
  predictions: Record<number, ScorePrediction>,
): TeamStanding[] {
  const teams = getTeamsByGroup(groupId);
  const matches = getMatchesByGroup(groupId);

  const standingsMap = new Map<number, TeamStanding>();
  for (const team of teams) {
    standingsMap.set(team.id, createEmptyStanding(team));
  }

  for (const match of matches) {
    const prediction = predictions[match.id];
    if (!prediction) continue;

    const standingA = standingsMap.get(match.teamAId)!;
    const standingB = standingsMap.get(match.teamBId)!;

    applyMatchResult(standingA, prediction.scoreA, prediction.scoreB);
    applyMatchResult(standingB, prediction.scoreB, prediction.scoreA);
  }

  return Array.from(standingsMap.values()).sort(compareStandings);
}
