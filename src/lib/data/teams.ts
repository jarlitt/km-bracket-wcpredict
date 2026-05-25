import type { Team, GroupId } from '@/types';

export const GROUPS: GroupId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export const TEAMS: Team[] = [
  // Group A
  { id: 1, name: 'Mexico', code: 'MEX', flag: '🇲🇽', groupId: 'A' },
  { id: 2, name: 'South Africa', code: 'RSA', flag: '🇿🇦', groupId: 'A' },
  { id: 3, name: 'South Korea', code: 'KOR', flag: '🇰🇷', groupId: 'A' },
  { id: 4, name: 'Czechia', code: 'CZE', flag: '🇨🇿', groupId: 'A' },

  // Group B
  { id: 5, name: 'Canada', code: 'CAN', flag: '🇨🇦', groupId: 'B' },
  { id: 6, name: 'Bosnia & Herzegovina', code: 'BIH', flag: '🇧🇦', groupId: 'B' },
  { id: 7, name: 'Qatar', code: 'QAT', flag: '🇶🇦', groupId: 'B' },
  { id: 8, name: 'Switzerland', code: 'SUI', flag: '🇨🇭', groupId: 'B' },

  // Group C
  { id: 9, name: 'Brazil', code: 'BRA', flag: '🇧🇷', groupId: 'C' },
  { id: 10, name: 'Morocco', code: 'MAR', flag: '🇲🇦', groupId: 'C' },
  { id: 11, name: 'Haiti', code: 'HAI', flag: '🇭🇹', groupId: 'C' },
  { id: 12, name: 'Scotland', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', groupId: 'C' },

  // Group D
  { id: 13, name: 'USA', code: 'USA', flag: '🇺🇸', groupId: 'D' },
  { id: 14, name: 'Paraguay', code: 'PAR', flag: '🇵🇾', groupId: 'D' },
  { id: 15, name: 'Australia', code: 'AUS', flag: '🇦🇺', groupId: 'D' },
  { id: 16, name: 'Türkiye', code: 'TUR', flag: '🇹🇷', groupId: 'D' },

  // Group E
  { id: 17, name: 'Germany', code: 'GER', flag: '🇩🇪', groupId: 'E' },
  { id: 18, name: 'Curaçao', code: 'CUW', flag: '🇨🇼', groupId: 'E' },
  { id: 19, name: 'Ivory Coast', code: 'CIV', flag: '🇨🇮', groupId: 'E' },
  { id: 20, name: 'Ecuador', code: 'ECU', flag: '🇪🇨', groupId: 'E' },

  // Group F
  { id: 21, name: 'Netherlands', code: 'NED', flag: '🇳🇱', groupId: 'F' },
  { id: 22, name: 'Japan', code: 'JPN', flag: '🇯🇵', groupId: 'F' },
  { id: 23, name: 'Sweden', code: 'SWE', flag: '🇸🇪', groupId: 'F' },
  { id: 24, name: 'Tunisia', code: 'TUN', flag: '🇹🇳', groupId: 'F' },

  // Group G
  { id: 25, name: 'Belgium', code: 'BEL', flag: '🇧🇪', groupId: 'G' },
  { id: 26, name: 'Egypt', code: 'EGY', flag: '🇪🇬', groupId: 'G' },
  { id: 27, name: 'Iran', code: 'IRN', flag: '🇮🇷', groupId: 'G' },
  { id: 28, name: 'New Zealand', code: 'NZL', flag: '🇳🇿', groupId: 'G' },

  // Group H
  { id: 29, name: 'Spain', code: 'ESP', flag: '🇪🇸', groupId: 'H' },
  { id: 30, name: 'Cape Verde', code: 'CPV', flag: '🇨🇻', groupId: 'H' },
  { id: 31, name: 'Saudi Arabia', code: 'KSA', flag: '🇸🇦', groupId: 'H' },
  { id: 32, name: 'Uruguay', code: 'URU', flag: '🇺🇾', groupId: 'H' },

  // Group I
  { id: 33, name: 'France', code: 'FRA', flag: '🇫🇷', groupId: 'I' },
  { id: 34, name: 'Senegal', code: 'SEN', flag: '🇸🇳', groupId: 'I' },
  { id: 35, name: 'Iraq', code: 'IRQ', flag: '🇮🇶', groupId: 'I' },
  { id: 36, name: 'Norway', code: 'NOR', flag: '🇳🇴', groupId: 'I' },

  // Group J
  { id: 37, name: 'Argentina', code: 'ARG', flag: '🇦🇷', groupId: 'J' },
  { id: 38, name: 'Algeria', code: 'ALG', flag: '🇩🇿', groupId: 'J' },
  { id: 39, name: 'Austria', code: 'AUT', flag: '🇦🇹', groupId: 'J' },
  { id: 40, name: 'Jordan', code: 'JOR', flag: '🇯🇴', groupId: 'J' },

  // Group K
  { id: 41, name: 'Portugal', code: 'POR', flag: '🇵🇹', groupId: 'K' },
  { id: 42, name: 'DR Congo', code: 'COD', flag: '🇨🇩', groupId: 'K' },
  { id: 43, name: 'Uzbekistan', code: 'UZB', flag: '🇺🇿', groupId: 'K' },
  { id: 44, name: 'Colombia', code: 'COL', flag: '🇨🇴', groupId: 'K' },

  // Group L
  { id: 45, name: 'England', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', groupId: 'L' },
  { id: 46, name: 'Croatia', code: 'CRO', flag: '🇭🇷', groupId: 'L' },
  { id: 47, name: 'Ghana', code: 'GHA', flag: '🇬🇭', groupId: 'L' },
  { id: 48, name: 'Panama', code: 'PAN', flag: '🇵🇦', groupId: 'L' },
];

export function getTeamById(id: number): Team {
  const team = TEAMS.find((t) => t.id === id);
  if (!team) throw new Error(`Team with id ${id} not found`);
  return team;
}

export function getTeamsByGroup(groupId: string): Team[] {
  return TEAMS.filter((t) => t.groupId === groupId);
}
