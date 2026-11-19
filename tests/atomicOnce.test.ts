import { describe, expect, it } from 'vitest';
import { applyOnce } from '../src/server/atomicOnce';

class MemoryRedis {
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly versions = new Map<string, number>();
  readonly expiries = new Map<string, number>();

  async watch(...keys: string[]) {
    const watched = new Map(keys.map((key) => [key, this.versions.get(key) ?? 0]));
    const commands: Array<{ type: string; key: string; field?: string; value?: string | number }> = [];
    let queued = false;
    const redis = this;
    return {
      hGet: async (key: string, field: string) => redis.hashes.get(key)?.get(field) ?? null,
      unwatch: async () => { commands.length = 0; },
      multi: async () => { queued = true; },
      hSet: async (key: string, values: Record<string, string>) => {
        if (queued) Object.entries(values).forEach(([field, value]) => commands.push({ type: 'hSet', key, field, value }));
      },
      hIncrBy: async (key: string, field: string, amount: number) => {
        if (queued) commands.push({ type: 'hIncrBy', key, field, value: amount });
      },
      expire: async (key: string, seconds: number) => {
        if (queued) commands.push({ type: 'expire', key, value: seconds });
      },
      exec: async () => {
        for (const [key, version] of watched) if ((redis.versions.get(key) ?? 0) !== version) return null;
        for (const command of commands) {
          if (command.type === 'expire') {
            redis.expiries.set(command.key, Number(command.value));
          } else {
            const hash = redis.hashes.get(command.key) ?? new Map<string, string>();
            const current = Number(hash.get(command.field!) ?? 0);
            hash.set(command.field!, command.type === 'hSet' ? String(command.value) : String(current + Number(command.value)));
            redis.hashes.set(command.key, hash);
          }
          redis.versions.set(command.key, (redis.versions.get(command.key) ?? 0) + 1);
        }
        return commands.map(() => 'OK');
      },
    };
  }

  value(key: string, field: string): string | undefined { return this.hashes.get(key)?.get(field); }
}

describe('atomic once-only updates', () => {
  it('writes a marker and its aggregate increment only once', async () => {
    const redis = new MemoryRedis();
    const first = await applyOnce(redis, 'played', 'user-1', '1', [{ key: 'stats', field: 'playCount', amount: 1 }], [
      { key: 'played', seconds: 100 }, { key: 'stats', seconds: 100 },
    ]);
    const retry = await applyOnce(redis, 'played', 'user-1', '1', [{ key: 'stats', field: 'playCount', amount: 1 }], [
      { key: 'played', seconds: 100 }, { key: 'stats', seconds: 100 },
    ]);
    expect(first.applied).toBe(true);
    expect(retry.applied).toBe(false);
    expect(redis.value('stats', 'playCount')).toBe('1');
    expect(redis.expiries.get('played')).toBe(100);
  });

  it('serializes simultaneous submissions for the same marker', async () => {
    const redis = new MemoryRedis();
    const apply = () => applyOnce(redis, 'round:one', 'user-1', '{"selected":"font-a"}', [
      { key: 'crowd:one', field: 'font-a', amount: 1 },
      { key: 'stats', field: 'answered', amount: 1 },
    ], [{ key: 'round:one', seconds: 100 }]);
    const results = await Promise.all([apply(), apply()]);
    expect(results.filter((result) => result.applied)).toHaveLength(1);
    expect(redis.value('crowd:one', 'font-a')).toBe('1');
    expect(redis.value('stats', 'answered')).toBe('1');
  });
});
