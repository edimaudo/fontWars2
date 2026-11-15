import { describe, expect, it } from 'vitest';
import { completeProfileDay, EMPTY_PROFILE } from '../src/server/services/profile';

describe('player streak and milestone logic', () => {
  it('starts a streak at one and increments on consecutive UTC dates', () => {
    const dayOne = completeProfileDay(EMPTY_PROFILE, '2026-11-12', 4_000, false);
    const dayTwo = completeProfileDay(dayOne, '2026-11-13', 4_900, true);
    expect(dayOne.streak).toBe(1);
    expect(dayTwo.streak).toBe(2);
    expect(dayTwo.maxStreak).toBe(2);
  });

  it('resets a broken streak and does not double-count a date', () => {
    const previous = { ...EMPTY_PROFILE, streak: 5, maxStreak: 5, lastCompletedDate: '2026-11-10' };
    const completed = completeProfileDay(previous, '2026-11-13', 1_000, false);
    expect(completed.streak).toBe(1);
    expect(completeProfileDay(completed, '2026-11-13', 5_000, true)).toBe(completed);
  });

  it('unlocks the documented milestones', () => {
    const highScore = completeProfileDay(EMPTY_PROFILE, '2026-11-13', 4_750, true);
    expect(highScore.unlockedFlairs).toContain('95% Kerning God');
    expect(highScore.unlockedFlairs).toContain('Grotesk Purist');
  });
});
