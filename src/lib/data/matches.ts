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

// Madrid time (CEST / UTC+2) — from FIFA.com with country=ES
const GROUP_SCHEDULE: Record<number, { date: string; time: string }> = {
  // Group A
  1:  { date: '11 Jun', time: '19:00' },
  2:  { date: '12 Jun', time: '02:00' },
  3:  { date: '19 Jun', time: '01:00' },
  4:  { date: '18 Jun', time: '16:00' },
  5:  { date: '25 Jun', time: '01:00' },
  6:  { date: '25 Jun', time: '01:00' },
  // Group B
  7:  { date: '12 Jun', time: '19:00' },
  8:  { date: '13 Jun', time: '19:00' },
  9:  { date: '18 Jun', time: '22:00' },
  10: { date: '18 Jun', time: '19:00' },
  11: { date: '24 Jun', time: '19:00' },
  12: { date: '24 Jun', time: '19:00' },
  // Group C
  13: { date: '13 Jun', time: '22:00' },
  14: { date: '14 Jun', time: '01:00' },
  15: { date: '20 Jun', time: '00:30' },
  16: { date: '19 Jun', time: '22:00' },
  17: { date: '24 Jun', time: '22:00' },
  18: { date: '24 Jun', time: '22:00' },
  // Group D
  19: { date: '13 Jun', time: '01:00' },
  20: { date: '14 Jun', time: '04:00' },
  21: { date: '19 Jun', time: '19:00' },
  22: { date: '20 Jun', time: '03:00' },
  23: { date: '26 Jun', time: '02:00' },
  24: { date: '26 Jun', time: '02:00' },
  // Group E
  25: { date: '14 Jun', time: '17:00' },
  26: { date: '14 Jun', time: '23:00' },
  27: { date: '20 Jun', time: '20:00' },
  28: { date: '21 Jun', time: '00:00' },
  29: { date: '25 Jun', time: '20:00' },
  30: { date: '25 Jun', time: '20:00' },
  // Group F
  31: { date: '14 Jun', time: '20:00' },
  32: { date: '15 Jun', time: '02:00' },
  33: { date: '20 Jun', time: '17:00' },
  34: { date: '21 Jun', time: '04:00' },
  35: { date: '25 Jun', time: '23:00' },
  36: { date: '25 Jun', time: '23:00' },
  // Group G
  37: { date: '15 Jun', time: '19:00' },
  38: { date: '16 Jun', time: '01:00' },
  39: { date: '21 Jun', time: '19:00' },
  40: { date: '22 Jun', time: '01:00' },
  41: { date: '27 Jun', time: '03:00' },
  42: { date: '27 Jun', time: '03:00' },
  // Group H
  43: { date: '15 Jun', time: '16:00' },
  44: { date: '15 Jun', time: '22:00' },
  45: { date: '21 Jun', time: '16:00' },
  46: { date: '21 Jun', time: '22:00' },
  47: { date: '27 Jun', time: '00:00' },
  48: { date: '27 Jun', time: '00:00' },
  // Group I
  49: { date: '16 Jun', time: '19:00' },
  50: { date: '16 Jun', time: '22:00' },
  51: { date: '22 Jun', time: '21:00' },
  52: { date: '23 Jun', time: '00:00' },
  53: { date: '26 Jun', time: '19:00' },
  54: { date: '26 Jun', time: '19:00' },
  // Group J
  55: { date: '17 Jun', time: '01:00' },
  56: { date: '17 Jun', time: '04:00' },
  57: { date: '22 Jun', time: '17:00' },
  58: { date: '23 Jun', time: '03:00' },
  59: { date: '28 Jun', time: '02:00' },
  60: { date: '28 Jun', time: '02:00' },
  // Group K
  61: { date: '17 Jun', time: '17:00' },
  62: { date: '18 Jun', time: '02:00' },
  63: { date: '23 Jun', time: '17:00' },
  64: { date: '24 Jun', time: '02:00' },
  65: { date: '27 Jun', time: '23:30' },
  66: { date: '27 Jun', time: '23:30' },
  // Group L
  67: { date: '17 Jun', time: '20:00' },
  68: { date: '17 Jun', time: '23:00' },
  69: { date: '23 Jun', time: '20:00' },
  70: { date: '23 Jun', time: '23:00' },
  71: { date: '27 Jun', time: '21:00' },
  72: { date: '27 Jun', time: '21:00' },
};

function generateGroupMatches(): GroupMatch[] {
  const matches: GroupMatch[] = [];
  let matchId = 1;

  for (const groupId of GROUPS) {
    const teams = getTeamsByGroup(groupId);

    for (let i = 0; i < INTRA_GROUP_PAIRINGS.length; i++) {
      const [a, b] = INTRA_GROUP_PAIRINGS[i];
      const sched = GROUP_SCHEDULE[matchId];
      matches.push({
        id: matchId,
        groupId,
        teamAId: teams[a].id,
        teamBId: teams[b].id,
        matchNumber: i + 1,
        date: sched?.date,
        time: sched?.time,
      });
      matchId++;
    }
  }

  return matches;
}

export const GROUP_MATCHES: GroupMatch[] = generateGroupMatches();

export function getMatchesByGroup(groupId: string): GroupMatch[] {
  return GROUP_MATCHES.filter((m) => m.groupId === groupId);
}
