export interface Team {
  id: number;
  name: string;
  code: string;
  flag: string;
  /** Filename slug for the SVG flag in /public/country-flags/Countries/<slug>.svg */
  flagSlug: string;
  groupId: string;
  fifaRanking: number;
}

export interface GroupMatch {
  id: number;
  groupId: string;
  teamAId: number;
  teamBId: number;
  matchNumber: number;
  date?: string;
  time?: string;
}

export interface GroupPrediction {
  scoreA?: number;
  scoreB?: number;
}

export interface TeamStanding {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface KnockoutMatch {
  id: string;
  round: 'R32' | 'R16' | 'QF' | 'SF' | '3RD' | 'F';
  position: number;
  teamAId: number | null;
  teamBId: number | null;
  label: string;
  date?: string;
  time?: string;
  matchNumber?: number;
}

export interface KnockoutPrediction {
  matchId: string;
  winnerId: number;
}

export interface KnockoutMatchup {
  teamAId: number | null;
  teamBId: number | null;
}

export interface UserPredictions {
  groupPredictions: Record<number, GroupPrediction>;
  knockoutPredictions: Record<string, number>;
  knockoutMatchups?: Record<string, KnockoutMatchup>;
  tieBreakResolutions?: Record<string, number[]>;
  submitted: boolean;
}

export interface ScoreBreakdown {
  groupMatchPoints: number;
  exactScoreBonus: number;
  groupPositionPoints: number;
  knockoutPoints: number;
  total: number;
  details: ScoreDetail[];
}

export interface ScoreDetail {
  category: string;
  description: string;
  points: number;
}

export type GroupId =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type PoolType = 'office';
export type PoolVisibility = 'public' | 'private';
export type PoolRole = 'member' | 'admin';

export interface Pool {
  id: string;
  name: string;
  slug: string;
  type: PoolType;
  visibility: PoolVisibility;
  isActive: boolean;
  createdAt: string;
}

export interface PoolMembership {
  pool: Pool;
  role: PoolRole;
  joinedAt: string;
}
