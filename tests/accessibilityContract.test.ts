import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('fontWars application accessibility contracts', () => {
  it('keeps the approved landing-page hierarchy and action labels', () => {
    const splash = read('../src/client/splash.tsx');
    expect(splash).toContain('Challenge your');
    expect(splash).toContain('Font');
    expect(splash).toContain('design knowledge');
    expect(splash).toContain('className="splash-note-sr"');
    expect(splash).toContain("'Play'");
    expect(splash).toContain('Settings');
    expect(splash).not.toContain('Flaunt your keen sense of design.');
    expect(splash).not.toContain('splash-settings-symbol');
  });

  it('keeps the active game actions together at the bottom of the game view', () => {
    const game = read('../src/client/game.tsx');
    expect(game).toContain('className="game-actions-footer"');
    expect(game).toContain('>Settings</button>');
    expect(game).toContain('End game');
    expect(game).toContain('role="dialog"');
    expect(game).toContain('aria-modal="true"');
    expect(game).toContain('exitExpandedMode');
  });

  it('uses neutral Inter labels for answers and preserves the specimen font', () => {
    const game = read('../src/client/game.tsx');
    const reveal = read('../src/client/components/RevealOverlay.tsx');
    const canvas = read('../src/client/components/SpecimenCanvas.tsx');
    expect(game).toContain('<strong>{option.name}</strong>');
    expect(game).not.toContain('option.renderFamily');
    expect(game).not.toContain('option.assetWeight');
    expect(game).not.toContain('option-number');
    expect(reveal).toContain('<strong>{option.name}</strong>');
    expect(reveal).not.toContain('option.renderFamily');
    expect(canvas).toContain('target.renderFamily');
  });

  it('puts Home and Settings after the results content and keeps the score label clear', () => {
    const result = read('../src/client/components/ResultCard.tsx');
    expect(result).toContain('className="result-actions-footer"');
    expect(result).toContain('>Home</button>');
    expect(result).toContain('>Settings</button>');
    expect(result).toContain('className="score-value"');
    expect(result).toContain('className="score-unit">points');
    expect(result).not.toContain('/ 5,000');
  });

  it('keeps theme and data management in Settings with bottom navigation', () => {
    const settings = read('../src/client/components/SettingsPage.tsx');
    expect(settings).toContain('Appearance');
    expect(settings).toContain('Manage my data');
    expect(settings).toContain('deleteMyGameData');
    expect(settings).toContain('className="settings-actions"');
    expect(settings).toContain('className="settings-return-button"');
  });

  it('uses visible focus, reduced motion, forced-colour support and responsive layouts', () => {
    const css = read('../src/client/duo-app-design.css');
    expect(css).toContain('button:focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('@media (max-width: 390px)');
    expect(css).toContain('@media (max-height: 620px)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('grid-template-rows: auto minmax(118px, .72fr) minmax(0, 1fr) auto');
  });
});
