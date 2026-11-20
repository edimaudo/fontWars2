import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('fontWars interface and accessibility contracts', () => {
  it('uses the agreed landing-page positioning and removes preview notices', () => {
    const splash = read('../src/client/splash.tsx');
    expect(splash).toContain('A typographical skill game.');
    expect(splash).toContain('Flaunt your keen sense of design.');
    expect(splash).toContain('Playing fontWars is insanely addictive. Use responsibly.');
    expect(splash).not.toContain('splash-mark');
    expect(splash).not.toContain('>Aa</div>');
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
    expect(game).toContain('getRoundStudyGuide(round.round).instruction');
    expect(game).not.toContain('loading-mark');
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
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('color: var(--text); font-size: clamp(34px, 8vw, 76px)');
    expect(css).toContain('overflow-wrap: anywhere');
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
    expect(reveal).toContain('getRoundStudyGuide(result.round).feedback');
    expect(reveal).not.toContain('diagnosticNote');
    expect(reveal).not.toContain('AnatomyCallouts');
    expect(result).not.toContain('entry.result.diagnosticNote');
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

    expect(contrast('#20252d', '#f3f1eb')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#555e69', '#f3f1eb')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#f5f3ed', '#15191f')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#c0c6ce', '#15191f')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', '#294965')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#221d14', '#e2b65f')).toBeGreaterThanOrEqual(4.5);
  });

  it('provides the light/dark theme toggle across the app and keeps game-data controls secondary', () => {
    const theme = read('../src/client/components/ThemeToggle.tsx');
    const splash = read('../src/client/splash.tsx');
    const game = read('../src/client/game.tsx');
    const result = read('../src/client/components/ResultCard.tsx');
    const css = read('../src/client/styles.css');
    expect(theme).toContain("aria-pressed={theme === 'dark'}");
    expect(theme).toContain('localStorage.setItem');
    expect(splash).toContain('<ThemeToggle />');
    expect(game).toContain('<ThemeToggle />');
    expect(result).toContain('<ThemeToggle />');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(splash).toContain('<details className="privacy-details">');
    expect(result).toContain('<details className="privacy-details">');
    expect(result).not.toContain('<section className="privacy-actions"');
  });

  it('centres the landing page and uses a single-colour Inter wordmark with two weights', () => {
    const splash = read('../src/client/splash.tsx');
    const game = read('../src/client/game.tsx');
    const result = read('../src/client/components/ResultCard.tsx');
    const css = read('../src/client/styles.css');
    expect(splash).toContain('className="wordmark-regular"');
    expect(splash).toContain('className="wordmark-bold"');
    expect(css).toContain('font-family: Inter, ui-sans-serif, system-ui, sans-serif');
    expect(css).toContain('font-weight: 400');
    expect(css).toContain('font-weight: 700');
    expect(css).toContain('align-items: center; justify-content: center');
    expect(css).toContain('.wordmark .wordmark-bold { color: inherit;');
    expect(game).toContain('className="wordmark-regular"');
    expect(result).toContain('className="wordmark-regular"');
    expect(game).not.toContain('Start broad.');
    expect(read('../src/shared/progression.ts')).not.toContain('visual density');
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
