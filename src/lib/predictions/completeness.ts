export function hasCompleteScore(
  scoreA: number | undefined,
  scoreB: number | undefined,
): boolean {
  return typeof scoreA === 'number' && typeof scoreB === 'number'
}
