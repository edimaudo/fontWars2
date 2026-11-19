import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function makeSfnt(signature: 'ttf' | 'otf' = 'ttf', outline = 'glyf'): Buffer {
  const tables: Array<[string, number]> = [
    ['cmap', 4],
    ['head', 54],
    ['maxp', 6],
    ['name', 6],
    [outline, 8],
  ];
  const directoryEnd = 12 + tables.length * 16;
  const totalLength = directoryEnd + tables.reduce((sum, [, length]) => sum + length, 0);
  const buffer = Buffer.alloc(totalLength);
  if (signature === 'otf') buffer.write('OTTO', 0, 'ascii');
  else buffer.writeUInt32BE(0x00010000, 0);
  buffer.writeUInt16BE(tables.length, 4);

  let dataOffset = directoryEnd;
  tables.forEach(([tag, length], index) => {
    const record = 12 + index * 16;
    buffer.write(tag, record, 'ascii');
    buffer.writeUInt32BE(dataOffset, record + 8);
    buffer.writeUInt32BE(length, record + 12);
    dataOffset += length;
  });
  return buffer;
}

function validate(buffer: Buffer, fileName: string): { valid: boolean; message?: string } {
  const encoded = buffer.toString('base64');
  const script = `import { validateFontBuffer } from './scripts/generate-content-manifest.mjs';\nconst bytes = Buffer.from('${encoded}', 'base64');\ntry { validateFontBuffer(bytes, ${JSON.stringify(fileName)}); console.log(JSON.stringify({ valid: true })); } catch (error) { console.log(JSON.stringify({ valid: false, message: error.message })); }`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return JSON.parse(output) as { valid: boolean; message?: string };
}

describe('TTF and OTF binary validation', () => {
  it('accepts structurally valid TrueType and OpenType font files', () => {
    expect(validate(makeSfnt('ttf'), 'Example.ttf').valid).toBe(true);
    expect(validate(makeSfnt('otf', 'CFF '), 'Example.otf').valid).toBe(true);
  });

  it('rejects empty files, non-font data and truncated table directories', () => {
    expect(validate(Buffer.alloc(0), 'empty.ttf').message).toContain('empty or truncated');
    expect(validate(Buffer.from('not a font file'), 'invalid.otf').message).toContain('signature');
    const truncated = Buffer.alloc(12);
    truncated.writeUInt32BE(0x00010000, 0);
    truncated.writeUInt16BE(8, 4);
    expect(validate(truncated, 'truncated.ttf').message).toContain('directory is incomplete');
  });

  it('rejects missing required tables and table offsets outside the file', () => {
    const missingCmap = makeSfnt();
    missingCmap.write('xxxx', 12, 'ascii');
    expect(validate(missingCmap, 'missing-cmap.ttf').message).toContain('missing a valid cmap');

    const invalidOffset = makeSfnt();
    invalidOffset.writeUInt32BE(99_999, 12 + 8);
    expect(validate(invalidOffset, 'bad-offset.ttf').message).toContain('invalid offset or length');
  });
});
