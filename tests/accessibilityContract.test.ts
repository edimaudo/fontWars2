import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('fontWars interface and accessibility contracts', () => {
  it('uses the agreed landing-page positioning and removes preview notices', () => {
    const splash = read('../src/client/splash.tsx');
    expect(splash).toContain('A typographical skill game.');
    expect(splash).toContain('Flaunt your keen sense of design.');
    expect(splash).toContain('Playing fontWars is insanely addictive. Use responsibly.');
    expect(splash).not.toContain('WEB PREVIEW');
    expect(splash).not.toContain('Type Foundry');
    expect(splash).not.toContain('A browser-only preview');
  });

  it('keeps gameplay concise and provides an accessible end-game action', () => {
    const game = read('../src/client/game.tsx');
    const canvas = read('../src/client/components/SpecimenCanvas.tsx');
    expect(game).toContain('End game');
    expect(game).toContain('role="dialog"');
    expect(game).toContain('aria-modal="true"');
    expect(game).toContain('exitExpandedMode');
    expect(game).toContain("'Compare the overall shape of the word.'");
    expect(game).not.toContain('WEB PREVIEW');
    expect(game).not.toContain('FIRST SPECIMEN');
    expect(game).not.toContain('TYPE FOUNDRY');
    expect(game).not.toContain('OTF');
    expect(game).not.toContain('TTF');
    expect(canvas).not.toContain('LETTERFORM STUDY');
    expect(canvas).not.toContain('SPECIMEN {');
    expect(canvas).not.toContain('THE LETTERFORM STUDY');
  });

  it('removes font file formats and technical filenames from answer reveals', () => {
    const reveal = read('../src/client/components/RevealOverlay.tsx');
    const result = read('../src/client/components/ResultCard.tsx');
    expect(reveal).not.toContain('OpenType');
    expect(reveal).not.toContain('TrueType');
    expect(reveal).not.toContain('OTF');
    expect(reveal).not.toContain('TTF');
    expect(reveal).not.toContain('correctFont.file');
    expect(result).not.toContain('entry.font.file');
    expect(result).not.toContain('specimens inspected');
    expect(result).not.toContain('A daily typographic study');
  });

  it('keeps keyboard focus visible and respects reduced motion', () => {
    const css = read('../src/client/styles.css');
    expect(css).toContain('button:focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('@media (max-width: 420px)');
    expect(css).toContain('.end-game-backdrop');
    expect(css).toContain('min-height: 44px');
  });

  it('exposes game progress, timer and loading state to assistive technology', () => {
    const game = read('../src/client/game.tsx');
    expect(game).toContain('role="progressbar"');
    expect(game).toContain('aria-valuetext={`Round ${progressRound} of 5`}');
    expect(game).toContain('role="timer"');
    expect(game).toContain('role="status" aria-live="polite"');
  });

  it('labels result selection and reveal information', () => {
    const result = read('../src/client/components/ResultCard.tsx');
    const reveal = read('../src/client/components/RevealOverlay.tsx');
    expect(result).toContain('aria-pressed={selected === index}');
    expect(result).toContain("aria-label={`Round ${index + 1}: ${entry.result.isCorrect ? 'correct' : 'missed'}, ${entry.result.roundScore} points`}");
    expect(reveal).toContain('aria-live="polite"');
    expect(reveal).toContain('<AnatomyCallouts');
  });

  it('keeps key UI text and focus indicators above the tested WCAG AA contrast thresholds', () => {
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

  it('keeps self-service data deletion available on the landing page and results', () => {
    const splash = read('../src/client/splash.tsx');
    expect(splash).toContain('Manage game data');
    expect(splash).toContain('Confirm deletion');
    expect(splash).toContain('deleteMyGameData');
    const result = read('../src/client/components/ResultCard.tsx');
    expect(result).toContain('Delete my data');
    expect(result).toContain('Confirm deletion');
  });
});
