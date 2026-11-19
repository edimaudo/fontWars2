import { describe, expect, it } from 'vitest';
import { FIRST_ROUND_HINT_KEY, hasDismissedFirstRoundHint, persistFirstRoundHintDismissal } from '../src/client/onboarding';

function memoryStorage(): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('first-round onboarding hint', () => {
  it('shows the hint until dismissed, then persists the dismissal', () => {
    const storage = memoryStorage();
    expect(hasDismissedFirstRoundHint(storage)).toBe(false);
    persistFirstRoundHintDismissal(storage);
    expect(storage.getItem(FIRST_ROUND_HINT_KEY)).toBe('true');
    expect(hasDismissedFirstRoundHint(storage)).toBe(true);
  });

  it('fails open when browser storage is unavailable or throws', () => {
    expect(hasDismissedFirstRoundHint(null)).toBe(false);
    const blockedStorage = {
      getItem: () => { throw new Error('storage blocked'); },
      setItem: () => { throw new Error('storage blocked'); },
    };
    expect(hasDismissedFirstRoundHint(blockedStorage)).toBe(false);
    expect(() => persistFirstRoundHintDismissal(blockedStorage)).not.toThrow();
  });
});
