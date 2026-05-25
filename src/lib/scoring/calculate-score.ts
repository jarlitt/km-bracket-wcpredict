import type { UserPredictions, TeamStanding, ScoreBreakdown, ScoreDetail } from '@/types';
import { GROUPS } from '@/lib/data/teams';
import { GROUP_MATCHES } from '@/lib/data/matches';
import { calculateGroupStandings } from '@/lib/standings/calculate-standings';

interface ActualResults {
  groupResults: Record<number, { scoreA: number; scoreB: number }>;
  knockoutResults: Record<string, number>;
  actualGroupStandings: Record<string, TeamStanding[]>;
}

const KNOCKOUT_POINTS: Record<string, number> = {
  R32: 2,
  R16: 4,
  QF: 6,
  SF: 8,
  '3RD': 5,
  F: 15,
};

function getMatchOutcome(scoreA: number, scoreB: number): 'A' | 'B' | 'D' {
  if (scoreA > scoreB) return 'A';
  if (scoreB > scoreA) return 'B';
  return 'D';
}

function scoreGroupMatches(
  predictions: UserPredictions,
  actual: ActualResults,
): { points: number; bonus: number; details: ScoreDetail[] } {
  let points = 0;
  let bonus = 0;
  const details: ScoreDetail[] = [];

  for (const match of GROUP_MATCHES) {
    const pred = predictions.groupPredictions[match.id];
    const result = actual.groupResults[match.id];
    if (!pred || !result) continue;

    const predOutcome = getMatchOutcome(pred.scoreA, pred.scoreB);
    const actualOutcome = getMatchOutcome(result.scoreA, result.scoreB);

    if (predOutcome === actualOutcome) {
      points += 3;
      details.push({ category: 'Group Match', description: `Match ${match.id}: correct result`, points: 3 });

      if (pred.scoreA === result.scoreA && pred.scoreB === result.scoreB) {
        bonus += 2;
        details.push({ category: 'Exact Score', description: `Match ${match.id}: exact scoreline`, points: 2 });
      }
    }
  }

  return { points, bonus, details };
}

function scoreGroupPositions(
  predictions: UserPredictions,
  actual: ActualResults,
): { points: number; details: ScoreDetail[] } {
  let points = 0;
  const details: ScoreDetail[] = [];
  const positionPoints = [4, 3, 2];

  for (const groupId of GROUPS) {
    const actualStandings = actual.actualGroupStandings[groupId];
    if (!actualStandings) continue;

    const predictedStandings: TeamStanding[] = calculateGroupStandings(groupId, predictions.groupPredictions);

    for (let pos = 0; pos < 3; pos++) {
      if (
        predictedStandings[pos] &&
        actualStandings[pos] &&
        predictedStandings[pos].team.id === actualStandings[pos].team.id
      ) {
        const pts = positionPoints[pos];
        points += pts;
        const label = pos === 0 ? '1st' : pos === 1 ? '2nd' : '3rd';
        details.push({
          category: 'Group Position',
          description: `Group ${groupId}: correct ${label} place`,
          points: pts,
        });
      }
    }
  }

  return { points, details };
}

function scoreKnockout(
  predictions: UserPredictions,
  actual: ActualResults,
): { points: number; details: ScoreDetail[] } {
  let points = 0;
  const details: ScoreDetail[] = [];

  for (const [matchId, predictedWinnerId] of Object.entries(predictions.knockoutPredictions)) {
    const actualWinner = actual.knockoutResults[matchId];
    if (actualWinner === undefined) continue;

    if (predictedWinnerId === actualWinner) {
      const round = matchId.split('-')[0] as string;
      const roundKey = matchId === '3RD' ? '3RD' : matchId === 'F' ? 'F' : round;
      const pts = KNOCKOUT_POINTS[roundKey] ?? 0;
      points += pts;
      details.push({ category: 'Knockout', description: `${matchId}: correct winner`, points: pts });
    }
  }

  return { points, details };
}

export function calculateScore(
  userPredictions: UserPredictions,
  actualResults: ActualResults,
): ScoreBreakdown {
  const groupMatch = scoreGroupMatches(userPredictions, actualResults);
  const groupPosition = scoreGroupPositions(userPredictions, actualResults);
  const knockout = scoreKnockout(userPredictions, actualResults);

  const allDetails = [...groupMatch.details, ...groupPosition.details, ...knockout.details];

  return {
    groupMatchPoints: groupMatch.points,
    exactScoreBonus: groupMatch.bonus,
    groupPositionPoints: groupPosition.points,
    knockoutPoints: knockout.points,
    total: groupMatch.points + groupMatch.bonus + groupPosition.points + knockout.points,
    details: allDetails,
  };
}
