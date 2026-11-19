import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  previewDeleteData,
  previewLoadGame,
  previewStartRound,
  previewSubmitAnswer,
} from '../src/client/webPreview';

const fonts = [
  { id: 'font-alpha', name: 'Alpha', file: 'Alpha.ttf', format: 'truetype' as const },
  { id: 'font-bravo', name: 'Bravo', file: 'Bravo.otf', format: 'opentype' as const },
  { id: 'font-charlie', name: 'Charlie', file: 'Charlie.ttf', format: 'truetype' as const },
  { id: 'font-delta', name: 'Delta', file: 'Delta.otf', format: 'opentype' as const },
];
const words = ['one', 'two', 'three', 'four', 'five'];

function installBrowserMocks() {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      get length() { return values.size; },
      key: (index: number) => Array.from(values.keys())[index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ fonts, words }),
  }));
  return values;
}

describe('standalone browser preview adapter', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('runs five practice rounds, saves the result, and clears browser-local data', async () => {
    const values = installBrowserMocks();
    const initial = await previewLoadGame();
    expect(initial.status).toBe('UNSTARTED');
    expect(initial.activeRound?.options).toHaveLength(4);

    for (let round = 1; round <= 5; round += 1) {
      const started = await previewStartRound();
      expect(started.activeRound?.round).toBe(round);
      const selected = started.activeRound!.options[0]!;
      const reveal = await previewSubmitAnswer(selected.id, round);
      expect(reveal.result.round).toBe(round);
    }

    const completed = await previewLoadGame();
    expect(completed.status).toBe('COMPLETED');
    expect(completed.results).toHaveLength(5);
    expect(completed.isArchive).toBe(true);
    expect(completed.push.available).toBe(false);

    values.set('fontwars:web-preview:v1:2025-01-01', 'older session');
    values.set('unrelated-setting', 'keep');
    await previewDeleteData();
    expect(Array.from(values.keys()).some((key) => key.startsWith('fontwars:web-preview:v1:'))).toBe(false);
    expect(values.get('unrelated-setting')).toBe('keep');
    const reset = await previewLoadGame();
    expect(reset.status).toBe('UNSTARTED');
    expect(reset.results).toHaveLength(0);
  });

  it('records an answer submitted after the timer grace as a timeout', async () => {
    installBrowserMocks();
    const clock = vi.spyOn(Date, 'now');
    clock.mockReturnValue(1_000);
    const started = await previewStartRound();
    const selected = started.activeRound!.options[0]!;
    clock.mockReturnValue(14_000);

    const reveal = await previewSubmitAnswer(selected.id, 1);
    expect(reveal.result.selectedFontId).toBeNull();
    expect(reveal.result.isCorrect).toBe(false);
    expect(reveal.result.roundScore).toBe(0);
  });

});
