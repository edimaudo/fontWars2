import type { DailyPuzzle, DailyPuzzleRound, InitPayload, RoundResult, SessionState } from '../../shared/types';
import { getYesterdayUtc } from '../../shared/format';
import { getFont, getRoundContent, getRoundFontOptions, getTargetSpecimen } from './dailyPuzzle';
import { completeProfileDay, parseProfile, type PlayerProfile } from './profile';
import { redisKeys, ROUND_COUNT, SESSION_TTL_SECONDS, DAILY_STATS_RETENTION_SECONDS } from '../config';
import { redis } from '@devvit/redis';
import { notifications, reddit, settings, context } from '@devvit/web/server';
import { scoreRound, percentileFromRank } from '../../shared/scoring';
import type { ActiveRoundPayload, RevealPayload } from '../../shared/types';

export interface Identity {
  userId: string;
  username: string;
  subredditName: string;
  postId: string;
}

export async function currentIdentity(): Promise<Identity | null> {
  const ctx = context as unknown as {
    userId?: string | null;
    subredditName?: string | null;
    postId?: string | null;
  };
  if (!ctx.userId || !ctx.subredditName || !ctx.postId) return null;
  const username = await reddit.getCurrentUsername();
  if (!username) return null;
  return {
    userId: String(ctx.userId),
    username,
    subredditName: ctx.subredditName,
    postId: ctx.postId,
  };
}

export function utcDateNow(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getServerSalt(): Promise<string> {
  const configured = await settings.get('serverSalt');
  return typeof configured === 'string' && configured.trim().length >= 16
    ? configured.trim()
    : 'fontwars-seed-v1-change-before-launch';
}

export async function getPuzzle(date: string, generate: (date: string, salt: string) => DailyPuzzle): Promise<DailyPuzzle> {
  const key = redisKeys.puzzle(date);
  const cached = await redis.get(key);
  if (cached) {
    try {
      return JSON.parse(cached) as DailyPuzzle;
    } catch {
      // A corrupt cache is regenerated below.
    }
  }
  const puzzle = generate(date, await getServerSalt());
  await redis.set(key, JSON.stringify(puzzle));
  return puzzle;
}

export async function resolvePostDate(postId: string, today: string): Promise<{ date: string; isArchive: boolean }> {
  const mapped = await redis.get(redisKeys.postDate(postId));
  let inferred = today;
  if (!mapped) {
    try {
      const post = await reddit.getPostById(postId);
      const createdAt = post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt as unknown as string | number);
      if (Number.isFinite(createdAt.getTime())) inferred = createdAt.toISOString().slice(0, 10);
    } catch {
      // A missing or inaccessible post falls back to today's puzzle.
    }
  }
  const date = mapped && /^\d{4}-\d{2}-\d{2}$/.test(mapped) ? mapped : inferred;
  return { date, isArchive: date !== today };
}

export function newSession(postId: string, userId: string, date: string, isArchive: boolean): SessionState {
  return {
    postId,
    userId,
    date,
    isArchive,
    status: 'UNSTARTED',
    currentRound: 1,
    roundStartedAt: null,
    rounds: [],
    totalScore: 0,
    hasCommented: false,
    startedAt: null,
    completedAt: null,
    percentile: null,
    playerCount: 0,
    streak: 0,
    unlockedFlairs: [],
  };
}

export async function loadSession(identity: Identity, date: string, isArchive: boolean): Promise<SessionState> {
  const key = redisKeys.session(identity.postId, identity.userId);
  const raw = await redis.get(key);
  if (raw) {
    try {
      const session = JSON.parse(raw) as SessionState;
      if (session.date === date) return session;
    } catch {
      // Replace invalid session state with a clean session.
    }
  }
  const session = newSession(identity.postId, identity.userId, date, isArchive);
  await saveSession(session);
  return session;
}

export async function saveSession(session: SessionState): Promise<void> {
  const key = redisKeys.session(session.postId, session.userId);
  await redis.set(key, JSON.stringify(session));
  await redis.expire(key, SESSION_TTL_SECONDS);
}

export function buildActiveRound(puzzle: DailyPuzzle, session: SessionState, now = Date.now()): ActiveRoundPayload | null {
  if (session.status === 'COMPLETED' || session.currentRound > ROUND_COUNT) return null;
  const content = getRoundContent(puzzle, session.currentRound);
  const startedAt = session.roundStartedAt;
  const elapsed = startedAt === null ? 0 : Math.max(0, now - startedAt);
  return {
    round: content.round,
    category: content.category,
    difficulty: content.difficulty,
    phrase: content.phrase,
    instruction: content.instruction,
    target: getTargetSpecimen(puzzle, content.round),
    options: getRoundFontOptions(puzzle, content.round),
    startedAt,
    remainingMs: startedAt === null ? 12_000 : Math.max(0, 12_000 - elapsed),
  };
}

export async function getProfile(userId: string): Promise<PlayerProfile> {
  return parseProfile(await redis.get(redisKeys.user(userId)));
}

export async function getPushState(userId: string): Promise<{ available: boolean; optedIn: boolean }> {
  const enabled = await settings.get('pushNotificationsEnabled');
  if (enabled !== true) return { available: false, optedIn: false };
  try {
    return { available: true, optedIn: await notifications.isOptedIn(userId) };
  } catch {
    return { available: false, optedIn: false };
  }
}

function visibleStreak(profile: PlayerProfile, date: string): number {
  return profile.lastCompletedDate === date || profile.lastCompletedDate === getYesterdayUtc(date)
    ? profile.streak
    : 0;
}

export async function buildInitPayload(
  identity: Identity,
  puzzle: DailyPuzzle,
  session: SessionState,
  profile: PlayerProfile,
  today: string,
): Promise<InitPayload> {
  const [playerCount, stats, push] = await Promise.all([
    redis.zCard(redisKeys.leaderboard(puzzle.date)),
    redis.hGetAll(redisKeys.stats(puzzle.date)),
    getPushState(identity.userId),
  ]);
  const answered = Number(stats.answered ?? 0);
  const correct = Number(stats.correct ?? 0);
  const averageAccuracy = answered > 0 ? Math.round((correct / answered) * 1000) / 10 : 0;

  const results = session.rounds.map((result) => {
    const font = getFont(result.targetFontId);
    const totalCrowd = Object.values(result.crowdDistribution).reduce((sum, count) => sum + count, 0);
    return {
      result,
      font,
      crowdAccuracy: totalCrowd > 0 ? Math.round(((result.crowdDistribution[result.targetFontId] ?? 0) / totalCrowd) * 100) : 0,
    };
  });

  return {
    authenticated: true,
    username: identity.username,
    date: puzzle.date,
    editionNumber: puzzle.editionNumber,
    subredditName: identity.subredditName,
    postId: identity.postId,
    status: session.status,
    currentRound: session.currentRound,
    totalScore: session.totalScore,
    streak: visibleStreak(profile, puzzle.date),
    maxStreak: profile.maxStreak,
    playedToday: Number(stats.playCount ?? 0),
    playerCount,
    averageAccuracy,
    percentile: session.percentile,
    hasCommented: session.hasCommented,
    isArchive: session.isArchive || puzzle.date !== today,
    push,
    activeRound: buildActiveRound(puzzle, session),
    results,
    unlockedFlairs: profile.unlockedFlairs,
  };
}

export async function startRound(session: SessionState, puzzle: DailyPuzzle): Promise<{ session: SessionState; round: ActiveRoundPayload | null }> {
  if (session.status === 'COMPLETED') return { session, round: null };
  if (session.currentRound > ROUND_COUNT) return { session, round: null };
  if (session.roundStartedAt === null) {
    if (!session.isArchive && session.status === 'UNSTARTED') {
      const firstPlay = await redis.hSetNX(redisKeys.startedUsers(session.date), session.userId, '1');
      if (firstPlay) {
        await redis.hIncrBy(redisKeys.stats(session.date), 'playCount', 1);
        await redis.expire(redisKeys.startedUsers(session.date), DAILY_STATS_RETENTION_SECONDS);
        await redis.expire(redisKeys.stats(session.date), DAILY_STATS_RETENTION_SECONDS);
      }
    }
    session.roundStartedAt = Date.now();
    session.startedAt ??= session.roundStartedAt;
    session.status = 'IN_PROGRESS';
    await saveSession(session);
  }
  return { session, round: buildActiveRound(puzzle, session) };
}

export async function crowdDistribution(date: string, round: number): Promise<Record<string, number>> {
  const counts = await redis.hGetAll(redisKeys.crowd(date, round));
  return Object.fromEntries(Object.entries(counts).map(([fontId, value]) => [fontId, Number(value) || 0]));
}

async function updateCompletionStats(session: SessionState): Promise<void> {
  const statsKey = redisKeys.stats(session.date);
  const firstCompletion = await redis.hSetNX(redisKeys.playedUsers(session.date), session.userId, '1');
  if (firstCompletion) await redis.hIncrBy(statsKey, 'completedCount', 1);
  await redis.expire(redisKeys.playedUsers(session.date), DAILY_STATS_RETENTION_SECONDS);
  await redis.expire(statsKey, DAILY_STATS_RETENTION_SECONDS);
}

async function updateProfileForCompletion(session: SessionState): Promise<PlayerProfile> {
  const current = await getProfile(session.userId);
  const byRound = new Map(session.rounds.map((item) => [item.round, item]));
  const cleanTechnicalRounds = Boolean(byRound.get(3)?.isCorrect && byRound.get(4)?.isCorrect);
  const next = completeProfileDay(current, session.date, session.totalScore, cleanTechnicalRounds);
  await redis.set(redisKeys.user(session.userId), JSON.stringify(next));
  return next;
}

export async function submitRound(
  session: SessionState,
  puzzle: DailyPuzzle,
  selectedFontId: string | null,
): Promise<{ session: SessionState; reveal: RevealPayload }> {
  if (session.status !== 'IN_PROGRESS' || session.roundStartedAt === null) {
    throw new Error('This round has not started.');
  }
  if (session.currentRound > ROUND_COUNT) throw new Error('The daily duel is already complete.');
  const content: DailyPuzzleRound = getRoundContent(puzzle, session.currentRound);
  if (selectedFontId !== null && !content.optionFontIds.includes(selectedFontId)) {
    throw new Error('That specimen is not one of the available choices.');
  }

  const elapsedMs = Math.max(0, Date.now() - session.roundStartedAt);
  const isCorrect = selectedFontId !== null && selectedFontId === content.targetFontId;
  const roundScore = scoreRound(isCorrect, elapsedMs);
  const result: RoundResult = {
    round: content.round,
    targetFontId: content.targetFontId,
    selectedFontId,
    isCorrect,
    elapsedMs,
    roundScore,
    crowdDistribution: {},
    diagnosticNote: content.diagnosticNote,
    triviaTitle: content.triviaTitle,
    triviaNote: content.triviaNote,
  };

  if (!session.isArchive && selectedFontId !== null) {
    await redis.hIncrBy(redisKeys.crowd(session.date, session.currentRound), selectedFontId, 1);
  }
  if (!session.isArchive) {
    await redis.hIncrBy(redisKeys.stats(session.date), 'answered', 1);
    if (isCorrect) await redis.hIncrBy(redisKeys.stats(session.date), 'correct', 1);
    await redis.expire(redisKeys.stats(session.date), DAILY_STATS_RETENTION_SECONDS);
  }

  // Archive play is read-only: use the historical crowd split without mutating it.
  const distribution = await crowdDistribution(session.date, session.currentRound);
  result.crowdDistribution = distribution;
  session.rounds.push(result);
  session.totalScore += roundScore;
  session.currentRound += 1;
  session.roundStartedAt = null;

  let profile = await getProfile(session.userId);
  if (session.currentRound > ROUND_COUNT) {
    session.status = 'COMPLETED';
    session.completedAt = Date.now();
    if (!session.isArchive) {
      await redis.zAdd(redisKeys.leaderboard(session.date), { member: session.userId, score: session.totalScore });
      await redis.expire(redisKeys.leaderboard(session.date), DAILY_STATS_RETENTION_SECONDS);
      const rank = await redis.zRank(redisKeys.leaderboard(session.date), session.userId);
      const playerCount = await redis.zCard(redisKeys.leaderboard(session.date));
      session.playerCount = playerCount;
      session.percentile = rank === undefined || playerCount === 0
        ? null
        : percentileFromRank(rank, playerCount);
      await updateCompletionStats(session);
      profile = await updateProfileForCompletion(session);
    }
  }
  session.streak = visibleStreak(profile, session.date);
  session.unlockedFlairs = profile.unlockedFlairs;
  await saveSession(session);

  const rank = session.isArchive ? null : await redis.zRank(redisKeys.leaderboard(session.date), session.userId);
  const playerCount = session.isArchive ? 0 : await redis.zCard(redisKeys.leaderboard(session.date));
  if (session.status === 'COMPLETED' && !session.isArchive && rank !== undefined && playerCount > 0) {
    session.percentile = percentileFromRank(rank, playerCount);
    session.playerCount = playerCount;
    await saveSession(session);
  }

  const totalCount = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const crowdPercentages = Object.fromEntries(
    content.optionFontIds.map((fontId) => [fontId, totalCount > 0 ? Math.round(((distribution[fontId] ?? 0) / totalCount) * 100) : 0]),
  );

  const reveal: RevealPayload = {
    result,
    correctFont: getFont(content.targetFontId),
    options: getRoundFontOptions(puzzle, content.round),
    crowdPercentages,
    isComplete: session.status === 'COMPLETED',
    totalScore: session.totalScore,
    percentile: session.percentile,
    playerCount: session.playerCount,
    streak: visibleStreak(profile, puzzle.date),
    unlockedFlairs: profile.unlockedFlairs,
  };
  return { session, reveal };
}

export function buildShareComment(session: SessionState, editionNumber: number): string {
  const pct = Math.round((session.totalScore / 5_000) * 1_000) / 10;
  const rows = session.rounds.map((round) => round.isCorrect ? `✒️ ${round.roundScore}` : '✕ 0');
  return [
    `fontWars Vol. ${String(editionNumber).padStart(3, '0')} — ${session.totalScore.toLocaleString('en-US')}/5,000 (${pct}%)`,
    rows.join(' | '),
    `Streak: ${session.streak} 🔥`,
  ].join('\n');
}

