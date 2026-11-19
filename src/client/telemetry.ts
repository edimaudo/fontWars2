import { telemetry } from '@devvit/analytics/client/reddit';

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

async function inspectPlatformReceipt(event: JourneyEvent, action: () => Promise<unknown> | unknown): Promise<void> {
  try {
    const result = await action() as PlatformReceiptResponse | undefined;
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
  void inspectPlatformReceipt('App.Ready', () => telemetry.appReady());
  void verifyRedisReceipt('App.Ready');
}

export async function journeyStart(): Promise<void> {
  await Promise.allSettled([
    inspectPlatformReceipt('Journey.Start', () => telemetry.startJourney()),
    verifyRedisReceipt('Journey.Start'),
  ]);
}

export async function journeyProgress(round: number): Promise<void> {
  await Promise.allSettled([
    inspectPlatformReceipt('Journey.Progress', () => telemetry.progress({
      progress: Math.min(1, round / 5),
      action: 'specimen_answered',
    })),
    verifyRedisReceipt('Journey.Progress', { round }),
  ]);
}

export async function journeyEnd(score: number): Promise<void> {
  await Promise.allSettled([
    inspectPlatformReceipt('Journey.End', () => telemetry.endJourney({ complete: true, game: { win: score > 0, score } })),
    verifyRedisReceipt('Journey.End', { score }),
  ]);
}
