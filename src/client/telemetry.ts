import { isWebPreview } from './platform';

type JourneyEvent = 'App.Ready' | 'Journey.Start' | 'Journey.Progress' | 'Journey.End';

interface PlatformReceiptResponse {
  receipt?: {
    status?: string;
    message?: string;
  };
}

async function verifyRedisReceipt(event: JourneyEvent, detail: { round?: number; score?: number } = {}): Promise<void> {
  try {
    const response = await fetch('/api/journey-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, ...detail }),
    });
    const payload = await response.json() as { receipt?: { stored?: boolean; event?: string } };
    if (!response.ok || payload.receipt?.stored !== true || payload.receipt.event !== event) {
      throw new Error('The Redis event receipt did not match the submitted event.');
    }
  } catch (error) {
    console.warn(`fontWars could not verify the ${event} Redis receipt.`, error);
  }
}

async function inspectPlatformReceipt(event: JourneyEvent, action: (telemetry: typeof import('@devvit/analytics/client/reddit').telemetry) => Promise<unknown> | unknown): Promise<void> {
  try {
    const { telemetry } = await import('@devvit/analytics/client/reddit');
    const result = await action(telemetry) as PlatformReceiptResponse | undefined;
    const receipt = result?.receipt;
    if (!receipt) {
      console.warn(`fontWars received no platform receipt for ${event}.`);
      return;
    }
    if (receipt.status !== 'JOURNEY_RECEIPT_VALID') {
      console.info(`fontWars platform telemetry ${event}: ${receipt.status ?? 'unknown'} — ${receipt.message ?? 'No diagnostic message.'}`);
    }
  } catch (error) {
    console.warn(`fontWars platform telemetry ${event} failed.`, error);
  }
}

export function appReady(): void {
  if (isWebPreview()) return;
  void inspectPlatformReceipt('App.Ready', (telemetry) => telemetry.appReady());
  void verifyRedisReceipt('App.Ready');
}

export async function journeyStart(): Promise<void> {
  if (isWebPreview()) return;
  await Promise.allSettled([
    inspectPlatformReceipt('Journey.Start', (telemetry) => telemetry.startJourney()),
    verifyRedisReceipt('Journey.Start'),
  ]);
}

export async function journeyProgress(round: number): Promise<void> {
  if (isWebPreview()) return;
  await Promise.allSettled([
    inspectPlatformReceipt('Journey.Progress', (telemetry) => telemetry.progress({
      progress: Math.min(1, round / 5),
      action: 'specimen_answered',
    })),
    verifyRedisReceipt('Journey.Progress', { round }),
  ]);
}

export async function journeyEnd(score: number): Promise<void> {
  if (isWebPreview()) return;
  await Promise.allSettled([
    inspectPlatformReceipt('Journey.End', (telemetry) => telemetry.endJourney({ complete: true, game: { win: score > 0, score } })),
    verifyRedisReceipt('Journey.End', { score }),
  ]);
}
