import { describe, expect, it } from 'vitest';
import { generateDailyPuzzle, getEditionNumber, getFont, getPrimaryFontAsset, getRoundFontOptions, getTargetSpecimen } from '../src/server/services/dailyPuzzle';

describe('daily specimen generator', () => {
  it('generates the same five rounds for the same UTC date and salt', () => {
    const first = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890');
    const second = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890');
    expect(first).toEqual(second);
    expect(first.rounds).toHaveLength(5);
  });

  it('keeps the intended five-round difficulty curve', () => {
    const puzzle = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890');
    expect(puzzle.rounds.map((round) => round.round)).toEqual([1, 2, 3, 4, 5]);
    expect(puzzle.rounds.every((round) => round.optionFontIds.length === 4)).toBe(true);
  });

  it('applies a Friday cultural theme to the fifth specimen', () => {
    const puzzle = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890');
    expect(puzzle.rounds[4]?.fridayTheme).toBeTruthy();
    expect(puzzle.rounds[4]?.triviaTitle).toBeTruthy();
  });

  it('matches the PRD edition number for November 13, 2026', () => {
    expect(getEditionNumber('2026-11-13')).toBe(14);
  });


  it('resolves only the active puzzle round to four font choices and one target specimen', () => {
    const puzzle = generateDailyPuzzle('2026-11-14', 'test-salt-1234567890');
    const options = getRoundFontOptions(puzzle, 3);
    const target = getTargetSpecimen(puzzle, 3);

    expect(options).toHaveLength(4);
    expect(options.map((option) => option.id).sort()).toEqual([...puzzle.rounds[2]!.optionFontIds].sort());
    expect(options.every((option) => option.assetUrl.startsWith('/fonts/') && option.assetUrl.endsWith('.ttf'))).toBe(true);
    expect(options.map((option) => decodeURIComponent(option.assetUrl.split('/').pop()!))).toEqual(options.map((option) => `${option.name}.ttf`));
    expect(new Set(options.map((option) => option.renderFamily)).size).toBe(4);
    expect(target.assetUrl.startsWith('/fonts/')).toBe(true);
    expect(target.assetUrl.endsWith('.ttf')).toBe(true);
    expect(options.find((option) => option.id === puzzle.rounds[2]!.targetFontId)?.assetUrl).toBe(target.assetUrl);
    expect(target).not.toHaveProperty('id');
    expect(target).not.toHaveProperty('name');
  });


  it('rejects a binary filename that does not match the typeface name', () => {
    const font = getFont('inter');
    const invalid = {
      ...font,
      fontAssets: [{ ...font.fontAssets[0]!, file: 'Inter Typeface.ttf' }],
    };
    expect(() => getPrimaryFontAsset(invalid)).toThrow('must be exactly');
  });



  it('accepts an OpenType asset when its filename matches the typeface name', () => {
    const font = getFont('inter');
    const openType = {
      ...font,
      fontAssets: [{ ...font.fontAssets[0]!, file: 'Inter.otf', format: 'opentype' as const }],
    };
    expect(getPrimaryFontAsset(openType)).toMatchObject({ file: 'Inter.otf', format: 'opentype' });
  });

  it('rejects an OpenType asset with a mismatched extension or format', () => {
    const font = getFont('inter');
    const wrongExtension = {
      ...font,
      fontAssets: [{ ...font.fontAssets[0]!, file: 'Inter.ttf', format: 'opentype' as const }],
    };
    const wrongFormat = {
      ...font,
      fontAssets: [{ ...font.fontAssets[0]!, file: 'Inter.otf', format: 'truetype' as const }],
    };
    expect(() => getPrimaryFontAsset(wrongExtension)).toThrow('must be exactly "Inter.otf"');
    expect(() => getPrimaryFontAsset(wrongFormat)).toThrow('must be exactly "Inter.ttf"');
  });

  it('uses the typeface display name as the TTF filename', () => {
    expect(getPrimaryFontAsset(getFont('inter')).file).toBe('Inter.ttf');
    expect(getPrimaryFontAsset(getFont('playfair-display')).file).toBe('Playfair Display.ttf');
  });

  it('does not send the target font name or ID in the specimen payload', () => {
    const puzzle = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890');
    const target = getTargetSpecimen(puzzle, 1);
    expect(Object.keys(target).sort()).toEqual(['assetFormat', 'assetStyle', 'assetUrl', 'assetWeight', 'fallbackCss', 'renderFamily']);
    expect(target.renderFamily).toMatch(/^fw_spec_[a-f0-9]{10}$/);
  });
});
