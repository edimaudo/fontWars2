import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const projectFile = (relativePath: string) => new URL(`../${relativePath}`, import.meta.url);

describe('web build output layout', () => {
  it('keeps Vite HTML entrypoints at the top level expected by Devvit and Vercel', async () => {
    const viteConfig = await readFile(projectFile('vite.config.ts'), 'utf8');
    const vercel = JSON.parse(await readFile(projectFile('vercel.json'), 'utf8'));
    const devvit = JSON.parse(await readFile(projectFile('devvit.json'), 'utf8'));

    expect(viteConfig).toContain("root: clientRoot");
    expect(viteConfig).toContain("const clientRoot = resolve(projectRoot, 'src/client')");
    expect(vercel.outputDirectory).toBe('dist/client');
    expect(devvit.post.dir).toBe('dist/client');
    expect(devvit.post.entrypoints.default.entry).toBe('splash.html');
    expect(devvit.post.entrypoints.game.entry).toBe('game.html');
  });
});
