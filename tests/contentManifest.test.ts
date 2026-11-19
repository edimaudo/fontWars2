import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function makeSfnt(seed: number, outline = 'glyf'): Buffer {
  const tables: Array<[string, number]> = [['cmap', 4], ['head', 54], ['maxp', 6], ['name', 6], [outline, 8]];
  const directoryEnd = 12 + tables.length * 16;
  const buffer = Buffer.alloc(directoryEnd + tables.reduce((sum, [, length]) => sum + length, 0));
  buffer.writeUInt32BE(0x00010000, 0);
  buffer.writeUInt16BE(tables.length, 4);
  let offset = directoryEnd;
  tables.forEach(([tag, length], index) => {
    const record = 12 + index * 16;
    buffer.write(tag, record, 'ascii');
    buffer.writeUInt32BE(offset, record + 8);
    buffer.writeUInt32BE(length, record + 12);
    buffer.fill(seed, offset, offset + length);
    offset += length;
  });
  return buffer;
}

function runManifest(fontFiles: Array<{ name: string; bytes: Buffer }>, words = '"one", "two", "three", "four", "five"'): { status: number; output: string; manifest?: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'fontwars-manifest-'));
  try {
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    mkdirSync(path.join(root, 'public', 'fonts'), { recursive: true });
    mkdirSync(path.join(root, 'assets', 'word_library'), { recursive: true });
    mkdirSync(path.join(root, 'src', 'server'), { recursive: true });
    cpSync(path.join(process.cwd(), 'scripts', 'generate-content-manifest.mjs'), path.join(root, 'scripts', 'generate-content-manifest.mjs'));
    for (const font of fontFiles) writeFileSync(path.join(root, 'public', 'fonts', font.name), font.bytes);
    writeFileSync(path.join(root, 'assets', 'word_library', 'words.txt'), words);
    let status = 0;
    let output = '';
    try {
      output = execFileSync(process.execPath, [path.join(root, 'scripts', 'generate-content-manifest.mjs'), '--strict'], {
        encoding: 'utf8',
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      status = error.status ?? 1;
      output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }
    const manifestPath = path.join(root, 'src', 'server', 'generated-content.ts');
    return { status, output, manifest: existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : undefined };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('generated font and word manifest', () => {
  it('accepts four distinct valid font assets and the quoted comma-separated word list', () => {
    const result = runManifest([
      { name: 'Alpha.ttf', bytes: makeSfnt(1) },
      { name: 'Bravo.otf', bytes: makeSfnt(2, 'CFF ') },
      { name: 'Charlie.ttf', bytes: makeSfnt(3) },
      { name: 'Delta.otf', bytes: makeSfnt(4, 'CFF2') },
    ]);
    expect(result.status).toBe(0);
    expect(result.manifest).toContain('Alpha');
    expect(result.manifest).toContain('Bravo');
    expect(result.manifest).toContain('"one"');
    expect(result.output).toContain('Discovered 4 font file(s) and 5 specimen word(s).');
  });

  it('rejects identical font binaries even when filenames differ', () => {
    const identical = makeSfnt(7);
    const result = runManifest([
      { name: 'Alpha.ttf', bytes: identical },
      { name: 'Bravo.ttf', bytes: identical },
      { name: 'Charlie.ttf', bytes: makeSfnt(8) },
      { name: 'Delta.ttf', bytes: makeSfnt(9) },
    ]);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('Identical font binaries detected');
  });

  it('rejects a file with a font extension but an invalid binary', () => {
    const result = runManifest([
      { name: 'Alpha.ttf', bytes: Buffer.from('not a font file') },
      { name: 'Bravo.ttf', bytes: makeSfnt(2) },
      { name: 'Charlie.ttf', bytes: makeSfnt(3) },
      { name: 'Delta.ttf', bytes: makeSfnt(4) },
    ]);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('valid TrueType/OpenType signature');
  });
});
