import type { ActiveRoundPayload, ApiError, InitPayload, RevealPayload } from '../shared/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json() as T | ApiError;
  if (!response.ok) {
    const error = payload as ApiError;
    throw new Error(error.error || `Request failed (${response.status}).`);
  }
  return payload as T;
}

export function loadGame(): Promise<InitPayload> {
  return request<InitPayload>('/api/init');
}

export async function startRound(): Promise<{ status: string; activeRound: ActiveRoundPayload | null }> {
  return request('/api/round/start', { method: 'POST', body: '{}' });
}

export function submitAnswer(selectedFontId: string | null, round: number): Promise<RevealPayload> {
  return request('/api/round/submit', {
    method: 'POST',
    body: JSON.stringify({ selectedFontId, round }),
  });
}

export function shareResult(): Promise<{ posted: boolean; alreadyPosted?: boolean }> {
  return request('/api/share', { method: 'POST', body: '{}' });
}

export function equipFlair(flair: string): Promise<{ equipped: boolean; flair: string }> {
  return request('/api/flair', { method: 'POST', body: JSON.stringify({ flair }) });
}

export function setNotifications(enabled: boolean): Promise<{ available: boolean; optedIn: boolean; message?: string }> {
  return request('/api/notifications', { method: 'POST', body: JSON.stringify({ enabled }) });
}

interface FontFaceRequirement {
  family: string;
  url: string;
  format: string;
  weight: string;
  style: string;
}

const fontFaceLoads = new Map<string, Promise<void>>();

function cssUrl(value: string): string {
  if (!value.startsWith('/fonts/') || /[\"\n\r]/.test(value)) {
    throw new Error('The font catalogue returned an invalid font asset URL.');
  }
  return value;
}

async function loadFontFace(requirement: FontFaceRequirement): Promise<void> {
  if (!requirement.family || !requirement.url || !requirement.format) {
    throw new Error('A required typeface is missing its rendering metadata.');
  }

  const existing = fontFaceLoads.get(requirement.family);
  if (existing) return existing;

  const pending = (async () => {
    if (typeof FontFace === 'undefined' || !document.fonts) {
      throw new Error('This browser cannot load the licensed typeface files required by fontWars.');
    }

    const source = `url("${cssUrl(requirement.url)}") format("${requirement.format}")`;
    const face = new FontFace(requirement.family, source, {
      weight: requirement.weight,
      style: requirement.style,
      display: 'block',
    });
    const loadedFace = await face.load();
    if (loadedFace.status !== 'loaded') {
      throw new Error(`The typeface asset for ${requirement.family} did not finish loading.`);
    }
    (document.fonts as FontFaceSet & { add(face: FontFace): FontFaceSet }).add(loadedFace);
    await document.fonts.ready;
    if (!document.fonts.check(`16px "${requirement.family}"`)) {
      throw new Error(`The typeface asset for ${requirement.family} is unavailable after loading.`);
    }
  })();

  fontFaceLoads.set(requirement.family, pending);
  try {
    await pending;
  } catch (error) {
    fontFaceLoads.delete(requirement.family);
    throw error;
  }
}

export async function registerFontFaces(round: ActiveRoundPayload): Promise<void> {
  const faces: FontFaceRequirement[] = [
    {
      family: round.target.renderFamily,
      url: round.target.assetUrl,
      format: round.target.assetFormat,
      weight: round.target.assetWeight,
      style: round.target.assetStyle,
    },
    ...round.options.map((option) => ({
      family: option.renderFamily,
      url: option.assetUrl,
      format: option.assetFormat,
      weight: option.assetWeight,
      style: option.assetStyle,
    })),
  ];

  // The target and all four answer choices are mandatory. Never start a round
  // with a fallback face: doing so would make the typeface comparison unfair.
  await Promise.all(faces.map(loadFontFace));
  await document.fonts.ready;
}

export interface LeaderboardPayload {
  date: string;
  entries: Array<{ username: string; score: number }>;
}

export function loadLeaderboard(): Promise<LeaderboardPayload> {
  return request<LeaderboardPayload>('/api/leaderboard');
}

export function deleteMyGameData(): Promise<{ deleted: boolean; note: string }> {
  return request('/api/privacy/delete-me', { method: 'POST', body: '{}' });
}
