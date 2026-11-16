import { describe, expect, it } from 'vitest';
import {
  generateDailyPuzzle,
  getEditionNumber,
  getFont,
  getPrimaryFontAsset,
  getRoundFontOptions,
  getTargetSpecimen,
  type ContentLibrary,
} from '../src/server/services/dailyPuzzle';
import type { FontRecord } from '../src/shared/types';

const testFonts: FontRecord[] = [
  { id: 'inter', name: 'Inter', file: 'Inter.ttf', format: 'truetype' },
  { id: 'playfair-display', name: 'Playfair Display', file: 'Playfair Display.otf', format: 'opentype' },
  { id: 'bowlby-one-sc', name: 'Bowlby One SC', file: 'Bowlby One SC.ttf', format: 'truetype' },
  { id: 'ibm-plex-sans', name: 'IBM Plex Sans', file: 'IBM Plex Sans.otf', format: 'opentype' },
  { id: 'work-sans', name: 'Work Sans', file: 'Work Sans.ttf', format: 'truetype' },
  { id: 'cinzel', name: 'Cinzel', file: 'Cinzel.otf', format: 'opentype' },
];

const testWords = [
  'Hamburgefonstiv',
  'minimum',
  'Typography',
  'AVATAR',
  'office affinity',
  'Sphinx of black quartz',
];

const testLibrary: ContentLibrary = { fonts: testFonts, words: testWords };

describe('daily specimen generator', () => {
  it('generates the same five rounds for the same UTC date and salt', () => {
    const first = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890', testLibrary);
    const second = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890', testLibrary);
    expect(first).toEqual(second);
    expect(first.rounds).toHaveLength(5);
  });

  it('uses only words supplied through the word library', () => {
    const puzzle = generateDailyPuzzle('2026-11-14', 'word-library-test-salt', testLibrary);
    expect(puzzle.rounds.map((round) => round.phrase).every((word) => testWords.includes(word))).toBe(true);
    expect(new Set(puzzle.rounds.map((round) => round.phrase)).size).toBe(5);
  });

  it('builds five rounds with four distinct fonts each and a valid target', () => {
    const puzzle = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890', testLibrary);
    expect(puzzle.rounds.map((round) => round.round)).toEqual([1, 2, 3, 4, 5]);
    for (const round of puzzle.rounds) {
      expect(round.optionFontIds).toHaveLength(4);
      expect(new Set(round.optionFontIds).size).toBe(4);
      expect(round.optionFontIds).toContain(round.targetFontId);
      expect(round.optionFontIds.every((id) => testFonts.some((font) => font.id === id))).toBe(true);
    }
  });

  it('applies a Friday theme to the fifth specimen without requiring font metadata', () => {
    const puzzle = generateDailyPuzzle('2026-11-13', 'test-salt-1234567890', testLibrary);
    expect(puzzle.rounds[4]?.fridayTheme).toBeTruthy();
    expect(puzzle.rounds[4]?.triviaTitle).toBeTruthy();
  });

  it('matches the project edition number for November 13, 2026', () => {
    expect(getEditionNumber('2026-11-13')).toBe(14);
  });

  it('resolves the selected font files and supports both TTF and OTF', () => {
    const fourFontLibrary = { fonts: testFonts.slice(0, 4), words: testWords };
    const puzzle = generateDailyPuzzle('2026-11-14', 'test-salt-1234567890', fourFontLibrary);
    const options = getRoundFontOptions(puzzle, 3, fourFontLibrary);
    const target = getTargetSpecimen(puzzle, 3, fourFontLibrary);

    expect(options).toHaveLength(4);
    expect(options.map((option) => option.id).sort()).toEqual([...puzzle.rounds[2]!.optionFontIds].sort());
    expect(options.every((option) => option.assetUrl.startsWith('/fonts/'))).toBe(true);
    expect(options.some((option) => option.assetFormat === 'opentype')).toBe(true);
    expect(options.some((option) => option.assetFormat === 'truetype')).toBe(true);
    expect(target.assetUrl.startsWith('/fonts/')).toBe(true);
    expect(options.find((option) => option.id === puzzle.rounds[2]!.targetFontId)?.assetUrl).toBe(target.assetUrl);
    expect(target).not.toHaveProperty('id');
    expect(target).not.toHaveProperty('name');
  });

  it('encodes spaces and punctuation in the discovered filename', () => {
    const fourFontLibrary = { fonts: testFonts.slice(0, 4), words: testWords };
    const puzzle = generateDailyPuzzle('2026-11-14', 'test-salt-1234567890', fourFontLibrary);
    const options = getRoundFontOptions(puzzle, 1, fourFontLibrary);
    expect(options.find((option) => option.name === 'Playfair Display')?.assetUrl).toBe('/fonts/Playfair%20Display.otf');
  });

  it('rejects unsupported or mismatched font extensions', () => {
    const font = getFont('inter', testLibrary);
    expect(() => getPrimaryFontAsset({ ...font, file: 'Inter.woff2' })).toThrow('Unsupported font file');
    expect(() => getPrimaryFontAsset({ ...font, format: 'opentype' })).toThrow('does not match');
  });

  it('requires at least four font files and five specimen entries', () => {
    expect(() => generateDailyPuzzle('2026-11-14', 'salt', { ...testLibrary, fonts: testFonts.slice(0, 3) })).toThrow('at least 4 font files');
    expect(() => generateDailyPuzzle('2026-11-14', 'salt', { ...testLibrary, words: testWords.slice(0, 4) })).toThrow('at least 5 entries');
  });
});
