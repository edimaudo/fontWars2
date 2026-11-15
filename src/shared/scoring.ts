export const ROUND_DURATION_MS = 12_000;
export const NETWORK_GRACE_MS = 500;
export const MAX_ACCEPTED_ELAPSED_MS = ROUND_DURATION_MS + NETWORK_GRACE_MS;

/**
 * Speed/accuracy scoring from the PRD:
 * - 0–2 seconds: 1,000 points
 * - 2–12 seconds: linear decay to 600 points
 * - incorrect/timeout: 0 points
 *
 * The 500 ms transport grace is accepted server-side, but score decay is
 * capped at the 12-second game window so network latency cannot award extra time.
 */
export function scoreRound(isCorrect: boolean, elapsedMs: number): number {
  if (!isCorrect || !Number.isFinite(elapsedMs) || elapsedMs > MAX_ACCEPTED_ELAPSED_MS) {
    return 0;
  }

  const scoringElapsed = Math.max(0, Math.min(ROUND_DURATION_MS, elapsedMs));
  if (scoringElapsed <= 2_000) return 1_000;

  return Math.round(1_000 - ((scoringElapsed - 2_000) / 10_000) * 400);
}

export function accuracyPercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10;
}

export function percentileFromRank(rankAscending: number | null, total: number): number | null {
  if (rankAscending === null || total <= 0) return null;
  const positionFromTop = total - rankAscending;
  return Math.max(1, Math.min(100, Math.ceil((positionFromTop / total) * 100)));
}
