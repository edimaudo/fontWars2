import { createHash } from 'node:crypto';
import fontCatalog from '../../../assets/font_catalog.json';
import fridayThemes from '../../../assets/friday_themes.json';
import { formatEdition } from '../../shared/format';
import { mulberry32, pick, shuffle } from '../../shared/random';
import type {
  DailyPuzzle,
  DailyPuzzleRound,
  FontCluster,
  FontRecord,
  FontAssetRecord,
  SafeFontOption,
  SafeTargetSpecimen,
} from '../../shared/types';
import { VOLUME_EPOCH } from '../config';

const fonts = fontCatalog.fonts as FontRecord[];
const clusters = fontCatalog.clusters as FontCluster[];
const themeCatalog = fridayThemes.themes as Array<{
  id: string;
  label: string;
  clusterId: string;
  triviaTitle: string;
  triviaNote: string;
}>;

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

export function generateDailyPuzzle(date: string, salt: string): DailyPuzzle {
  const seed = hashSeed(date, salt);
  const rng = mulberry32(seed);
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const isFriday = weekday === 5;

  const rounds: DailyPuzzleRound[] = [];
  for (let roundNumber = 1; roundNumber <= 4; roundNumber += 1) {
    const available = clusters.filter((cluster) => cluster.round === roundNumber);
    const cluster = pick(available, rng);
    rounds.push(buildRound(cluster, roundNumber, rng));
  }

  let finalCluster: FontCluster;
  let finalTheme: (typeof themeCatalog)[number] | undefined;
  if (isFriday && themeCatalog.length > 0) {
    finalTheme = pick(themeCatalog, rng);
    finalCluster = clusters.find((cluster) => cluster.id === finalTheme!.clusterId)!;
  } else {
    const available = clusters.filter((cluster) => cluster.round === 5);
    finalCluster = pick(available, rng);
  }

  const finalRound = buildRound(finalCluster, 5, rng);
  if (finalTheme) {
    finalRound.fridayTheme = finalTheme.label;
    finalRound.triviaTitle = finalTheme.triviaTitle;
    finalRound.triviaNote = finalTheme.triviaNote;
  }
  rounds.push(finalRound);

  return {
    date,
    editionNumber: getEditionNumber(date),
    seed,
    rounds,
  };
}

function buildRound(cluster: FontCluster, round: number, rng: () => number): DailyPuzzleRound {
  const targetFontId = pick(cluster.fontIds, rng);
  return {
    round,
    clusterId: cluster.id,
    category: cluster.category,
    difficulty: cluster.difficulty,
    phrase: cluster.phrase,
    instruction: cluster.instruction,
    targetFontId,
    optionFontIds: shuffle(cluster.fontIds, rng),
    diagnosticNote: cluster.diagnostics[targetFontId] ?? 'Inspect the letterforms, spacing and terminals closely.',
    triviaTitle: cluster.triviaTitle,
    triviaNote: cluster.triviaNote,
  };
}

export function getFont(fontId: string): FontRecord {
  const font = fonts.find((item) => item.id === fontId);
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

export function getPrimaryFontAsset(font: FontRecord): FontAssetRecord {
  const asset = font.fontAssets.find((item) => Number(item.weight) === 400 && item.style === 'normal')
    ?? font.fontAssets.find((item) => item.style === 'normal')
    ?? font.fontAssets[0];
  if (!asset) throw new Error(`No font assets configured for ${font.id}.`);
  // Use the typeface's actual name as its filename, including spaces.
  // Supported pairs are `<Font Name>.ttf` + `truetype` and
  // `<Font Name>.otf` + `opentype`.
  const extension = asset.format === 'truetype' ? '.ttf'
    : asset.format === 'opentype' ? '.otf'
      : null;
  if (!extension) {
    throw new Error(`Font asset format for ${font.id} must be truetype or opentype.`);
  }
  const expectedFile = `${font.name}${extension}`;
  if (asset.file !== expectedFile) {
    throw new Error(`Font asset filename for ${font.id} must be exactly "${expectedFile}".`);
  }
  return asset;
}

function assetFormatForCss(format: FontAssetRecord['format']): string {
  return format;
}

export function safeFontOption(date: string, round: number, fontId: string): SafeFontOption {
  const font = getFont(fontId);
  const asset = getPrimaryFontAsset(font);
  return {
    id: font.id,
    name: font.name,
    designer: font.designer,
    year: font.year,
    foundry: font.foundry,
    renderFamily: aliasFor(date, round, fontId, 'option'),
    assetUrl: `/fonts/${encodeURIComponent(asset.file)}`,
    assetFormat: assetFormatForCss(asset.format),
    assetWeight: String(asset.weight),
    assetStyle: asset.style,
    fallbackCss: font.fallbackCss,
  };
}

export function safeTargetSpecimen(date: string, round: number, fontId: string): SafeTargetSpecimen {
  const font = getFont(fontId);
  const asset = getPrimaryFontAsset(font);
  return {
    renderFamily: aliasFor(date, round, fontId, 'specimen'),
    assetUrl: `/fonts/${encodeURIComponent(asset.file)}`,
    assetFormat: assetFormatForCss(asset.format),
    assetWeight: String(asset.weight),
    assetStyle: asset.style,
    fallbackCss: font.fallbackCss,
  };
}

export function getRoundContent(puzzle: DailyPuzzle, round: number): DailyPuzzleRound {
  const content = puzzle.rounds.find((item) => item.round === round);
  if (!content) throw new Error(`Round ${round} is not available in puzzle ${puzzle.date}.`);
  return content;
}

export function getRoundFontOptions(puzzle: DailyPuzzle, round: number): SafeFontOption[] {
  const content = getRoundContent(puzzle, round);
  return content.optionFontIds.map((fontId) => safeFontOption(puzzle.date, round, fontId));
}

export function getTargetSpecimen(puzzle: DailyPuzzle, round: number): SafeTargetSpecimen {
  const content = getRoundContent(puzzle, round);
  return safeTargetSpecimen(puzzle.date, round, content.targetFontId);
}

export function formatVolumeLabel(edition: number): string {
  return `Vol. ${formatEdition(edition)}`;
}
