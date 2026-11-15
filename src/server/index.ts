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
import { redisKeys } from './config';
import { MAX_ACCEPTED_ELAPSED_MS } from '../shared/scoring';
import { createDailyPost, sendDailyPushBatch } from './scheduler/dailyDrop';
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
  const key = redisKeys.submissions(session.postId, session.userId);
  const field = `${session.date}:${session.currentRound}`;
  const acquired = await redis.hSetNX(key, field, 'processing');
  if (!acquired) return session;
  try {
    const { session: updated, reveal } = await submitRound(session, puzzle, null);
    await redis.hSet(key, { [field]: JSON.stringify({ reveal, session: updated }) });
    return updated;
  } catch (error) {
    await redis.hDel(key, [field]);
    throw error;
  }
}

app.get('/api/health', (c) => c.json({ ok: true, app: 'fontWars' }));

app.get('/api/init', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to play fontWars.', 401, 'AUTH_REQUIRED'), 401);

  try {
    ctx.session = await recoverTimedOutRound(ctx.session, ctx.puzzle);
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
  try {
    ctx.session = await recoverTimedOutRound(ctx.session, ctx.puzzle);
    if (ctx.session.currentRound > 5 || ctx.session.status === 'COMPLETED') {
      return c.json({ status: 'COMPLETED', activeRound: null, totalScore: ctx.session.totalScore });
    }
    const started = await startRound(ctx.session, ctx.puzzle);
    return c.json({ status: started.session.status, activeRound: started.round });
  } catch (error) {
    console.error('fontWars round start failed', error);
    return c.json(jsonError('Could not start this specimen. Refresh to try again.', 500), 500);
  }
});

app.post('/api/round/submit', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to play fontWars.', 401, 'AUTH_REQUIRED'), 401);
  let body: { selectedFontId?: unknown };
  try {
    body = await c.req.json<{ selectedFontId?: unknown }>();
  } catch {
    return c.json(jsonError('Invalid answer payload.', 400), 400);
  }
  const selectedFontId = body.selectedFontId === null
    ? null
    : typeof body.selectedFontId === 'string' ? body.selectedFontId : undefined;
  if (selectedFontId === undefined) return c.json(jsonError('Choose one of the four specimen cards.', 400), 400);

  const round = ctx.session.currentRound;
  const field = `${ctx.date}:${round}`;
  const submissionKey = redisKeys.submissions(ctx.identity.postId, ctx.identity.userId);
  const cached = await redis.hGet(submissionKey, field);
  if (cached && cached !== 'processing') {
    try {
      const parsed = JSON.parse(cached) as { reveal: RevealPayload };
      return c.json(parsed.reveal);
    } catch {
      return c.json(jsonError('This answer was already recorded. Refresh the game.', 409, 'DUPLICATE_SUBMISSION'), 409);
    }
  }
  if (cached === 'processing') return c.json(jsonError('Your answer is being recorded. Refresh in a moment.', 409, 'SUBMISSION_PENDING'), 409);

  const acquired = await redis.hSetNX(submissionKey, field, 'processing');
  if (!acquired) return c.json(jsonError('Your answer is being recorded. Refresh in a moment.', 409, 'SUBMISSION_PENDING'), 409);

  try {
    if (ctx.session.roundStartedAt === null) throw new Error('This specimen is not active yet.');
    const elapsed = Date.now() - ctx.session.roundStartedAt;
    if (elapsed > MAX_ACCEPTED_ELAPSED_MS && selectedFontId !== null) {
      throw new Error('Time expired. The specimen has been recorded as a miss.');
    }
    const { session, reveal } = await submitRound(ctx.session, ctx.puzzle, selectedFontId);
    await redis.hSet(submissionKey, { [field]: JSON.stringify({ reveal, session }) });
    return c.json<RevealPayload>(reveal);
  } catch (error) {
    await redis.hDel(submissionKey, [field]);
    const message = error instanceof Error ? error.message : 'Could not record that answer.';
    const status = message.includes('already') ? 409 : 400;
    return c.json(jsonError(message, status), status);
  }
});

app.post('/api/share', async (c) => {
  const ctx = await getSessionContext();
  if (!ctx) return c.json(jsonError('Sign in to post your result.', 401), 401);
  if (ctx.session.status !== 'COMPLETED') return c.json(jsonError('Finish all five specimens before sharing.', 400), 400);
  if (ctx.session.hasCommented) return c.json({ posted: true, alreadyPosted: true });
  try {
    const text = buildShareComment(ctx.session, ctx.puzzle.editionNumber);
    await reddit.submitComment({ id: ctx.identity.postId, text, runAs: 'USER' });
    ctx.session.hasCommented = true;
    await saveSession(ctx.session);
    return c.json({ posted: true });
  } catch (error) {
    console.error('fontWars comment share failed', error);
    return c.json(jsonError('Reddit could not post this comment. You can still copy your result.', 500, 'COMMENT_FAILED'), 500);
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
  if (event !== 'App.Ready' && event !== 'Journey.Start' && event !== 'Journey.Progress' && event !== 'Journey.Complete') {
    return c.json(jsonError('Unsupported analytics event.', 400), 400);
  }
  const round = Number(body.round);
  const score = Number(body.score);
  if (event === 'Journey.Progress' && (!Number.isInteger(round) || round < 1 || round > 5)) {
    return c.json(jsonError('Progress events require a round from 1 to 5.', 400), 400);
  }
  if (event === 'Journey.Complete' && (!Number.isFinite(score) || score < 0 || score > 5_000)) {
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
