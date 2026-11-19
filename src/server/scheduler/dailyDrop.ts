import { createHash } from 'node:crypto';
import { redis } from '@devvit/redis';
import { context, notifications, reddit, scheduler, settings } from '@devvit/web/server';
import { formatUtcDate } from '../../shared/format';
import { generateDailyPuzzle } from '../services/dailyPuzzle';
import { getPuzzle } from '../services/session';
import { acquireRedisLease } from '../redisLease';
import { redisKeys } from '../config';

const SHARE_THREAD_COPY = [
  'fontWars daily score thread',
  '',
  'Post your completed five-specimen result as a reply to this comment. Sharing is optional and happens only when you choose to post your score.',
].join('\n');

export async function ensureDailyShareThread(postId: string): Promise<string> {
  const threadKey = redisKeys.shareThread(postId);
  const cachedId = await redis.get(threadKey);
  if (cachedId) {
    try {
      const comment = await reddit.getCommentById(cachedId);
      await comment.distinguish(true);
      await redis.set(redisKeys.shareAnchorIndex(cachedId), postId);
      await redis.expire(redisKeys.shareAnchorIndex(cachedId), 60 * 60 * 24 * 45);
      return cachedId;
    } catch (error) {
      // Do not create another anchor on an ambiguous fetch/permission error.
      // A real Reddit comment-delete trigger clears this mapping when deleted.
      console.warn('fontWars cached score thread could not be verified.', error);
      throw new Error('The pinned score thread could not be verified.');
    }
  }

  const lease = await acquireRedisLease(redisKeys.shareThreadLock(postId), 30);
  if (!lease) {
    const concurrentId = await redis.get(threadKey);
    if (concurrentId) return concurrentId;
    throw new Error('The daily score thread is being prepared. Try again shortly.');
  }

  try {
    const currentId = await redis.get(threadKey);
    if (currentId) {
      try {
        const existing = await reddit.getCommentById(currentId);
        await existing.distinguish(true);
        await redis.set(redisKeys.shareAnchorIndex(currentId), postId);
        await redis.expire(redisKeys.shareAnchorIndex(currentId), 60 * 60 * 24 * 45);
        return currentId;
      } catch {
        throw new Error('The existing score thread could not be verified.');
      }
    }

    await redis.set(threadKey, 'pending');
    await redis.expire(threadKey, 60 * 60 * 24 * 45);
    const comment = await reddit.submitComment({ id: postId, text: SHARE_THREAD_COPY, runAs: 'APP' });
    await redis.set(threadKey, comment.id);
    await redis.expire(threadKey, 60 * 60 * 24 * 45);
    await comment.distinguish(true);
    await redis.set(redisKeys.shareAnchorIndex(comment.id), postId);
    await redis.expire(redisKeys.shareAnchorIndex(comment.id), 60 * 60 * 24 * 45);
    return comment.id;
  } finally {
    await lease.release();
  }
}

export async function createDailyPost(force = false): Promise<{ date: string; postId: string; created: boolean }> {
  const date = new Date().toISOString().slice(0, 10);
  const subredditName = (context as unknown as { subredditName?: string }).subredditName;
  if (!subredditName) throw new Error('This action must run inside a subreddit installation.');

  const postKey = redisKeys.dailyPost(date);
  const existing = await redis.get(postKey);
  if (existing) {
    try {
      await ensureDailyShareThread(existing);
    } catch (error) {
      console.warn('fontWars could not verify the pinned score thread.', error);
    }
    return { date, postId: existing, created: false };
  }

  // A token-owned lease prevents cron/manual creation races and expires after crashes.
  const lease = await acquireRedisLease(redisKeys.dailyPostLock(date), 60);
  if (!lease) {
    const concurrentPost = await redis.get(postKey);
    return { date, postId: concurrentPost ?? '', created: false };
  }

  try {
    const createdPost = await redis.get(postKey);
    if (createdPost) return { date, postId: createdPost, created: false };

    const puzzle = await getPuzzle(date, generateDailyPuzzle);

    const autoCreate = await settings.get('autoCreateDailyPost');
    if (autoCreate === false && !force) return { date, postId: '', created: false };

    const post = await reddit.submitCustomPost({
      subredditName,
      title: `fontWars Vol. ${String(puzzle.editionNumber).padStart(3, '0')} — ${formatUtcDate(date)}`,
      entry: 'default',
    });
    const postId = post.id;
    await redis.set(postKey, postId);
    await redis.expire(postKey, 60 * 60 * 24 * 45);
    await redis.set(redisKeys.postDate(postId), date);
    await redis.expire(redisKeys.postDate(postId), 60 * 60 * 24 * 45);
    try {
      await ensureDailyShareThread(postId);
    } catch (error) {
      // Post creation should not fail because pinning permissions need moderator setup.
      // The result-sharing route retries this operation when a player explicitly shares.
      console.warn('fontWars daily post was created, but its score thread could not be pinned.', error);
    }

    const pushEnabled = await settings.get('pushNotificationsEnabled');
    if (pushEnabled === true) {
      try {
        await scheduler.runJob({
          id: `fontwars-push-${date}-first`,
          name: 'daily-push-batch',
          data: { date, postId, cursor: '' },
          runAt: new Date(Date.now() + 5_000),
        });
      } catch (error) {
        console.warn('fontWars could not schedule the notification campaign.', error);
      }
    }

    return { date, postId, created: true };
  } finally {
    await lease.release();
  }
}

export async function sendDailyPushBatch(input: {
  date: string;
  postId: string;
  cursor?: string;
}): Promise<{ done: boolean; cursor: string; sent: number }> {
  const optedIn = await notifications.listOptedInUsers({
    after: input.cursor?.trim() && input.cursor !== '0' ? input.cursor : undefined,
    limit: 200,
  });

  const recipients = await Promise.all(optedIn.userIds.map(async (userId) => {
    const raw = await redis.get(redisKeys.user(userId));
    let streak = 0;
    if (raw) {
      try {
        const profile = JSON.parse(raw) as { streak?: number; lastCompletedDate?: string | null };
        streak = Number(profile.streak) || 0;
        if (profile.lastCompletedDate !== input.date && profile.lastCompletedDate !== yesterday(input.date)) {
          streak = 0;
        }
      } catch {
        streak = 0;
      }
    }
    return {
      userId,
      link: input.postId,
      data: streak > 0 ? { streak: String(streak) } : {},
    };
  }));

  if (recipients.length > 0) {
    await notifications.enqueue({
      title: `fontWars ${await editionLabel(input.date)} is ready`,
      body: 'Five new type specimens. Twelve seconds each. Can you spot all five?',
      recipients,
    });
  }

  const nextCursor = optedIn.next ?? '';
  if (nextCursor) {
    const cursorId = createHash('sha256').update(nextCursor).digest('hex').slice(0, 12);
    await scheduler.runJob({
      id: `fontwars-push-${input.date}-${cursorId}`,
      name: 'daily-push-batch',
      data: { ...input, cursor: nextCursor },
      runAt: new Date(Date.now() + 1_500),
    });
  }
  return { done: !nextCursor, cursor: nextCursor, sent: recipients.length };
}

function yesterday(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function editionLabel(date: string): Promise<string> {
  const puzzleRaw = await redis.get(redisKeys.puzzle(date));
  if (!puzzleRaw) return 'today';
  try {
    const puzzle = JSON.parse(puzzleRaw) as { editionNumber: number };
    return `Vol. ${String(puzzle.editionNumber).padStart(3, '0')}`;
  } catch {
    return 'today';
  }
}
