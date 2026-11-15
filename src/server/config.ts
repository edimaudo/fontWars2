export const APP_NAME = 'fontWars';
export const VOLUME_EPOCH = '2026-10-31'; // The supplied Nov 13, 2026 specimen is Vol. 014.
export const ROUND_COUNT = 5;
export const MAX_DAILY_SCORE = ROUND_COUNT * 1_000;
export const PUZZLE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 45;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 400;
export const DAILY_STATS_RETENTION_SECONDS = 60 * 60 * 24 * 45;
export const DEFAULT_SERVER_SALT = 'fontwars-seed-v1-change-before-launch';

export const redisKeys = {
  puzzle: (date: string) => `fontwars:puzzle:${date}`,
  session: (postId: string, userId: string) => `fontwars:session:${postId}:${userId}`,
  postDate: (postId: string) => `fontwars:postdate:${postId}`,
  crowd: (date: string, round: number) => `fontwars:crowd:${date}:${round}`,
  leaderboard: (date: string) => `fontwars:lb:${date}`,
  user: (userId: string) => `fontwars:user:${userId}`,
  plays: (date: string) => `fontwars:plays:${date}`,
  playedUsers: (date: string) => `fontwars:played:${date}`,
  startedUsers: (date: string) => `fontwars:started:${date}`,
  dailyPostLock: (date: string) => `fontwars:daily-post-lock:${date}`,
  journeyEvents: (date: string) => `fontwars:journey:${date}`,
  stats: (date: string) => `fontwars:stats:${date}`,
  submissions: (postId: string, userId: string) => `fontwars:submitted:${postId}:${userId}`,
  dailyPost: (date: string) => `fontwars:daily-post:${date}`,
};
