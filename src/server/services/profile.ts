import { getYesterdayUtc } from '../../shared/format';

export interface PlayerProfile {
  streak: number;
  maxStreak: number;
  lastCompletedDate: string | null;
  unlockedFlairs: string[];
}

export const EMPTY_PROFILE: PlayerProfile = {
  streak: 0,
  maxStreak: 0,
  lastCompletedDate: null,
  unlockedFlairs: [],
};

export function parseProfile(raw: string | null): PlayerProfile {
  if (!raw) return { ...EMPTY_PROFILE };
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      streak: Math.max(0, Number(parsed.streak) || 0),
      maxStreak: Math.max(0, Number(parsed.maxStreak) || 0),
      lastCompletedDate: typeof parsed.lastCompletedDate === 'string' ? parsed.lastCompletedDate : null,
      unlockedFlairs: Array.isArray(parsed.unlockedFlairs)
        ? parsed.unlockedFlairs.filter((item): item is string => typeof item === 'string')
        : [],
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function completeProfileDay(
  profile: PlayerProfile,
  date: string,
  totalScore: number,
  cleanTechnicalRounds: boolean,
): PlayerProfile {
  if (profile.lastCompletedDate === date) return profile;

  const nextStreak = profile.lastCompletedDate === getYesterdayUtc(date)
    ? profile.streak + 1
    : 1;

  const unlockedFlairs = new Set(profile.unlockedFlairs);
  if (totalScore >= 4_750) unlockedFlairs.add('95% Kerning God');
  if (nextStreak >= 7) unlockedFlairs.add('7-Day Streak');
  if (cleanTechnicalRounds) unlockedFlairs.add('Grotesk Purist');

  return {
    streak: nextStreak,
    maxStreak: Math.max(profile.maxStreak, nextStreak),
    lastCompletedDate: date,
    unlockedFlairs: [...unlockedFlairs],
  };
}
