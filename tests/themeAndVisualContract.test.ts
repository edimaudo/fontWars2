import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('fontWars visual system', () => {
  it('provides persistent light and dark theme preferences only on Settings', () => {
    const settings = read('../src/client/components/SettingsPage.tsx');
    const theme = read('../src/client/theme.ts');
    const splash = read('../src/client/splash.tsx');
    const game = read('../src/client/game.tsx');
    const result = read('../src/client/components/ResultCard.tsx');
    const css = read('../src/client/styles.css');
    expect(settings).toContain('Appearance');
    expect(settings).toContain("aria-pressed={theme === 'light'}");
    expect(settings).toContain("aria-pressed={theme === 'dark'}");
    expect(theme).toContain("fontwars:theme:v1");
    expect(theme).toContain('localStorage.setItem');
    expect(splash).toContain('applySavedTheme');
    expect(game).toContain('applySavedTheme');
    expect(splash).toContain('<SettingsPage');
    expect(game).toContain('<SettingsPage');
    expect(result).toContain('onOpenSettings');
    expect(game).toContain('timerPausedRef.current = true');
    expect(game).toContain('remainingMsRef.current');
    expect(splash).not.toContain('ThemeToggle');
    expect(game).not.toContain('ThemeToggle');
    expect(result).not.toContain('ThemeToggle');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('.settings-theme-options');
  });

  it('keeps data deletion controls and confirmation on the Settings page only', () => {
    const settings = read('../src/client/components/SettingsPage.tsx');
    const splash = read('../src/client/splash.tsx');
    const result = read('../src/client/components/ResultCard.tsx');
    expect(settings).toContain('Manage my data');
    expect(settings).toContain('Delete my data');
    expect(settings).toContain('Confirm deletion');
    expect(settings).toContain('deleteMyGameData');
    expect(splash).not.toContain('deleteMyGameData');
    expect(splash).not.toContain('Manage game data');
    expect(result).not.toContain('deleteMyGameData');
    expect(result).not.toContain('Manage game data');
  });

  it('keeps the Settings screen responsive and keyboard operable', () => {
    const css = read('../src/client/styles.css');
    const settings = read('../src/client/components/SettingsPage.tsx');
    expect(css).toContain('.settings-shell');
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain('@media (max-width: 370px)');
    expect(css).toContain('button:focus-visible');
    expect(css).toContain('@media (forced-colors: active)');
    expect(settings).toContain('role="group" aria-label="Colour theme"');
    expect(settings).toContain('aria-live="polite"');
  });
});
