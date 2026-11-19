import { createHash } from 'node:crypto';
import fridayThemes from '../../../assets/friday_themes.json';
import { formatEdition } from '../../shared/format';
import { mulberry32, pick, shuffle } from '../../shared/random';
import { getRoundStudyGuide } from '../../shared/progression';
import type {
  DailyPuzzle,
  DailyPuzzleRound,
  FontRecord,
  SafeFontOption,
  SafeTargetSpecimen,
} from '../../shared/types';
import { discoveredFonts, specimenWords } from '../generated-content';
import { VOLUME_EPOCH } from '../config';

export interface ContentLibrary {
  fonts: FontRecord[];
  words: string[];
}

const defaultLibrary: ContentLibrary = {
  fonts: discoveredFonts,
  words: specimenWords,
};

export interface FridayTheme {
  id: string;
  label: string;
  triviaTitle: string;
  triviaNote: string;
}

export const themeCatalog = fridayThemes.themes as FridayTheme[];

export function validateFridayThemes(themes: FridayTheme[]): void {
  if (themes.length < 8) {
    throw new Error(`fontWars needs at least 8 Friday themes. Found ${themes.length}.`);
  }
  const seen = new Set<string>();
  for (const theme of themes) {
    const id = theme.id.trim().toLowerCase();
    if (!id || seen.has(id)) throw new Error(`Friday theme IDs must be present and unique: ${theme.id}`);
    seen.add(id);
    if (!theme.label.trim() || !theme.triviaTitle.trim() || !theme.triviaNote.trim()) {
      throw new Error(`Friday theme ${theme.id} is missing its label or learning note.`);
    }
  }
}

validateFridayThemes(themeCatalog);

export function getEditionNumber(date: string): number {
  const current = Date.parse(`${date}T00:00:00.000Z`);
  const epoch = Date.parse(`${VOLUME_EPOCH}T00:00:00.000Z`);
  if (!Number.isFinite(current) || !Number.isFinite(epoch)) return 1;
  return Math.max(1, Math.floor((current - epoch) / 86_400_000) + 1);
}

export function hashSeed(date: string, salt: string): number {
  const digest = createHash('sha256').update(`${date}:${salt}`).digest('hex');
  return Number.parseInt(digest.slice(0, 8), 16) >>> 0;
}

function buildRound(
  roundNumber: number,
  fonts: FontRecord[],
  phrase: string,
  rng: () => number,
): DailyPuzzleRound {
  const roundFonts = shuffle(fonts, rng).slice(0, 4);
  const targetFontId = pick(roundFonts, rng).id;
  const studyGuide = getRoundStudyGuide(roundNumber);
  return {
    round: roundNumber,
    category: 'TYPEFACE IDENTIFICATION',
    difficulty: studyGuide.stage,
    phrase,
    instruction: studyGuide.instruction,
    targetFontId,
    optionFontIds: shuffle(roundFonts.map((font) => font.id), rng),
    diagnosticNote: studyGuide.diagnosticNote,
  };
}

export function generateDailyPuzzle(
  date: string,
  salt: string,
  library: ContentLibrary = defaultLibrary,
): DailyPuzzle {
  if (library.fonts.length < 4) {
    throw new Error(`fontWars needs at least 4 font files in public/fonts/. Found ${library.fonts.length}.`);
  }
  if (library.words.length < 5) {
    throw new Error(`fontWars needs at least 5 entries in assets/word_library/words.txt. Found ${library.words.length}.`);
  }

  const seed = hashSeed(date, salt);
  const rng = mulberry32(seed);
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const isFriday = weekday === 5;
  const dailyWords = shuffle([...library.words], rng).slice(0, 5);

  const rounds: DailyPuzzleRound[] = [];
  for (let roundNumber = 1; roundNumber <= 5; roundNumber += 1) {
    rounds.push(buildRound(roundNumber, library.fonts, dailyWords[roundNumber - 1]!, rng));
  }

  let finalTheme: (typeof themeCatalog)[number] | undefined;
  if (isFriday && themeCatalog.length > 0) {
    finalTheme = pick(themeCatalog, rng);
    const finalRound = rounds[4]!;
    finalRound.fridayTheme = finalTheme.label;
    finalRound.triviaTitle = finalTheme.triviaTitle;
    finalRound.triviaNote = finalTheme.triviaNote;
  }

  return {
    date,
    editionNumber: getEditionNumber(date),
    seed,
    rounds,
  };
}

export function getFont(fontId: string, library: ContentLibrary = defaultLibrary): FontRecord {
  const font = library.fonts.find((item) => item.id === fontId);
  if (!font) throw new Error(`Unknown font id: ${fontId}`);
  return font;
}

function aliasFor(date: string, round: number, fontId: string, role: 'option' | 'specimen'): string {
  const suffix = createHash('sha256')
    .update(`${date}:${round}:${fontId}:${role}`)
    .digest('hex')
    .slice(0, 10);
  return role === 'specimen' ? `fw_spec_${suffix}` : `fw_choice_${suffix}`;
}

export function getPrimaryFontAsset(font: FontRecord) {
  const extension = font.file.toLowerCase().endsWith('.ttf') ? '.ttf'
    : font.file.toLowerCase().endsWith('.otf') ? '.otf'
      : null;
  if (!extension) throw new Error(`Unsupported font file for ${font.name}: ${font.file}`);
  const expectedFormat = extension === '.ttf' ? 'truetype' : 'opentype';
  if (font.format !== expectedFormat) {
    throw new Error(`Font format does not match the extension for ${font.file}.`);
  }
  return {
    file: font.file,
    format: font.format,
    weight: 400,
    style: 'normal' as const,
  };
}

export function safeFontOption(date: string, round: number, fontId: string, library: ContentLibrary = defaultLibrary): SafeFontOption {
  const font = getFont(fontId, library);
  const asset = getPrimaryFontAsset(font);
  return {
    id: font.id,
    name: font.name,
    renderFamily: aliasFor(date, round, fontId, 'option'),
    assetUrl: `/fonts/${encodeURIComponent(asset.file)}`,
    assetFormat: asset.format,
    assetWeight: String(asset.weight),
    assetStyle: asset.style,
    fallbackCss: 'sans-serif',
  };
}

export function safeTargetSpecimen(date: string, round: number, fontId: string, library: ContentLibrary = defaultLibrary): SafeTargetSpecimen {
  const font = getFont(fontId, library);
  const asset = getPrimaryFontAsset(font);
  return {
    renderFamily: aliasFor(date, round, fontId, 'specimen'),
    assetUrl: `/fonts/${encodeURIComponent(asset.file)}`,
    assetFormat: asset.format,
    assetWeight: String(asset.weight),
    assetStyle: asset.style,
    fallbackCss: 'sans-serif',
  };
}

export function getRoundContent(puzzle: DailyPuzzle, round: number): DailyPuzzleRound {
  const content = puzzle.rounds.find((item) => item.round === round);
  if (!content) throw new Error(`Round ${round} is not available in puzzle ${puzzle.date}.`);
  return content;
}

export function getRoundFontOptions(puzzle: DailyPuzzle, round: number, library: ContentLibrary = defaultLibrary): SafeFontOption[] {
  const content = getRoundContent(puzzle, round);
  return content.optionFontIds.map((fontId) => safeFontOption(puzzle.date, round, fontId, library));
}

export function getTargetSpecimen(puzzle: DailyPuzzle, round: number, library: ContentLibrary = defaultLibrary): SafeTargetSpecimen {
  const content = getRoundContent(puzzle, round);
  return safeTargetSpecimen(puzzle.date, round, content.targetFontId, library);
}

export function formatVolumeLabel(edition: number): string {
  return `Vol. ${formatEdition(edition)}`;
}
