import type {
  ActiveRoundPayload,
  FontRecord,
  InitPayload,
  RevealPayload,
  RoundResult,
  SafeFontOption,
} from '../shared/types';
import { getRoundStudyGuide } from '../shared/progression';
import { MAX_ACCEPTED_ELAPSED_MS, scoreRound } from '../shared/scoring';
import fridayThemes from '../../assets/friday_themes.json';

interface PreviewContent {
  fonts: FontRecord[];
  words: string[];
}

interface PreviewRound {
  phrase: string;
  difficulty: string;
  instruction: string;
  diagnosticNote: string;
  targetFont: FontRecord;
  options: SafeFontOption[];
  triviaTitle?: string;
  triviaNote?: string;
  fridayTheme?: string;
}

interface PreviewState {
  date: string;
  status: 'UNSTARTED' | 'IN_PROGRESS' | 'COMPLETED';
  currentRound: number;
  roundStartedAt: number | null;
  rounds: RoundResult[];
  totalScore: number;
}

const ROUND_MS = 12_000;
const STORAGE_PREFIX = 'fontwars:web-preview:v1:';
let contentPromise: Promise<PreviewContent> | null = null;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentEdition(date: string): number {
  const current = Date.parse(`${date}T00:00:00.000Z`);
  const epoch = Date.parse('2026-10-31T00:00:00.000Z');
  return Math.max(1, Math.floor((current - epoch) / 86_400_000) + 1);
}

function seededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

async function loadContent(): Promise<PreviewContent> {
  if (!contentPromise) {
    contentPromise = fetch('/preview-content.json', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('The preview content file is missing. Rebuild after adding your fonts and word list.');
      const content = await response.json() as PreviewContent;
      if (!Array.isArray(content.fonts) || content.fonts.length < 4) {
        throw new Error(`Add at least four .ttf or .otf files to public/fonts/. Found ${content.fonts?.length ?? 0}.`);
      }
      if (!Array.isArray(content.words) || content.words.length < 5) {
        throw new Error(`Add at least five quoted entries to assets/word_library/words.txt. Found ${content.words?.length ?? 0}.`);
      }
      return content;
    }).catch((error: unknown) => {
      contentPromise = null;
      throw error;
    });
  }
  return contentPromise;
}

function storageKey(date: string): string {
  return `${STORAGE_PREFIX}${date}`;
}

function readState(date: string): PreviewState {
  const empty: PreviewState = {
    date,
    status: 'UNSTARTED',
    currentRound: 1,
    roundStartedAt: null,
    rounds: [],
    totalScore: 0,
  };
  try {
    const raw = window.localStorage.getItem(storageKey(date));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as PreviewState;
    if (parsed.date !== date || !Array.isArray(parsed.rounds) || !Number.isInteger(parsed.currentRound)) return empty;
    return parsed;
  } catch {
    return empty;
  }
}

function writeState(state: PreviewState): void {
  try {
    window.localStorage.setItem(storageKey(state.date), JSON.stringify(state));
  } catch {
    throw new Error('Browser storage is unavailable. Enable local storage to keep a preview session.');
  }
}

async function buildRounds(date: string): Promise<PreviewRound[]> {
  const content = await loadContent();
  const random = seededRandom(`fontwars-browser-preview:${date}`);
  const words = shuffle(content.words, random).slice(0, 5);
  const themes = fridayThemes.themes;
  const friday = new Date(`${date}T00:00:00.000Z`).getUTCDay() === 5;
  const theme = friday ? themes[Math.floor(random() * themes.length)] : undefined;

  return Array.from({ length: 5 }, (_, index) => {
    const roundNumber = index + 1;
    const guide = getRoundStudyGuide(roundNumber);
    const selectedFonts = shuffle(content.fonts, random).slice(0, 4);
    const targetFont = selectedFonts[Math.floor(random() * selectedFonts.length)]!;
    const options = shuffle(selectedFonts, random).map((font): SafeFontOption => ({
      id: font.id,
      name: font.name,
      renderFamily: `fw_preview_${roundNumber}_${font.id}`,
      assetUrl: `/fonts/${encodeURIComponent(font.file)}`,
      assetFormat: font.format,
      assetWeight: '400',
      assetStyle: 'normal',
      fallbackCss: 'sans-serif',
    }));
    return {
      phrase: words[index]!,
      difficulty: guide.stage,
      instruction: guide.instruction,
      diagnosticNote: guide.diagnosticNote,
      targetFont,
      options,
      ...(roundNumber === 5 && theme ? {
        fridayTheme: theme.label,
        triviaTitle: theme.triviaTitle,
        triviaNote: theme.triviaNote,
      } : {}),
    };
  });
}

function activeRound(rounds: PreviewRound[], state: PreviewState): ActiveRoundPayload | null {
  if (state.status === 'COMPLETED' || state.currentRound > 5) return null;
  const current = rounds[state.currentRound - 1];
  if (!current) return null;
  const target = current.options.find((option) => option.id === current.targetFont.id)!;
  const elapsed = state.roundStartedAt === null ? 0 : Date.now() - state.roundStartedAt;
  return {
    round: state.currentRound,
    category: 'TYPEFACE IDENTIFICATION',
    difficulty: current.difficulty,
    phrase: current.phrase,
    instruction: current.instruction,
    target: {
      renderFamily: `fw_preview_target_${state.currentRound}_${current.targetFont.id}`,
      assetUrl: target.assetUrl,
      assetFormat: target.assetFormat,
      assetWeight: target.assetWeight,
      assetStyle: target.assetStyle,
      fallbackCss: target.fallbackCss,
    },
    options: current.options,
    startedAt: state.roundStartedAt,
    remainingMs: state.roundStartedAt === null ? ROUND_MS : Math.max(0, ROUND_MS - elapsed),
  };
}

async function buildInitPayload(state: PreviewState): Promise<InitPayload> {
  const rounds = await buildRounds(state.date);
  return {
    authenticated: true,
    username: 'browser-preview',
    date: state.date,
    editionNumber: currentEdition(state.date),
    subredditName: 'web-preview',
    postId: 'web-preview',
    status: state.status,
    currentRound: state.currentRound,
    totalScore: state.totalScore,
    streak: 0,
    maxStreak: 0,
    playedToday: 0,
    playerCount: 0,
    averageAccuracy: 0,
    percentile: null,
    hasCommented: false,
    isArchive: true,
    push: { available: false, optedIn: false },
    activeRound: activeRound(rounds, state),
    results: state.rounds.map((result) => ({
      result,
      font: rounds[result.round - 1]!.targetFont,
      crowdAccuracy: 0,
    })),
    unlockedFlairs: [],
  };
}

export async function previewLoadGame(): Promise<InitPayload> {
  const date = todayUtc();
  return buildInitPayload(readState(date));
}

export async function previewStartRound(): Promise<{ status: string; activeRound: ActiveRoundPayload | null }> {
  const date = todayUtc();
  const state = readState(date);
  if (state.status !== 'COMPLETED' && state.roundStartedAt === null) {
    state.status = 'IN_PROGRESS';
    state.roundStartedAt = Date.now();
    writeState(state);
  }
  const rounds = await buildRounds(date);
  return { status: state.status, activeRound: activeRound(rounds, state) };
}

export async function previewSubmitAnswer(selectedFontId: string | null, roundNumber: number): Promise<RevealPayload> {
  const date = todayUtc();
  const state = readState(date);
  if (state.status !== 'IN_PROGRESS' || state.roundStartedAt === null || roundNumber !== state.currentRound) {
    throw new Error('This preview round is no longer active. Refresh the game to continue.');
  }
  const rounds = await buildRounds(date);
  const current = rounds[state.currentRound - 1];
  if (!current || (selectedFontId !== null && !current.options.some((option) => option.id === selectedFontId))) {
    throw new Error('Choose one of the four specimen cards.');
  }

  const elapsedMs = Math.max(0, Date.now() - state.roundStartedAt);
  // Match the Devvit server's 500 ms transport grace: late selections are recorded as timeouts.
  const acceptedFontId = elapsedMs > MAX_ACCEPTED_ELAPSED_MS ? null : selectedFontId;
  const isCorrect = acceptedFontId !== null && acceptedFontId === current.targetFont.id;
  const roundScore = scoreRound(isCorrect, elapsedMs);
  const result: RoundResult = {
    round: state.currentRound,
    targetFontId: current.targetFont.id,
    selectedFontId: acceptedFontId,
    isCorrect,
    elapsedMs,
    roundScore,
    crowdDistribution: {},
    diagnosticNote: current.diagnosticNote,
    triviaTitle: current.triviaTitle,
    triviaNote: current.triviaNote,
  };
  state.rounds.push(result);
  state.totalScore += roundScore;
  state.currentRound += 1;
  state.roundStartedAt = null;
  const isComplete = state.currentRound > 5;
  if (isComplete) state.status = 'COMPLETED';
  writeState(state);

  return {
    result,
    correctFont: current.targetFont,
    options: current.options,
    crowdPercentages: Object.fromEntries(current.options.map((option) => [option.id, 0])),
    isComplete,
    totalScore: state.totalScore,
    percentile: null,
    playerCount: 0,
    streak: 0,
    unlockedFlairs: [],
  };
}

export async function previewLeaderboard(): Promise<{ date: string; entries: Array<{ username: string; score: number }> }> {
  return { date: todayUtc(), entries: [] };
}

function clearStoredPreviewSessions(): void {
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) keysToRemove.push(key);
  }
  for (const key of keysToRemove) window.localStorage.removeItem(key);
}

export async function previewDeleteData(): Promise<{ deleted: boolean; note: string }> {
  try {
    clearStoredPreviewSessions();
  } catch {
    throw new Error('Browser storage could not be cleared.');
  }
  return { deleted: true, note: 'Browser preview data was removed from this browser.' };
}

export function resetWebPreview(): void {
  try { clearStoredPreviewSessions(); } catch { /* The next load will show the storage error. */ }
}

