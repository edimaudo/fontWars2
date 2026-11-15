export type GameStatus = 'UNSTARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type FontAssetFormat = 'truetype' | 'opentype';
export type FontAssetStyle = 'normal' | 'italic' | 'oblique';

export interface FontAssetRecord {
  file: string;
  format: FontAssetFormat;
  weight: number | string;
  style: FontAssetStyle;
}

export interface FontRecord {
  id: string;
  name: string;
  designer: string;
  year: number;
  foundry: string;
  fontAssets: FontAssetRecord[];
  fallbackCss: string;
  license: string;
  licenseUrl: string;
}

export interface FontCluster {
  id: string;
  round: number;
  category: string;
  difficulty: string;
  fontIds: string[];
  phrase: string;
  instruction: string;
  diagnostics: Record<string, string>;
  triviaTitle?: string;
  triviaNote?: string;
}

export interface DailyPuzzleRound {
  round: number;
  clusterId: string;
  category: string;
  difficulty: string;
  phrase: string;
  instruction: string;
  targetFontId: string;
  optionFontIds: string[];
  diagnosticNote: string;
  triviaTitle?: string;
  triviaNote?: string;
  fridayTheme?: string;
}

export interface DailyPuzzle {
  date: string;
  editionNumber: number;
  seed: number;
  rounds: DailyPuzzleRound[];
}

export interface RoundResult {
  round: number;
  targetFontId: string;
  selectedFontId: string | null;
  isCorrect: boolean;
  elapsedMs: number;
  roundScore: number;
  crowdDistribution: Record<string, number>;
  diagnosticNote: string;
  triviaTitle?: string;
  triviaNote?: string;
}

export interface SessionState {
  postId: string;
  userId: string;
  date: string;
  isArchive: boolean;
  status: GameStatus;
  currentRound: number;
  roundStartedAt: number | null;
  rounds: RoundResult[];
  totalScore: number;
  hasCommented: boolean;
  startedAt: number | null;
  completedAt: number | null;
  percentile: number | null;
  playerCount: number;
  streak: number;
  unlockedFlairs: string[];
}

export interface SafeFontOption {
  id: string;
  name: string;
  designer: string;
  year: number;
  foundry: string;
  renderFamily: string;
  assetUrl: string;
  assetFormat: FontAssetFormat;
  assetWeight: string;
  assetStyle: FontAssetStyle;
  fallbackCss: string;
}

export interface SafeTargetSpecimen {
  renderFamily: string;
  assetUrl: string;
  assetFormat: FontAssetFormat;
  assetWeight: string;
  assetStyle: FontAssetStyle;
  fallbackCss: string;
}

export interface ActiveRoundPayload {
  round: number;
  category: string;
  difficulty: string;
  phrase: string;
  instruction: string;
  target: SafeTargetSpecimen;
  options: SafeFontOption[];
  startedAt: number | null;
  remainingMs: number;
}

export interface RevealPayload {
  result: RoundResult;
  correctFont: FontRecord;
  options: SafeFontOption[];
  crowdPercentages: Record<string, number>;
  isComplete: boolean;
  totalScore: number;
  percentile: number | null;
  playerCount: number;
  streak: number;
  unlockedFlairs: string[];
}

export interface InitPayload {
  authenticated: boolean;
  username: string | null;
  date: string;
  editionNumber: number;
  subredditName: string;
  postId: string;
  status: GameStatus;
  currentRound: number;
  totalScore: number;
  streak: number;
  maxStreak: number;
  playedToday: number;
  playerCount: number;
  averageAccuracy: number;
  percentile: number | null;
  hasCommented: boolean;
  isArchive: boolean;
  push: {
    available: boolean;
    optedIn: boolean;
  };
  activeRound: ActiveRoundPayload | null;
  results: Array<{
    result: RoundResult;
    font: FontRecord;
    crowdAccuracy: number;
  }>;
  unlockedFlairs: string[];
}

export interface ApiError {
  error: string;
  code?: string;
}
