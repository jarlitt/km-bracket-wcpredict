export interface Team {
  id: number;
  name: string;
  code: string;
  flag: string;
  groupId: string;
}

export interface GroupMatch {
  id: number;
  groupId: string;
  teamAId: number;
  teamBId: number;
  matchNumber: number;
}

export interface GroupPrediction {
  scoreA: number;
  scoreB: number;
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
}

export interface KnockoutPrediction {
  matchId: string;
  winnerId: number;
}

export interface UserPredictions {
  groupPredictions: Record<number, GroupPrediction>;
  knockoutPredictions: Record<string, number>;
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
