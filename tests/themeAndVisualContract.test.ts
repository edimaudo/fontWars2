import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('fontWars shared application visual system', () => {
  it('uses one shared design stylesheet in both app entrypoints', () => {
    const splash = read('../src/client/splash.tsx');
    const game = read('../src/client/game.tsx');
    const htmlSplash = read('../src/client/splash.html');
    const htmlGame = read('../src/client/game.html');
    expect(splash).toContain("import './duo-app-design.css';");
    expect(game).toContain("import './duo-app-design.css';");
    expect(htmlSplash).toContain('class="splash-body"');
    expect(htmlGame).toContain('class="game-body"');
    expect(htmlSplash).not.toContain('game-design.css');
    expect(htmlGame).not.toContain('game-design.css');
  });

  it('provides persistent light and dark theme preferences on Settings', () => {
    const settings = read('../src/client/components/SettingsPage.tsx');
    const theme = read('../src/client/theme.ts');
    const css = read('../src/client/duo-app-design.css');
    expect(settings).toContain('Appearance');
    expect(settings).toContain("setTheme('light')");
    expect(settings).toContain("setTheme('dark')");
    expect(settings).toContain('aria-pressed={theme ===');
    expect(theme).toContain('fontwars:theme:v1');
    expect(theme).toContain('localStorage.setItem');
    expect(css).toContain(':root[data-theme="dark"]');
  });

  it('uses equal Play and Settings dimensions without decorative gear icons', () => {
    const splash = read('../src/client/splash.tsx');
    const css = read('../src/client/duo-app-design.css');
    expect(splash).not.toContain('splash-settings-symbol');
    expect(css).toContain('body.splash-body .splash-cta,\nbody.splash-body .splash-settings-button');
    expect(css).toContain('min-height: 62px');
    expect(css).not.toContain('settings-open-button::before');
  });

  it('keeps the game specimen proportionate and answer labels neutral', () => {
    const game = read('../src/client/game.tsx');
    const css = read('../src/client/duo-app-design.css');
    expect(game).toContain('className="game-actions-footer"');
    expect(game).not.toContain('option.renderFamily');
    expect(css).toContain('height: clamp(170px, 27vh, 250px)');
    expect(css).toContain('font-family: Inter, ui-sans-serif, system-ui, sans-serif');
    expect(css).toContain('body.game-body .option-number { display: none; }');
  });

  it('keeps score, results actions and Settings navigation aligned', () => {
    const result = read('../src/client/components/ResultCard.tsx');
    const settings = read('../src/client/components/SettingsPage.tsx');
    const css = read('../src/client/duo-app-design.css');
    expect(result).toContain('className="result-actions-footer"');
    expect(result).not.toContain('/ 5,000');
    expect(css).toContain('font-size: clamp(58px, 7vw, 76px)');
    expect(css).toContain('.result-actions-footer');
    expect(settings).toContain('className="settings-actions"');
    expect(css).toContain('.settings-actions');
  });
});
