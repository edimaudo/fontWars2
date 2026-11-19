import { Hono } from 'hono';
import { redis } from '@devvit/redis';
import { context, notifications, reddit, settings } from '@devvit/web/server';
import { createTelemetryRouter } from '@devvit/analytics/server/reddit';
import { generateDailyPuzzle } from './services/dailyPuzzle';
import {
  buildInitPayload,
  buildShareComment,
  currentIdentity,
  getPuzzle,
  getProfile,
  loadSession,
  resolvePostDate,
  saveSession,
  startRound,
  submitRound,
  utcDateNow,
} from './services/session';
import { IDENTITY_TTL_SECONDS, redisKeys } from './config';
import { acquireRedisLease } from './redisLease';
import { MAX_ACCEPTED_ELAPSED_MS } from '../shared/scoring';
import { createDailyPost, ensureDailyShareThread, sendDailyPushBatch } from './scheduler/dailyDrop';
import type { ApiError, InitPayload, RevealPayload, SessionState } from '../shared/types';

const app = new Hono();
app.use(createTelemetryRouter());

function jsonError(message: string, status: 400 | 401 | 403 | 404 | 409 | 500, code?: string) {
  return { error: message, ...(code ? { code } : {}) } satisfies ApiError;
}

async function getSessionContext() {
  const identity = await currentIdentity();
  if (!identity) return null;
  const today = utcDateNow();
  const resolved = await resolvePostDate(identity.postId, today);
  const puzzle = await getPuzzle(resolved.date, generateDailyPuzzle);
  const session = await loadSession(identity, resolved.date, resolved.isArchive);
  const profile = await getProfile(identity.userId);
  return { identity, today, date: resolved.date, puzzle, session, profile };
}

async function recoverTimedOutRound(session: SessionState, puzzle: Awaited<ReturnType<typeof getPuzzle>>) {
  if (session.status !== 'IN_PROGRESS' || session.roundStartedAt === null || session.currentRound > 5) return session;
  const elapsed = Date.now() - session.roundStartedAt;
  if (elapsed <= MAX_ACCEPTED_ELAPSED_MS) return session;
  const submissionKey = redisKeys.submissions(session.postId, session.userId);
  const field = `${session.date}:${session.currentRound}`;
  const cached = await redis.hGet(submissionKey, field);
  if (cached) {
    try {
      return (JSON.parse(cached) as { session: SessionState }).session;
    } catch {
      throw new Error('The saved timeout result is invalid. Refresh the game.');
    }
  }
  const result = await submitRound(session, puzzle, null);
  return result.session;
}

async function purgePostData(postId: string): Promise<void> {
  const postIndex = redisKeys.postSessionIndex(postId);
  const sessions = await redis.zRange(postIndex, 0, -1);
  for (const entry of sessions) {
    const userId = entry.member;
    const sessionLease = await acquireRedisLease(redisKeys.sessionLock(postId, userId), 30);
    const shareLease = await acquireRedisLease(redisKeys.shareLock(postId, userId), 45);
    if (!sessionLease || !shareLease) {
      if (sessionLease) await sessionLease.release();
      if (shareLease) await shareLease.release();
      throw new Error('A player action is still being saved; retry post cleanup.');
    }
    try {
      const sessionRaw = await redis.get(redisKeys.session(postId, userId));
      let date = '';
      if (sessionRaw) {
        try { date = (JSON.parse(sessionRaw) as SessionState).date; } catch { /* use the reverse index below */ }
      }
      if (!date) date = await redis.hGet(redisKeys.userSessionIndex(userId), postId) ?? '';
      await redis.del(redisKeys.session(postId, userId));
      await redis.del(redisKeys.submissions(postId, userId));
      await redis.del(redisKeys.roundContributions(postId, userId));
      const shareRecord = await redis.get(redisKeys.shareResult(postId, userId));
      if (shareRecord && shareRecord !== 'pending') await redis.del(redisKeys.shareCommentIndex(shareRecord));
      await redis.del(redisKeys.shareResult(postId, userId));
      await redis.hDel(redisKeys.userSessionIndex(userId), [postId]);
      if (date) {
        await redis.hDel(redisKeys.startedUsers(date), [userId]);
        await redis.hDel(redisKeys.playedUsers(date), [userId]);
        await redis.zRem(redisKeys.leaderboard(date), [userId]);
      }
    } finally {
      await shareLease.release();
      await sessionLease.release();
    }
  }
  const anchorId = await redis.get(redisKeys.shareThread(postId));
  if (anchorId && anchorId !== 'pending') await redis.del(redisKeys.shareAnchorIndex(anchorId));
  const date = await redis.get(redisKeys.postDate(postId));
  if (date && await redis.get(redisKeys.dailyPost(date)) === postId) await redis.del(redisKeys.dailyPost(date));
  await redis.del(postIndex);
  await redis.del(redisKeys.postDate(postId));
  await redis.del(redisKeys.shareThread(postId));
  // Do not delete active lease keys; their token owners must release them.
}

app.get('/api/health', (c) => c.json({ ok: true, app: 'fontWars' }));

app.get('/api/init', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to play fontWars.', 401, 'AUTH_REQUIRED'), 401);

  try {
    const lease = await acquireRedisLease(redisKeys.sessionLock(ctx.identity.postId, ctx.identity.userId), 45);
    if (lease) {
      try {
        ctx.session = await loadSession(ctx.identity, ctx.date, ctx.session.isArchive);
        ctx.session = await recoverTimedOutRound(ctx.session, ctx.puzzle);
      } finally {
        await lease.release();
      }
    }
    const freshProfile = await getProfile(ctx.identity.userId);
    const payload = await buildInitPayload(ctx.identity, ctx.puzzle, ctx.session, freshProfile, ctx.today);
    return c.json<InitPayload>(payload);
  } catch (error) {
    console.error('fontWars init failed', error);
    return c.json(jsonError('The foundry is having trouble loading. Refresh to try again.', 500), 500);
  }
});

app.post('/api/round/start', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to play fontWars.', 401, 'AUTH_REQUIRED'), 401);
  const lease = await acquireRedisLease(redisKeys.sessionLock(ctx.identity.postId, ctx.identity.userId), 45);
  if (!lease) return c.json(jsonError('Your round is being updated. Retry in a moment.', 409, 'ROUND_PENDING'), 409);
  try {
    ctx.session = await loadSession(ctx.identity, ctx.date, ctx.session.isArchive);
    ctx.session = await recoverTimedOutRound(ctx.session, ctx.puzzle);
    if (ctx.session.currentRound > 5 || ctx.session.status === 'COMPLETED') {
      return c.json({ status: 'COMPLETED', activeRound: null, totalScore: ctx.session.totalScore });
    }
    const started = await startRound(ctx.session, ctx.puzzle);
    return c.json({ status: started.session.status, activeRound: started.round });
  } catch (error) {
    console.error('fontWars round start failed', error);
    return c.json(jsonError('Could not start this specimen. Refresh to try again.', 500), 500);
  } finally {
    await lease.release();
  }
});

app.post('/api/round/submit', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to play fontWars.', 401, 'AUTH_REQUIRED'), 401);
  let body: { selectedFontId?: unknown; round?: unknown };
  try {
    body = await c.req.json<{ selectedFontId?: unknown; round?: unknown }>();
  } catch {
    return c.json(jsonError('Invalid answer payload.', 400), 400);
  }
  const selectedFontId = body.selectedFontId === null
    ? null
    : typeof body.selectedFontId === 'string' ? body.selectedFontId : undefined;
  if (selectedFontId === undefined) return c.json(jsonError('Choose one of the four specimen cards.', 400), 400);
  const requestedRound = body.round === undefined ? ctx.session.currentRound : Number(body.round);
  if (!Number.isInteger(requestedRound) || requestedRound < 1 || requestedRound > 5) {
    return c.json(jsonError('The submitted round number is invalid.', 400), 400);
  }

  const field = `${ctx.date}:${requestedRound}`;
  const submissionKey = redisKeys.submissions(ctx.identity.postId, ctx.identity.userId);
  const readSavedReveal = async (): Promise<RevealPayload | null> => {
    const saved = await redis.hGet(submissionKey, field);
    if (!saved) return null;
    if (saved === 'processing') {
      await redis.hDel(submissionKey, [field]);
      return null;
    }
    try { return (JSON.parse(saved) as { reveal: RevealPayload }).reveal; }
    catch { throw new Error('This round was already recorded, but its saved reveal is invalid. Refresh the game.'); }
  };

  try {
    const priorReveal = await readSavedReveal();
    if (priorReveal) return c.json<RevealPayload>(priorReveal);
  } catch (error) {
    return c.json(jsonError(error instanceof Error ? error.message : 'Could not read the saved result.', 409, 'DUPLICATE_SUBMISSION'), 409);
  }

  const lease = await acquireRedisLease(redisKeys.sessionLock(ctx.identity.postId, ctx.identity.userId), 45);
  if (!lease) return c.json(jsonError('Your answer is being recorded. Retry in a moment.', 409, 'SUBMISSION_PENDING'), 409);
  try {
    ctx.session = await loadSession(ctx.identity, ctx.date, ctx.session.isArchive);
    const savedReveal = await readSavedReveal();
    if (savedReveal) return c.json<RevealPayload>(savedReveal);
    if (requestedRound !== ctx.session.currentRound) {
      return c.json(jsonError('That specimen has already changed. Refresh to load the current round.', 409, 'ROUND_CHANGED'), 409);
    }
    if (ctx.session.roundStartedAt === null) throw new Error('This specimen is not active yet.');
    const elapsed = Date.now() - ctx.session.roundStartedAt;
    if (elapsed > MAX_ACCEPTED_ELAPSED_MS && selectedFontId !== null) {
      throw new Error('Time expired. The specimen has been recorded as a miss.');
    }
    const { reveal } = await submitRound(ctx.session, ctx.puzzle, selectedFontId);
    return c.json<RevealPayload>(reveal);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not record that answer.';
    const status = /already|changed|recorded|being recorded/i.test(message) ? 409 : 400;
    return c.json(jsonError(message, status), status);
  } finally {
    await lease.release();
  }
});

app.post('/api/share', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to post your result.', 401), 401);
  const lease = await acquireRedisLease(redisKeys.shareLock(ctx.identity.postId, ctx.identity.userId), 45);
  if (!lease) return c.json(jsonError('Your result share is being processed. Check the pinned thread before trying again.', 409, 'SHARE_PENDING'), 409);
  const shareKey = redisKeys.shareResult(ctx.identity.postId, ctx.identity.userId);
  try {
    ctx.session = await loadSession(ctx.identity, ctx.date, ctx.session.isArchive);
    if (ctx.session.status !== 'COMPLETED') return c.json(jsonError('Finish all five specimens before sharing.', 400), 400);

    const prior = await redis.get(shareKey);
    if (prior === 'pending') {
      return c.json(jsonError('Reddit has not confirmed the previous share attempt. Check the pinned daily thread before retrying to avoid a duplicate comment.', 409, 'SHARE_UNCONFIRMED'), 409);
    }
    if (prior && prior !== 'pending') {
      ctx.session.hasCommented = true;
      await saveSession(ctx.session);
      return c.json({ posted: true, alreadyPosted: true });
    }
    if (ctx.session.hasCommented) return c.json({ posted: true, alreadyPosted: true });

    // Persist intent before the external Reddit action. If the process crashes after
    // Reddit accepts the comment, the retry will not blindly publish a duplicate.
    await redis.set(shareKey, 'pending');
    await redis.expire(shareKey, IDENTITY_TTL_SECONDS);
    const text = buildShareComment(ctx.session, ctx.puzzle.editionNumber);
    const shareThreadId = await ensureDailyShareThread(ctx.identity.postId);
    const comment = await reddit.submitComment({ id: shareThreadId, text, runAs: 'USER' });
    await redis.set(shareKey, comment.id);
    await redis.expire(shareKey, IDENTITY_TTL_SECONDS);
    await redis.set(redisKeys.shareCommentIndex(comment.id), `${ctx.identity.postId}|${ctx.identity.userId}`);
    await redis.expire(redisKeys.shareCommentIndex(comment.id), IDENTITY_TTL_SECONDS);
    ctx.session.hasCommented = true;
    await saveSession(ctx.session);
    return c.json({ posted: true });
  } catch (error) {
    console.error('fontWars comment share failed', error);
    return c.json(jsonError('Reddit could not confirm the comment. Check the pinned daily thread before trying again.', 500, 'COMMENT_STATUS_UNKNOWN'), 500);
  } finally {
    await lease.release();
  }
});

app.post('/api/flair', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to equip a flair.', 401), 401);
  let body: { flair?: unknown };
  try {
    body = await c.req.json<{ flair?: unknown }>();
  } catch {
    return c.json(jsonError('Invalid flair request.', 400), 400);
  }
  if (typeof body.flair !== 'string') return c.json(jsonError('Select an unlocked flair.', 400), 400);
  const profile = await getProfile(ctx.identity.userId);
  if (!profile.unlockedFlairs.includes(body.flair)) return c.json(jsonError('That flair has not been unlocked.', 403), 403);
  try {
    await reddit.setUserFlair({
      subredditName: ctx.identity.subredditName,
      username: ctx.identity.username,
      text: body.flair,
    });
    return c.json({ equipped: true, flair: body.flair });
  } catch (error) {
    console.error('fontWars flair update failed', error);
    return c.json(jsonError('Flair could not be equipped. The app needs moderator flair permissions in this subreddit.', 403, 'FLAIR_PERMISSION_REQUIRED'), 403);
  }
});

app.post('/api/notifications', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to manage reminders.', 401), 401);
  const enabled = await settings.get('pushNotificationsEnabled');
  if (enabled !== true) {
    return c.json({ available: false, optedIn: false, message: 'Daily push reminders are not enabled for this subreddit yet.' }, 200);
  }
  let body: { enabled?: unknown };
  try {
    body = await c.req.json<{ enabled?: unknown }>();
  } catch {
    return c.json(jsonError('Invalid reminder setting.', 400), 400);
  }
  if (typeof body.enabled !== 'boolean') return c.json(jsonError('Choose whether reminders are enabled.', 400), 400);
  try {
    if (body.enabled) await notifications.optInCurrentUser();
    else await notifications.optOutCurrentUser();
    const optedIn = await notifications.isOptedIn(ctx.identity.userId);
    return c.json({ available: true, optedIn });
  } catch (error) {
    console.error('fontWars notification opt-in failed', error);
    return c.json({ available: false, optedIn: false, message: 'Reddit notifications are not available for this app installation.' }, 200);
  }
});

app.post('/api/privacy/delete-me', async (c) => {
  const identity = await currentIdentity();
  if (!identity) return c.json(jsonError('Sign in to delete your fontWars data.', 401, 'AUTH_REQUIRED'), 401);
  const leases: Array<{ release: () => Promise<void> }> = [];
  const releaseHeldLeases = async () => {
    for (const lease of leases.splice(0).reverse()) await lease.release();
  };
  try {
    const indexedSessions = (await redis.hGetAll(redisKeys.userSessionIndex(identity.userId))) ?? {};
    if (!indexedSessions[identity.postId]) {
      const currentPostDate = (await resolvePostDate(identity.postId, utcDateNow())).date;
      indexedSessions[identity.postId] = currentPostDate;
    }
    for (const postId of Object.keys(indexedSessions)) {
      const sessionLease = await acquireRedisLease(redisKeys.sessionLock(postId, identity.userId), 30);
      const shareLease = await acquireRedisLease(redisKeys.shareLock(postId, identity.userId), 45);
      if (!sessionLease || !shareLease) {
        if (sessionLease) await sessionLease.release();
        if (shareLease) await shareLease.release();
        await releaseHeldLeases();
        return c.json(jsonError('A game action is still being saved. Retry data deletion in a moment.', 409, 'DATA_DELETE_PENDING'), 409);
      }
      leases.push(sessionLease, shareLease);
    }

    for (const [postId, date] of Object.entries(indexedSessions)) {
      await redis.del(redisKeys.session(postId, identity.userId));
      await redis.del(redisKeys.submissions(postId, identity.userId));
      await redis.del(redisKeys.roundContributions(postId, identity.userId));
      const shareRecord = await redis.get(redisKeys.shareResult(postId, identity.userId));
      if (shareRecord && shareRecord !== 'pending') await redis.del(redisKeys.shareCommentIndex(shareRecord));
      await redis.del(redisKeys.shareResult(postId, identity.userId));
      await redis.zRem(redisKeys.postSessionIndex(postId), [identity.userId]);
      await redis.hDel(redisKeys.startedUsers(date), [identity.userId]);
      await redis.hDel(redisKeys.playedUsers(date), [identity.userId]);
      await redis.zRem(redisKeys.leaderboard(date), [identity.userId]);
    }
    await redis.del(redisKeys.userSessionIndex(identity.userId));
    await redis.del(redisKeys.user(identity.userId));
    try { await notifications.optOutCurrentUser(); } catch { /* Data deletion must still complete. */ }
    return c.json({ deleted: true, note: 'fontWars profile and linked game records were deleted. Anonymous community totals may remain. Reddit comments you previously posted remain under Reddit’s controls.' });
  } catch (error) {
    console.error('fontWars player data deletion failed', error);
    return c.json(jsonError('Your data could not be fully deleted. Retry this action or contact the app developer.', 500, 'DATA_DELETE_FAILED'), 500);
  } finally {
    await releaseHeldLeases();
  }
});

app.post('/api/journey-event', async (c) => {
  const identity = await currentIdentity();
  if (!identity) return c.json(jsonError('Sign in to record game analytics.', 401), 401);

  let body: { event?: unknown; round?: unknown; score?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json(jsonError('Invalid analytics event.', 400), 400);
  }

  const event = body.event;
  if (event !== 'App.Ready' && event !== 'Journey.Start' && event !== 'Journey.Progress' && event !== 'Journey.End') {
    return c.json(jsonError('Unsupported analytics event.', 400), 400);
  }
  const round = Number(body.round);
  const score = Number(body.score);
  if (event === 'Journey.Progress' && (!Number.isInteger(round) || round < 1 || round > 5)) {
    return c.json(jsonError('Progress events require a round from 1 to 5.', 400), 400);
  }
  if (event === 'Journey.End' && (!Number.isFinite(score) || score < 0 || score > 5_000)) {
    return c.json(jsonError('Completion events require a valid score.', 400), 400);
  }

  try {
    const date = (await resolvePostDate(identity.postId, utcDateNow())).date;
    const member = `${identity.userId}:${event}:${event === 'Journey.Progress' ? round : 0}`;
    const timestamp = Date.now();
    await redis.zAdd(redisKeys.journeyEvents(date), { member, score: timestamp });
    await redis.expire(redisKeys.journeyEvents(date), 60 * 60 * 24 * 45);
    return c.json({ receipt: { stored: true, event, member, timestamp } });
  } catch (error) {
    console.warn('fontWars Redis analytics mirror could not record an event.', error);
    return c.json(jsonError('Analytics receipt could not be verified.', 500, 'ANALYTICS_RECEIPT_FAILED'), 500);
  }
});

app.get('/api/leaderboard', async (c) => {
  const date = utcDateNow();
  const entries = await redis.zRange(redisKeys.leaderboard(date), 0, 9, { by: 'rank', reverse: true });
  const names = await Promise.all(entries.map(async (item) => {
    try {
      const user = await reddit.getUserById(item.member);
      return { username: user?.username ?? 'Redditor', score: item.score };
    } catch {
      return { username: 'Redditor', score: item.score };
    }
  }));
  return c.json({ date, entries: names });
});

app.post('/internal/triggers/post-delete', async (c) => {
  let input: { postId?: string };
  try { input = await c.req.json(); } catch { return c.json({ status: 'ignored' }); }
  const postId = input.postId;
  if (!postId) return c.json({ status: 'ignored' });
  try {
    await purgePostData(postId);
    return c.json({ status: 'ok' });
  } catch (error) {
    console.error('fontWars post-delete cleanup failed', error);
    return c.json({ status: 'error' }, 500);
  }
});

app.post('/internal/triggers/comment-delete', async (c) => {
  let input: { commentId?: string; postId?: string; parentId?: string };
  try { input = await c.req.json(); } catch { return c.json({ status: 'ignored' }); }
  const commentId = input.commentId;
  if (!commentId) return c.json({ status: 'ignored' });
  try {
    const indexedPostId = await redis.get(redisKeys.shareAnchorIndex(commentId));
    const threadPostId = indexedPostId ?? input.postId ?? input.parentId;
    if (threadPostId && await redis.get(redisKeys.shareThread(threadPostId)) === commentId) {
      await redis.del(redisKeys.shareThread(threadPostId));
    }
    await redis.del(redisKeys.shareAnchorIndex(commentId));
    const owner = await redis.get(redisKeys.shareCommentIndex(commentId));
    if (owner) {
      const [postId, userId] = owner.split('|');
      if (postId && userId) {
        const sessionLease = await acquireRedisLease(redisKeys.sessionLock(postId, userId), 30);
        const shareLease = await acquireRedisLease(redisKeys.shareLock(postId, userId), 45);
        if (!sessionLease || !shareLease) {
          if (sessionLease) await sessionLease.release();
          if (shareLease) await shareLease.release();
          return c.json({ status: 'retry' }, 409);
        }
        try {
          await redis.del(redisKeys.shareResult(postId, userId));
          const raw = await redis.get(redisKeys.session(postId, userId));
          if (raw) {
            const session = JSON.parse(raw) as SessionState;
            session.hasCommented = false;
            await saveSession(session);
          }
          await redis.del(redisKeys.shareCommentIndex(commentId));
        } finally {
          await shareLease.release();
          await sessionLease.release();
        }
      }
    }
    await redis.del(redisKeys.shareCommentIndex(commentId));
    return c.json({ status: 'ok' });
  } catch (error) {
    console.error('fontWars comment-delete cleanup failed', error);
    return c.json({ status: 'error' }, 500);
  }
});

app.post('/internal/scheduler/daily-drop', async (c) => {
  try {
    const result = await createDailyPost();
    return c.json({ status: 'ok', ...result });
  } catch (error) {
    console.error('fontWars daily drop failed', error);
    return c.json({ status: 'error', message: 'Daily specimen drop failed.' }, 500);
  }
});

app.post('/internal/scheduler/daily-push-batch', async (c) => {
  let input: { data?: { date?: string; postId?: string; cursor?: string } };
  try {
    input = await c.req.json();
  } catch {
    return c.json({ status: 'ignored', message: 'Missing campaign payload.' });
  }
  const data = input.data;
  if (!data?.date || !data.postId) return c.json({ status: 'ignored' });
  try {
    const result = await sendDailyPushBatch({ date: data.date, postId: data.postId, cursor: data.cursor ?? '' });
    return c.json({ status: 'ok', ...result });
  } catch (error) {
    console.error('fontWars notification campaign failed', error);
    return c.json({ status: 'error', message: 'Notification batch failed.' }, 500);
  }
});

app.post('/internal/menu/create-daily-post', async (c) => {
  try {
    const result = await createDailyPost(true);
    return c.json({ showToast: result.created ? `Created ${result.postId}` : 'Today’s fontWars post already exists.' });
  } catch (error) {
    console.error('fontWars manual post creation failed', error);
    return c.json({ showToast: 'Could not create today’s fontWars post.' }, 500);
  }
});

export default app;
