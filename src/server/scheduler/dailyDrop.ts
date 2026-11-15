import { createHash } from 'node:crypto';
import { redis } from '@devvit/redis';
import { context, notifications, reddit, scheduler, settings } from '@devvit/web/server';
import { formatUtcDate } from '../../shared/format';
import { generateDailyPuzzle } from '../services/dailyPuzzle';
import { getServerSalt } from '../services/session';
import { redisKeys } from '../config';

export async function createDailyPost(force = false): Promise<{ date: string; postId: string; created: boolean }> {
  const date = new Date().toISOString().slice(0, 10);
  const subredditName = (context as unknown as { subredditName?: string }).subredditName;
  if (!subredditName) throw new Error('This action must run inside a subreddit installation.');

  const postKey = redisKeys.dailyPost(date);
  const existing = await redis.get(postKey);
  if (existing) return { date, postId: existing, created: false };

  // A short Redis lock prevents a cron/manual invocation race from creating two posts.
  const lockKey = redisKeys.dailyPostLock(date);
  const lockAcquired = await redis.hSetNX(lockKey, 'creator', String(Date.now()));
  if (!lockAcquired) {
    const concurrentPost = await redis.get(postKey);
    return { date, postId: concurrentPost ?? '', created: false };
  }
  await redis.expire(lockKey, 60);

  try {
    const createdPost = await redis.get(postKey);
    if (createdPost) return { date, postId: createdPost, created: false };

    const salt = await getServerSalt();
    const puzzle = generateDailyPuzzle(date, salt);
    await redis.set(redisKeys.puzzle(date), JSON.stringify(puzzle));

    const autoCreate = await settings.get('autoCreateDailyPost');
    if (autoCreate === false && !force) return { date, postId: '', created: false };

    const post = await reddit.submitCustomPost({
      subredditName,
      title: `fontWars Vol. ${String(puzzle.editionNumber).padStart(3, '0')} — ${formatUtcDate(date)}`,
      entry: 'default',
    });
    const postId = post.id;
    await redis.set(postKey, postId);
    await redis.set(redisKeys.postDate(postId), date);

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
    await redis.hDel(lockKey, ['creator']);
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
