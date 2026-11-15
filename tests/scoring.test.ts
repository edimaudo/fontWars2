import { describe, expect, it } from 'vitest';
import { MAX_ACCEPTED_ELAPSED_MS, scoreRound } from '../src/shared/scoring';

describe('fontWars scoring', () => {
  it('awards full points inside the two-second grace window', () => {
    expect(scoreRound(true, 0)).toBe(1_000);
    expect(scoreRound(true, 2_000)).toBe(1_000);
  });

  it('decays linearly to 600 points at twelve seconds', () => {
    expect(scoreRound(true, 7_000)).toBe(800);
    expect(scoreRound(true, 12_000)).toBe(600);
  });

  it('accepts the network buffer without awarding extra points', () => {
    expect(scoreRound(true, MAX_ACCEPTED_ELAPSED_MS)).toBe(600);
    expect(scoreRound(true, MAX_ACCEPTED_ELAPSED_MS + 1)).toBe(0);
  });

  it('awards zero for a wrong answer or timeout', () => {
    expect(scoreRound(false, 500)).toBe(0);
    expect(scoreRound(true, Number.NaN)).toBe(0);
  });
});
