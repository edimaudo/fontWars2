export const FIRST_ROUND_HINT_KEY = 'fontwars:first-round-hint-dismissed:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function hasDismissedFirstRoundHint(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(FIRST_ROUND_HINT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function persistFirstRoundHintDismissal(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(FIRST_ROUND_HINT_KEY, 'true');
  } catch {
    // Storage can be blocked in embedded browsers; the in-memory dismissal still works.
  }
}
