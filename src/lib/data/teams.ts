import type { Team, GroupId } from '@/types';

export const GROUPS: GroupId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export const TEAMS: Team[] = [
  // Group A
  { id: 1, name: 'Mexico', code: 'MEX', flag: '🇲🇽', groupId: 'A', fifaRanking: 15 },
  { id: 2, name: 'South Africa', code: 'RSA', flag: '🇿🇦', groupId: 'A', fifaRanking: 60 },
  { id: 3, name: 'South Korea', code: 'KOR', flag: '🇰🇷', groupId: 'A', fifaRanking: 25 },
  { id: 4, name: 'Czechia', code: 'CZE', flag: '🇨🇿', groupId: 'A', fifaRanking: 41 },

  // Group B
  { id: 5, name: 'Canada', code: 'CAN', flag: '🇨🇦', groupId: 'B', fifaRanking: 30 },
  { id: 6, name: 'Bosnia & Herzegovina', code: 'BIH', flag: '🇧🇦', groupId: 'B', fifaRanking: 65 },
  { id: 7, name: 'Qatar', code: 'QAT', flag: '🇶🇦', groupId: 'B', fifaRanking: 55 },
  { id: 8, name: 'Switzerland', code: 'SUI', flag: '🇨🇭', groupId: 'B', fifaRanking: 19 },

  // Group C
  { id: 9, name: 'Brazil', code: 'BRA', flag: '🇧🇷', groupId: 'C', fifaRanking: 6 },
  { id: 10, name: 'Morocco', code: 'MAR', flag: '🇲🇦', groupId: 'C', fifaRanking: 8 },
  { id: 11, name: 'Haiti', code: 'HAI', flag: '🇭🇹', groupId: 'C', fifaRanking: 83 },
  { id: 12, name: 'Scotland', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', groupId: 'C', fifaRanking: 43 },

  // Group D
  { id: 13, name: 'USA', code: 'USA', flag: '🇺🇸', groupId: 'D', fifaRanking: 16 },
  { id: 14, name: 'Paraguay', code: 'PAR', flag: '🇵🇾', groupId: 'D', fifaRanking: 40 },
  { id: 15, name: 'Australia', code: 'AUS', flag: '🇦🇺', groupId: 'D', fifaRanking: 27 },
  { id: 16, name: 'Türkiye', code: 'TUR', flag: '🇹🇷', groupId: 'D', fifaRanking: 22 },

  // Group E
  { id: 17, name: 'Germany', code: 'GER', flag: '🇩🇪', groupId: 'E', fifaRanking: 10 },
  { id: 18, name: 'Curaçao', code: 'CUW', flag: '🇨🇼', groupId: 'E', fifaRanking: 82 },
  { id: 19, name: 'Ivory Coast', code: 'CIV', flag: '🇨🇮', groupId: 'E', fifaRanking: 34 },
  { id: 20, name: 'Ecuador', code: 'ECU', flag: '🇪🇨', groupId: 'E', fifaRanking: 23 },

  // Group F
  { id: 21, name: 'Netherlands', code: 'NED', flag: '🇳🇱', groupId: 'F', fifaRanking: 7 },
  { id: 22, name: 'Japan', code: 'JPN', flag: '🇯🇵', groupId: 'F', fifaRanking: 18 },
  { id: 23, name: 'Sweden', code: 'SWE', flag: '🇸🇪', groupId: 'F', fifaRanking: 38 },
  { id: 24, name: 'Tunisia', code: 'TUN', flag: '🇹🇳', groupId: 'F', fifaRanking: 44 },

  // Group G
  { id: 25, name: 'Belgium', code: 'BEL', flag: '🇧🇪', groupId: 'G', fifaRanking: 9 },
  { id: 26, name: 'Egypt', code: 'EGY', flag: '🇪🇬', groupId: 'G', fifaRanking: 29 },
  { id: 27, name: 'Iran', code: 'IRN', flag: '🇮🇷', groupId: 'G', fifaRanking: 21 },
  { id: 28, name: 'New Zealand', code: 'NZL', flag: '🇳🇿', groupId: 'G', fifaRanking: 85 },

  // Group H
  { id: 29, name: 'Spain', code: 'ESP', flag: '🇪🇸', groupId: 'H', fifaRanking: 2 },
  { id: 30, name: 'Cape Verde', code: 'CPV', flag: '🇨🇻', groupId: 'H', fifaRanking: 69 },
  { id: 31, name: 'Saudi Arabia', code: 'KSA', flag: '🇸🇦', groupId: 'H', fifaRanking: 61 },
  { id: 32, name: 'Uruguay', code: 'URU', flag: '🇺🇾', groupId: 'H', fifaRanking: 17 },

  // Group I
  { id: 33, name: 'France', code: 'FRA', flag: '🇫🇷', groupId: 'I', fifaRanking: 1 },
  { id: 34, name: 'Senegal', code: 'SEN', flag: '🇸🇳', groupId: 'I', fifaRanking: 14 },
  { id: 35, name: 'Iraq', code: 'IRQ', flag: '🇮🇶', groupId: 'I', fifaRanking: 57 },
  { id: 36, name: 'Norway', code: 'NOR', flag: '🇳🇴', groupId: 'I', fifaRanking: 31 },

  // Group J
  { id: 37, name: 'Argentina', code: 'ARG', flag: '🇦🇷', groupId: 'J', fifaRanking: 3 },
  { id: 38, name: 'Algeria', code: 'ALG', flag: '🇩🇿', groupId: 'J', fifaRanking: 28 },
  { id: 39, name: 'Austria', code: 'AUT', flag: '🇦🇹', groupId: 'J', fifaRanking: 24 },
  { id: 40, name: 'Jordan', code: 'JOR', flag: '🇯🇴', groupId: 'J', fifaRanking: 63 },

  // Group K
  { id: 41, name: 'Portugal', code: 'POR', flag: '🇵🇹', groupId: 'K', fifaRanking: 5 },
  { id: 42, name: 'DR Congo', code: 'COD', flag: '🇨🇩', groupId: 'K', fifaRanking: 46 },
  { id: 43, name: 'Uzbekistan', code: 'UZB', flag: '🇺🇿', groupId: 'K', fifaRanking: 50 },
  { id: 44, name: 'Colombia', code: 'COL', flag: '🇨🇴', groupId: 'K', fifaRanking: 13 },

  // Group L
  { id: 45, name: 'England', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', groupId: 'L', fifaRanking: 4 },
  { id: 46, name: 'Croatia', code: 'CRO', flag: '🇭🇷', groupId: 'L', fifaRanking: 11 },
  { id: 47, name: 'Ghana', code: 'GHA', flag: '🇬🇭', groupId: 'L', fifaRanking: 74 },
  { id: 48, name: 'Panama', code: 'PAN', flag: '🇵🇦', groupId: 'L', fifaRanking: 33 },
];

export function getTeamById(id: number): Team {
  const team = TEAMS.find((t) => t.id === id);
  if (!team) throw new Error(`Team with id ${id} not found`);
  return team;
}

export function getTeamsByGroup(groupId: string): Team[] {
  return TEAMS.filter((t) => t.groupId === groupId);
}
