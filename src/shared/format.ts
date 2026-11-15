export function formatScore(score: number): string {
  return new Intl.NumberFormat('en-US').format(score);
}

export function formatEdition(edition: number): string {
  return String(edition).padStart(3, '0');
}

export function formatUtcDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function getYesterdayUtc(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}
