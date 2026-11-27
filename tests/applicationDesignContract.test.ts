import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('fontWars project-level UI integration', () => {
  it('registers a focused UI test command at the project root', () => {
    const pkg = JSON.parse(read('../package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:ui']).toContain('tests/applicationDesignContract.test.ts');
  });

  it('documents the shared application design outside the source tree', () => {
    const doc = read('../docs/APP_DESIGN_SYSTEM.md');
    expect(doc).toContain('Shared controls');
    expect(doc).toContain('Active game');
    expect(doc).toContain('Results and Settings');
    expect(doc).toContain('reduced-motion');
  });

  it('documents responsive and host-specific QA outside the source tree', () => {
    const doc = read('../docs/APP_UI_QA.md');
    expect(doc).toContain('fontWars UI QA checklist');
    expect(doc).toContain('320 px');
    expect(doc).toContain('Results and Settings');
    expect(doc).toContain('Reddit');
    expect(doc).toContain('Vercel');
  });
});
