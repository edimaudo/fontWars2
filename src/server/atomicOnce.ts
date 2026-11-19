interface AtomicTransaction {
  hGet(key: string, field: string): Promise<string | null | undefined>;
  hSet(key: string, fields: Record<string, string>): Promise<unknown>;
  hIncrBy(key: string, field: string, amount: number): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  multi(): Promise<unknown>;
  unwatch(): Promise<unknown>;
  exec(): Promise<unknown[] | null>;
}

interface AtomicRedisClient {
  watch(...keys: string[]): Promise<AtomicTransaction>;
}

export interface AtomicIncrement {
  key: string;
  field: string;
  amount: number;
}

export interface AtomicExpiry {
  key: string;
  seconds: number;
}

export interface AtomicOnceResult {
  applied: boolean;
  value: string;
}

/** Writes a per-user marker and all dependent aggregate increments in one transaction. */
export async function applyOnce(
  client: AtomicRedisClient,
  markerKey: string,
  markerField: string,
  markerValue: string,
  increments: AtomicIncrement[],
  expiries: AtomicExpiry[],
): Promise<AtomicOnceResult> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const transaction = await client.watch(markerKey);
    const existing = await transaction.hGet(markerKey, markerField);
    if (existing) {
      await transaction.unwatch();
      return { applied: false, value: existing };
    }

    await transaction.multi();
    await transaction.hSet(markerKey, { [markerField]: markerValue });
    for (const increment of increments) {
      await transaction.hIncrBy(increment.key, increment.field, increment.amount);
    }
    for (const expiry of expiries) {
      await transaction.expire(expiry.key, expiry.seconds);
    }
    if (await transaction.exec() !== null) return { applied: true, value: markerValue };
  }
  throw new Error('The update could not be recorded safely. Retry the action.');
}
