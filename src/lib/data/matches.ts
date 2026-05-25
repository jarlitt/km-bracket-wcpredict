import type { GroupMatch } from '@/types';
import { getTeamsByGroup, GROUPS } from './teams';

const INTRA_GROUP_PAIRINGS: [number, number][] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

function generateGroupMatches(): GroupMatch[] {
  const matches: GroupMatch[] = [];
  let matchId = 1;

  for (const groupId of GROUPS) {
    const teams = getTeamsByGroup(groupId);

    for (let i = 0; i < INTRA_GROUP_PAIRINGS.length; i++) {
      const [a, b] = INTRA_GROUP_PAIRINGS[i];
      matches.push({
        id: matchId++,
        groupId,
        teamAId: teams[a].id,
        teamBId: teams[b].id,
        matchNumber: i + 1,
      });
    }
  }

  return matches;
}

export const GROUP_MATCHES: GroupMatch[] = generateGroupMatches();

export function getMatchesByGroup(groupId: string): GroupMatch[] {
  return GROUP_MATCHES.filter((m) => m.groupId === groupId);
}
