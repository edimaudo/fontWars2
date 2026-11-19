import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('accessibility and responsive UI contracts', () => {
  it('keeps keyboard focus visible and respects reduced-motion preferences', () => {
    const css = read('../src/client/styles.css');
    expect(css).toContain('button:focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('@media (max-width: 420px)');
  });

  it('exposes progress, timer and loading state to assistive technology', () => {
    const game = read('../src/client/game.tsx');
    expect(game).toContain('role="progressbar"');
    expect(game).toContain('aria-valuetext={`Round ${progressRound} of 5`}');
    expect(game).toContain('role="timer"');
    expect(game).toContain('role="status" aria-live="polite"');
  });

  it('keeps result selection and reveal information programmatically labelled', () => {
    const result = read('../src/client/components/ResultCard.tsx');
    const reveal = read('../src/client/components/RevealOverlay.tsx');
    expect(result).toContain('aria-pressed={selected === index}');
    expect(result).toContain("aria-label={`Inspect round ${index + 1}: ${entry.result.isCorrect ? 'correct' : 'missed'}, ${entry.result.roundScore} points`}");
    expect(reveal).toContain('aria-live="polite"');
    expect(reveal).toContain('<AnatomyCallouts');
  });


  it('keeps key UI text and focus indicators above WCAG AA contrast thresholds', () => {
    const contrast = (foreground: string, background: string) => {
      const luminance = (hex: string) => {
        const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
        const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
      };
      const a = luminance(foreground);
      const b = luminance(background);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };

    expect(contrast('#a94f40', '#faf9f6')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#68655e', '#faf9f6')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#a6a3aa', '#1b1b1e')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#f0b85d', '#121214')).toBeGreaterThanOrEqual(3);
  });

  it('keeps self-service data deletion available from the feed card', () => {
    const splash = read('../src/client/splash.tsx');
    expect(splash).toContain('Manage game data');
    expect(splash).toContain('Confirm deletion');
    expect(splash).toContain('deleteMyGameData');
    const result = read('../src/client/components/ResultCard.tsx');
    expect(result).toContain('Delete my data');
    expect(result).toContain('Confirm deletion');
  });
});
