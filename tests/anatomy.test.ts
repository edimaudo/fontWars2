import { describe, expect, it } from 'vitest';
import { getAnatomyGuidePositions } from '../src/shared/anatomy';

describe('typographic anatomy measurements', () => {
  it('positions cap height, x-height, baseline and descender from measured glyph metrics', () => {
    const positions = getAnatomyGuidePositions({
      capAscent: 46,
      xAscent: 31,
      descenderDescent: 14,
    }, 86);

    expect(positions).toEqual({ capHeight: 40, xHeight: 55, baseline: 86, descender: 100 });
    expect(positions.capHeight).toBeLessThan(positions.xHeight);
    expect(positions.xHeight).toBeLessThan(positions.baseline);
    expect(positions.baseline).toBeLessThan(positions.descender);
  });

  it('rejects invalid or missing glyph measurements rather than drawing fabricated guides', () => {
    expect(() => getAnatomyGuidePositions({ capAscent: 0, xAscent: 20, descenderDescent: 8 })).toThrow();
    expect(() => getAnatomyGuidePositions({ capAscent: 42, xAscent: Number.NaN, descenderDescent: 8 })).toThrow();
    expect(() => getAnatomyGuidePositions({ capAscent: 42, xAscent: 20, descenderDescent: -1 })).toThrow();
  });
});
