import { describe, expect, it } from 'vitest';
import { acquireLeaseWithClient } from '../src/server/redisLease';

interface PendingCommand {
  method: 'set' | 'expire' | 'del';
  key: string;
  value?: string | number;
}

class MemoryRedis {
  private readonly values = new Map<string, string>();
  private readonly versions = new Map<string, number>();
  readonly expiries = new Map<string, number>();

  async watch(...keys: string[]) {
    const watched = new Map(keys.map((key) => [key, this.versions.get(key) ?? 0]));
    const commands: PendingCommand[] = [];
    let queued = false;
    const client = this;
    return {
      get: async (key: string) => client.values.get(key) ?? null,
      unwatch: async () => { commands.length = 0; },
      multi: async () => { queued = true; },
      set: async (key: string, value: string) => {
        if (queued) commands.push({ method: 'set', key, value });
      },
      expire: async (key: string, seconds: number) => {
        if (queued) commands.push({ method: 'expire', key, value: seconds });
      },
      del: async (...keysToDelete: string[]) => {
        if (queued) keysToDelete.forEach((key) => commands.push({ method: 'del', key }));
      },
      exec: async () => {
        for (const [key, version] of watched) {
          if ((client.versions.get(key) ?? 0) !== version) return null;
        }
        for (const command of commands) {
          if (command.method === 'set') client.values.set(command.key, String(command.value));
          if (command.method === 'expire') client.expiries.set(command.key, Number(command.value));
          if (command.method === 'del') {
            client.values.delete(command.key);
            client.expiries.delete(command.key);
          }
          client.versions.set(command.key, (client.versions.get(command.key) ?? 0) + 1);
        }
        return commands.map(() => 'OK');
      },
    };
  }

  setRaw(key: string, value: string) {
    this.values.set(key, value);
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }
  getRaw(key: string) { return this.values.get(key) ?? null; }
}

describe('Redis lease acquisition', () => {
  it('sets lease and expiry atomically, then permits reacquisition after release', async () => {
    const redis = new MemoryRedis();
    const first = await acquireLeaseWithClient(redis, 'lease:test', 30, 'worker-a');
    expect(first).not.toBeNull();
    expect(redis.getRaw('lease:test')).toBe('worker-a');
    expect(redis.expiries.get('lease:test')).toBe(30);
    expect(await acquireLeaseWithClient(redis, 'lease:test', 30, 'worker-b')).toBeNull();

    await first!.release();
    const second = await acquireLeaseWithClient(redis, 'lease:test', 15, 'worker-b');
    expect(second).not.toBeNull();
    expect(redis.getRaw('lease:test')).toBe('worker-b');
  });

  it('does not release a lease owned by a newer worker', async () => {
    const redis = new MemoryRedis();
    const first = await acquireLeaseWithClient(redis, 'lease:test', 30, 'worker-a');
    redis.setRaw('lease:test', 'worker-b');
    await first!.release();
    expect(redis.getRaw('lease:test')).toBe('worker-b');
  });
});
