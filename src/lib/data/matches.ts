import type { GroupMatch } from '@/types';

// All kick-off times are UTC. The useLocalKickoff hook converts to the user's local timezone.
// Fixtures sourced from FIFA.com official schedule (fifa.com/worldcup/scores-fixtures).

export const GROUP_MATCHES: GroupMatch[] = [
  // ── Group A ──────────────────────────────────────────────
  { id: 1,  groupId: 'A', teamAId: 1,  teamBId: 2,  matchNumber: 1, date: '11 Jun', time: '19:00' },
  { id: 2,  groupId: 'A', teamAId: 3,  teamBId: 4,  matchNumber: 2, date: '12 Jun', time: '02:00' },
  { id: 3,  groupId: 'A', teamAId: 4,  teamBId: 2,  matchNumber: 3, date: '18 Jun', time: '16:00' },
  { id: 4,  groupId: 'A', teamAId: 1,  teamBId: 3,  matchNumber: 4, date: '19 Jun', time: '01:00' },
  { id: 5,  groupId: 'A', teamAId: 4,  teamBId: 1,  matchNumber: 5, date: '25 Jun', time: '01:00' },
  { id: 6,  groupId: 'A', teamAId: 2,  teamBId: 3,  matchNumber: 6, date: '25 Jun', time: '01:00' },

  // ── Group B ──────────────────────────────────────────────
  { id: 7,  groupId: 'B', teamAId: 5,  teamBId: 6,  matchNumber: 1, date: '12 Jun', time: '19:00' },
  { id: 8,  groupId: 'B', teamAId: 7,  teamBId: 8,  matchNumber: 2, date: '13 Jun', time: '19:00' },
  { id: 9,  groupId: 'B', teamAId: 8,  teamBId: 6,  matchNumber: 3, date: '18 Jun', time: '19:00' },
  { id: 10, groupId: 'B', teamAId: 5,  teamBId: 7,  matchNumber: 4, date: '18 Jun', time: '22:00' },
  { id: 11, groupId: 'B', teamAId: 8,  teamBId: 5,  matchNumber: 5, date: '24 Jun', time: '19:00' },
  { id: 12, groupId: 'B', teamAId: 6,  teamBId: 7,  matchNumber: 6, date: '24 Jun', time: '19:00' },

  // ── Group C ──────────────────────────────────────────────
  { id: 13, groupId: 'C', teamAId: 9,  teamBId: 10, matchNumber: 1, date: '13 Jun', time: '22:00' },
  { id: 14, groupId: 'C', teamAId: 11, teamBId: 12, matchNumber: 2, date: '14 Jun', time: '01:00' },
  { id: 15, groupId: 'C', teamAId: 12, teamBId: 10, matchNumber: 3, date: '19 Jun', time: '22:00' },
  { id: 16, groupId: 'C', teamAId: 9,  teamBId: 11, matchNumber: 4, date: '20 Jun', time: '00:30' },
  { id: 17, groupId: 'C', teamAId: 12, teamBId: 9,  matchNumber: 5, date: '24 Jun', time: '22:00' },
  { id: 18, groupId: 'C', teamAId: 10, teamBId: 11, matchNumber: 6, date: '24 Jun', time: '22:00' },

  // ── Group D ──────────────────────────────────────────────
  { id: 19, groupId: 'D', teamAId: 13, teamBId: 14, matchNumber: 1, date: '13 Jun', time: '01:00' },
  { id: 20, groupId: 'D', teamAId: 15, teamBId: 16, matchNumber: 2, date: '14 Jun', time: '04:00' },
  { id: 21, groupId: 'D', teamAId: 13, teamBId: 15, matchNumber: 3, date: '19 Jun', time: '19:00' },
  { id: 22, groupId: 'D', teamAId: 16, teamBId: 14, matchNumber: 4, date: '20 Jun', time: '03:00' },
  { id: 23, groupId: 'D', teamAId: 16, teamBId: 13, matchNumber: 5, date: '26 Jun', time: '02:00' },
  { id: 24, groupId: 'D', teamAId: 14, teamBId: 15, matchNumber: 6, date: '26 Jun', time: '02:00' },

  // ── Group E ──────────────────────────────────────────────
  { id: 25, groupId: 'E', teamAId: 17, teamBId: 18, matchNumber: 1, date: '14 Jun', time: '17:00' },
  { id: 26, groupId: 'E', teamAId: 19, teamBId: 20, matchNumber: 2, date: '14 Jun', time: '23:00' },
  { id: 27, groupId: 'E', teamAId: 17, teamBId: 19, matchNumber: 3, date: '20 Jun', time: '20:00' },
  { id: 28, groupId: 'E', teamAId: 20, teamBId: 18, matchNumber: 4, date: '21 Jun', time: '00:00' },
  { id: 29, groupId: 'E', teamAId: 18, teamBId: 19, matchNumber: 5, date: '25 Jun', time: '20:00' },
  { id: 30, groupId: 'E', teamAId: 20, teamBId: 17, matchNumber: 6, date: '25 Jun', time: '20:00' },

  // ── Group F ──────────────────────────────────────────────
  { id: 31, groupId: 'F', teamAId: 21, teamBId: 22, matchNumber: 1, date: '14 Jun', time: '20:00' },
  { id: 32, groupId: 'F', teamAId: 23, teamBId: 24, matchNumber: 2, date: '15 Jun', time: '02:00' },
  { id: 33, groupId: 'F', teamAId: 21, teamBId: 23, matchNumber: 3, date: '20 Jun', time: '17:00' },
  { id: 34, groupId: 'F', teamAId: 24, teamBId: 22, matchNumber: 4, date: '21 Jun', time: '04:00' },
  { id: 35, groupId: 'F', teamAId: 22, teamBId: 23, matchNumber: 5, date: '25 Jun', time: '23:00' },
  { id: 36, groupId: 'F', teamAId: 24, teamBId: 21, matchNumber: 6, date: '25 Jun', time: '23:00' },

  // ── Group G ──────────────────────────────────────────────
  { id: 37, groupId: 'G', teamAId: 25, teamBId: 26, matchNumber: 1, date: '15 Jun', time: '19:00' },
  { id: 38, groupId: 'G', teamAId: 27, teamBId: 28, matchNumber: 2, date: '16 Jun', time: '01:00' },
  { id: 39, groupId: 'G', teamAId: 25, teamBId: 27, matchNumber: 3, date: '21 Jun', time: '19:00' },
  { id: 40, groupId: 'G', teamAId: 28, teamBId: 26, matchNumber: 4, date: '22 Jun', time: '01:00' },
  { id: 41, groupId: 'G', teamAId: 26, teamBId: 27, matchNumber: 5, date: '27 Jun', time: '03:00' },
  { id: 42, groupId: 'G', teamAId: 28, teamBId: 25, matchNumber: 6, date: '27 Jun', time: '03:00' },

  // ── Group H ──────────────────────────────────────────────
  { id: 43, groupId: 'H', teamAId: 29, teamBId: 30, matchNumber: 1, date: '15 Jun', time: '16:00' },
  { id: 44, groupId: 'H', teamAId: 31, teamBId: 32, matchNumber: 2, date: '15 Jun', time: '22:00' },
  { id: 45, groupId: 'H', teamAId: 29, teamBId: 31, matchNumber: 3, date: '21 Jun', time: '16:00' },
  { id: 46, groupId: 'H', teamAId: 32, teamBId: 30, matchNumber: 4, date: '21 Jun', time: '22:00' },
  { id: 47, groupId: 'H', teamAId: 30, teamBId: 31, matchNumber: 5, date: '27 Jun', time: '00:00' },
  { id: 48, groupId: 'H', teamAId: 32, teamBId: 29, matchNumber: 6, date: '27 Jun', time: '00:00' },

  // ── Group I ──────────────────────────────────────────────
  { id: 49, groupId: 'I', teamAId: 33, teamBId: 34, matchNumber: 1, date: '16 Jun', time: '19:00' },
  { id: 50, groupId: 'I', teamAId: 35, teamBId: 36, matchNumber: 2, date: '16 Jun', time: '22:00' },
  { id: 51, groupId: 'I', teamAId: 33, teamBId: 35, matchNumber: 3, date: '22 Jun', time: '21:00' },
  { id: 52, groupId: 'I', teamAId: 36, teamBId: 34, matchNumber: 4, date: '23 Jun', time: '00:00' },
  { id: 53, groupId: 'I', teamAId: 36, teamBId: 33, matchNumber: 5, date: '26 Jun', time: '19:00' },
  { id: 54, groupId: 'I', teamAId: 34, teamBId: 35, matchNumber: 6, date: '26 Jun', time: '19:00' },

  // ── Group J ──────────────────────────────────────────────
  { id: 55, groupId: 'J', teamAId: 37, teamBId: 38, matchNumber: 1, date: '17 Jun', time: '01:00' },
  { id: 56, groupId: 'J', teamAId: 39, teamBId: 40, matchNumber: 2, date: '17 Jun', time: '04:00' },
  { id: 57, groupId: 'J', teamAId: 37, teamBId: 39, matchNumber: 3, date: '22 Jun', time: '17:00' },
  { id: 58, groupId: 'J', teamAId: 40, teamBId: 38, matchNumber: 4, date: '23 Jun', time: '03:00' },
  { id: 59, groupId: 'J', teamAId: 38, teamBId: 39, matchNumber: 5, date: '28 Jun', time: '02:00' },
  { id: 60, groupId: 'J', teamAId: 40, teamBId: 37, matchNumber: 6, date: '28 Jun', time: '02:00' },

  // ── Group K ──────────────────────────────────────────────
  { id: 61, groupId: 'K', teamAId: 41, teamBId: 42, matchNumber: 1, date: '17 Jun', time: '17:00' },
  { id: 62, groupId: 'K', teamAId: 43, teamBId: 44, matchNumber: 2, date: '18 Jun', time: '02:00' },
  { id: 63, groupId: 'K', teamAId: 41, teamBId: 43, matchNumber: 3, date: '23 Jun', time: '17:00' },
  { id: 64, groupId: 'K', teamAId: 44, teamBId: 42, matchNumber: 4, date: '24 Jun', time: '02:00' },
  { id: 65, groupId: 'K', teamAId: 44, teamBId: 41, matchNumber: 5, date: '27 Jun', time: '23:30' },
  { id: 66, groupId: 'K', teamAId: 42, teamBId: 43, matchNumber: 6, date: '27 Jun', time: '23:30' },

  // ── Group L ──────────────────────────────────────────────
  { id: 67, groupId: 'L', teamAId: 45, teamBId: 46, matchNumber: 1, date: '17 Jun', time: '20:00' },
  { id: 68, groupId: 'L', teamAId: 47, teamBId: 48, matchNumber: 2, date: '17 Jun', time: '23:00' },
  { id: 69, groupId: 'L', teamAId: 45, teamBId: 47, matchNumber: 3, date: '23 Jun', time: '20:00' },
  { id: 70, groupId: 'L', teamAId: 48, teamBId: 46, matchNumber: 4, date: '23 Jun', time: '23:00' },
  { id: 71, groupId: 'L', teamAId: 48, teamBId: 45, matchNumber: 5, date: '27 Jun', time: '21:00' },
  { id: 72, groupId: 'L', teamAId: 46, teamBId: 47, matchNumber: 6, date: '27 Jun', time: '21:00' },
];

export function getMatchesByGroup(groupId: string): GroupMatch[] {
  return GROUP_MATCHES.filter((m) => m.groupId === groupId);
}
