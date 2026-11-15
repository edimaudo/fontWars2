import { telemetry } from '@devvit/analytics/client/reddit';

type JourneyEvent = 'App.Ready' | 'Journey.Start' | 'Journey.Progress' | 'Journey.Complete';

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

export function appReady(): void {
  // App.Ready is mirrored to Redis. The current public Journeys client API
  // documents Journey methods but does not expose a callable App.Ready method.
  void verifyRedisReceipt('App.Ready');
}

export async function journeyStart(): Promise<void> {
  await Promise.allSettled([
    telemetry.startJourney(),
    verifyRedisReceipt('Journey.Start'),
  ]);
}

export async function journeyProgress(round: number): Promise<void> {
  await Promise.allSettled([
    telemetry.progress({ progress: Math.min(1, round / 5), action: 'specimen_answered' }),
    verifyRedisReceipt('Journey.Progress', { round }),
  ]);
}

export async function journeyEnd(score: number): Promise<void> {
  await Promise.allSettled([
    telemetry.endJourney({ complete: true, game: { win: score > 0, score } }),
    verifyRedisReceipt('Journey.Complete', { score }),
  ]);
}
