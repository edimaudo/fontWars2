import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
describe('fontWars visual system', () => {
  it('provides a persistent accessible light/dark mode toggle', () => {
    const theme = read('../src/client/components/ThemeToggle.tsx');
    const css = read('../src/client/styles.css');
    expect(theme).toContain("aria-pressed={theme === 'dark'}");
    expect(theme).toContain('localStorage.setItem');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('--page: #f3f1eb');
  });
  it('keeps the data-management controls collapsed by default', () => {
    const splash = read('../src/client/splash.tsx');
    const result = read('../src/client/components/ResultCard.tsx');
    expect(splash).toContain('<details className="privacy-details">');
    expect(result).toContain('<details className="privacy-details">');
    expect(splash).not.toContain('text-button data-manage-link');
    expect(result).not.toContain('<section className="privacy-actions"');
  });
  it('styles the landing, game, reveal and result screens in one stylesheet', () => {
    const css = read('../src/client/styles.css');
    for (const selector of ['.splash-shell', '.game-shell', '.specimen-canvas', '.font-option', '.reveal-panel', '.result-page', '.leaderboard-list', '.end-game-dialog']) {
      expect(css).toContain(selector);
    }
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain('button:focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('.toggle { display: flex; width: 52px; height: 44px;');
  });
});
