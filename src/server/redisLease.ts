import { randomUUID } from 'node:crypto';
import { redis } from '@devvit/redis';

interface LeaseTransaction {
  get(key: string): Promise<string | null | undefined>;
  unwatch(): Promise<unknown>;
  multi(): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  exec(): Promise<unknown[] | null>;
  del(...keys: string[]): Promise<unknown>;
}

interface LeaseRedisClient {
  watch(...keys: string[]): Promise<LeaseTransaction>;
}

export interface RedisLease {
  release: () => Promise<void>;
}

/**
 * Acquire a short-lived, token-owned lease with WATCH/MULTI/EXEC. This keeps
 * lock creation and its expiry in one atomic transaction, avoiding a stuck
 * lock if a worker exits between SETNX and EXPIRE.
 */
export async function acquireLeaseWithClient(
  client: LeaseRedisClient,
  key: string,
  ttlSeconds: number,
  token: string,
): Promise<RedisLease | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const transaction = await client.watch(key);
    const current = await transaction.get(key);
    if (current) {
      await transaction.unwatch();
      return null;
    }
    await transaction.multi();
    await transaction.set(key, token);
    await transaction.expire(key, ttlSeconds);
    const committed = await transaction.exec();
    if (committed === null) continue;

    return {
      release: async () => {
        const releaseTransaction = await client.watch(key);
        const owner = await releaseTransaction.get(key);
        if (owner !== token) {
          await releaseTransaction.unwatch();
          return;
        }
        await releaseTransaction.multi();
        await releaseTransaction.del(key);
        await releaseTransaction.exec();
      },
    };
  }
  return null;
}

export function acquireRedisLease(key: string, ttlSeconds = 30): Promise<RedisLease | null> {
  return acquireLeaseWithClient(redis, key, ttlSeconds, randomUUID());
}
