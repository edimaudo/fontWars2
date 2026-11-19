import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function parseWordList(input: string): string[] {
  const encoded = Buffer.from(input, 'utf8').toString('base64');
  const script = `import { parseWordListCsv } from './scripts/generate-content-manifest.mjs';\nconst input = Buffer.from('${encoded}', 'base64').toString('utf8');\nconsole.log(JSON.stringify(parseWordListCsv(input)));`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  return JSON.parse(output) as string[];
}

describe('quoted comma-separated word library', () => {
  it('parses the requested quoted, comma-separated format', () => {
    expect(parseWordList('"aardvark", "aardwolf", "baboon"')).toEqual([
      'aardvark',
      'aardwolf',
      'baboon',
    ]);
  });

  it('supports multiple lines, phrases, and commas inside quoted entries', () => {
    expect(parseWordList('"aardvark", "office affinity",\r\n"Smith, Jones", "minimum"')).toEqual([
      'aardvark',
      'office affinity',
      'Smith, Jones',
      'minimum',
    ]);
  });

  it('supports escaped double quotes and removes case-insensitive duplicates', () => {
    expect(parseWordList('"type ""specimen""", "Aardvark", "aardvark"')).toEqual([
      'type "specimen"',
      'Aardvark',
    ]);
  });

  it('rejects unquoted entries, missing commas, empty entries, and trailing commas', () => {
    for (const invalid of ['aardvark, "aardwolf"', '"aardvark" "aardwolf"', '"aardvark"\n"aardwolf"', '"aardvark", ""', '"aardvark",']) {
      expect(() => parseWordList(invalid)).toThrow();
    }
  });
});
