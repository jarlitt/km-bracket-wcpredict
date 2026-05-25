import type { TeamStanding } from '@/types';
import { GROUPS } from '@/lib/data/teams';

function compareThirdPlace(a: TeamStanding, b: TeamStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.team.name.localeCompare(b.team.name);
}

export interface ThirdPlaceEntry {
  groupId: string;
  standing: TeamStanding;
}

export function determineBestThirdPlaceTeams(
  allGroupStandings: Record<string, TeamStanding[]>,
): { qualifiedGroups: string[]; thirdPlaceTeams: TeamStanding[]; allThirdPlaceTeams: ThirdPlaceEntry[] } {
  const thirdPlaceByGroup: ThirdPlaceEntry[] = [];

  for (const groupId of GROUPS) {
    const standings = allGroupStandings[groupId];
    if (standings && standings.length >= 3) {
      thirdPlaceByGroup.push({ groupId, standing: standings[2] });
    }
  }

  thirdPlaceByGroup.sort((a, b) => compareThirdPlace(a.standing, b.standing));

  const qualified = thirdPlaceByGroup.slice(0, 8);
  const qualifiedGroups = qualified
    .map((entry) => entry.groupId)
    .sort();

  const thirdPlaceTeams = qualified.map((entry) => entry.standing);

  return { qualifiedGroups, thirdPlaceTeams, allThirdPlaceTeams: thirdPlaceByGroup };
}
