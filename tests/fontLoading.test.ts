import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerFontFaces } from '../src/client/api';
import type { ActiveRoundPayload } from '../src/shared/types';

function makeRound(suffix: string): ActiveRoundPayload {
  const makeAsset = (family: string) => ({
    renderFamily: `fw_${suffix}_${family}`,
    assetUrl: `/fonts/${family}.ttf?test=${suffix}`,
    assetFormat: 'truetype' as const,
    assetWeight: '400',
    assetStyle: 'normal' as const,
    fallbackCss: 'Arial, sans-serif',
  });
  return {
    round: 1,
    category: 'Test',
    difficulty: 'Warm-up',
    phrase: 'Hamburgefonstiv',
    instruction: 'Identify the typeface.',
    target: makeAsset('target'),
    options: ['one', 'two', 'three', 'four'].map((id) => ({
      ...makeAsset(id),
      id,
      name: id,
      designer: 'Test designer',
      year: 2026,
      foundry: 'Test foundry',
    })),
    startedAt: null,
    remainingMs: 12_000,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TTF font loading', () => {
  it('loads the target and all four choices as TrueType faces', async () => {
    const constructed: Array<{ family: string; source: string }> = [];
    class MockFontFace {
      status = 'unloaded';
      constructor(family: string, source: string) {
        constructed.push({ family, source });
      }
      async load() {
        this.status = 'loaded';
        return this;
      }
    }
    const fontSet = {
      add: vi.fn(),
      ready: Promise.resolve(),
      check: vi.fn().mockReturnValue(true),
    };
    vi.stubGlobal('FontFace', MockFontFace);
    vi.stubGlobal('document', { fonts: fontSet });

    await registerFontFaces(makeRound('load'));

    expect(constructed).toHaveLength(5);
    expect(constructed.every((face) => face.source.includes('format("truetype")'))).toBe(true);
    expect(fontSet.add).toHaveBeenCalledTimes(5);
    expect(fontSet.check).toHaveBeenCalledTimes(5);
  });

  it('rejects a required face when its TTF asset fails to load', async () => {
    class MockFontFace {
      status = 'unloaded';
      constructor(private readonly _family: string, private readonly source: string) {}
      async load() {
        if (this.source.includes('three.ttf')) throw new Error('404 font missing');
        this.status = 'loaded';
        return this;
      }
    }
    const fontSet = {
      add: vi.fn(),
      ready: Promise.resolve(),
      check: vi.fn().mockReturnValue(true),
    };
    vi.stubGlobal('FontFace', MockFontFace);
    vi.stubGlobal('document', { fonts: fontSet });

    await expect(registerFontFaces(makeRound('failure'))).rejects.toThrow('404 font missing');
  });

  it('rejects unsafe asset URLs instead of building an arbitrary font request', async () => {
    class MockFontFace {
      status = 'unloaded';
      constructor() {}
      async load() { this.status = 'loaded'; return this; }
    }
    vi.stubGlobal('FontFace', MockFontFace);
    vi.stubGlobal('document', { fonts: { add: vi.fn(), ready: Promise.resolve(), check: () => true } });
    const round = makeRound('unsafe');
    round.target.assetUrl = 'https://example.com/remote.ttf';

    await expect(registerFontFaces(round)).rejects.toThrow('invalid font asset URL');
  });
});
