import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseWordListCsv(input) {
  const text = input.replace(/^\uFEFF/, '');
  const entries = [];
  let index = 0;

  const skipWhitespace = () => {
    while (index < text.length && /\s/.test(text[index])) index += 1;
  };

  skipWhitespace();
  while (index < text.length) {
    if (text[index] !== '"') {
      throw new Error(`Expected a double-quoted word entry at character ${index + 1}.`);
    }
    index += 1;
    let value = '';
    let closed = false;

    while (index < text.length) {
      const character = text[index];
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 2;
          continue;
        }
        index += 1;
        closed = true;
        break;
      }
      if (character === '\\' && text[index + 1] === '"') {
        value += '"';
        index += 2;
        continue;
      }
      value += character;
      index += 1;
    }

    if (!closed) throw new Error(`Unterminated quoted word entry starting before character ${index + 1}.`);
    const word = value.trim();
    if (!word) throw new Error('Word library entries cannot be empty.');
    entries.push(word);

    skipWhitespace();
    if (index >= text.length) break;
    if (text[index] !== ',') {
      throw new Error(`Expected a comma after the quoted entry at character ${index + 1}.`);
    }
    index += 1;
    skipWhitespace();
    if (index >= text.length) throw new Error('Word library cannot end with a trailing comma.');
  }

  const uniqueEntries = [];
  const seen = new Set();
  for (const word of entries) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueEntries.push(word);
  }
  return uniqueEntries;
}


/** Validate the SFNT directory before accepting a file as a playable typeface. */
export function validateFontBuffer(buffer, fileName) {
  if (!buffer || typeof buffer.length !== 'number' || buffer.length < 12) {
    throw new Error(`Font file is empty or truncated: ${fileName}`);
  }

  const signature = buffer.toString('latin1', 0, 4);
  if (!['\u0000\u0001\u0000\u0000', 'OTTO', 'true', 'typ1'].includes(signature)) {
    throw new Error(`Font file does not have a valid TrueType/OpenType signature: ${fileName}`);
  }

  const tableCount = buffer.readUInt16BE(4);
  const directoryEnd = 12 + tableCount * 16;
  if (tableCount < 4 || directoryEnd > buffer.length) {
    throw new Error(`Font table directory is incomplete: ${fileName}`);
  }

  const tables = new Map();
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    const tag = buffer.toString('ascii', record, record + 4);
    const offset = buffer.readUInt32BE(record + 8);
    const length = buffer.readUInt32BE(record + 12);
    if (!tag.trim() || length === 0 || offset < directoryEnd || offset + length > buffer.length) {
      throw new Error(`Font table "${tag}" has an invalid offset or length: ${fileName}`);
    }
    if (tables.has(tag)) throw new Error(`Font contains a duplicate "${tag}" table: ${fileName}`);
    tables.set(tag, { offset, length });
  }

  for (const [tag, minimumLength] of [['cmap', 4], ['head', 54], ['maxp', 6], ['name', 6]]) {
    const table = tables.get(tag);
    if (!table || table.length < minimumLength) {
      throw new Error(`Font is missing a valid ${tag} table: ${fileName}`);
    }
  }

  if (!tables.has('glyf') && !tables.has('CFF ') && !tables.has('CFF2')) {
    throw new Error(`Font has no supported glyph outline table: ${fileName}`);
  }

  return true;
}

async function generateContent() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const fontsDir = path.join(root, 'public', 'fonts');
  const wordsFile = path.join(root, 'assets', 'word_library', 'words.txt');
  const generatedFile = path.join(root, 'src', 'server', 'generated-content.ts');
  const previewContentFile = path.join(root, 'public', 'preview-content.json');
  const strict = process.argv.includes('--strict');

  function toFontId(name) {
    return `font_${createHash('sha256').update(name.normalize('NFKC')).digest('hex').slice(0, 12)}`;
  }

  const directoryEntries = await readdir(fontsDir, { withFileTypes: true });
  const fontFiles = directoryEntries.filter((entry) => entry.isFile() && /\.(ttf|otf)$/i.test(entry.name));
  const fontsWithDigests = await Promise.all(fontFiles.map(async (entry) => {
    const file = entry.name;
    const extension = path.extname(file).toLowerCase();
    const name = path.basename(file, path.extname(file)).trim();
    if (!name || name.startsWith('.')) throw new Error(`Font file has no usable typeface name: ${file}`);
    const id = toFontId(name);
    if (!id) throw new Error(`Font filename cannot be converted to an ID: ${file}`);
    const bytes = await readFile(path.join(fontsDir, file));
    validateFontBuffer(bytes, file);
    return {
      id,
      name,
      file,
      format: extension === '.ttf' ? 'truetype' : 'opentype',
      digest: createHash('sha256').update(bytes).digest('hex'),
    };
  }));
  const fonts = fontsWithDigests
    .map(({ digest: _digest, ...font }) => font)
    .sort((a, b) => a.name.localeCompare(b.name));

  const seenNames = new Map();
  const seenDigests = new Map();
  for (const font of fontsWithDigests) {
    const key = font.name.normalize('NFKC').toLowerCase();
    const priorName = seenNames.get(key);
    if (priorName) {
      throw new Error(`Duplicate typeface names detected: "${priorName}" and "${font.file}". Keep one file per typeface name.`);
    }
    seenNames.set(key, font.file);
    const priorDigest = seenDigests.get(font.digest);
    if (priorDigest) {
      throw new Error(`Identical font binaries detected: "${priorDigest}" and "${font.file}". Remove the duplicate file.`);
    }
    seenDigests.set(font.digest, font.file);
  }

  let rawWords = '';
  try {
    rawWords = await readFile(wordsFile, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const words = parseWordListCsv(rawWords);

  for (const [index, word] of words.entries()) {
    if (word.length > 80) {
      throw new Error(`Word library entry ${index + 1} exceeds 80 characters.`);
    }
  }

  if (strict) {
    if (fonts.length < 4) {
      throw new Error(`fontWars needs at least 4 font files in public/fonts/. Found ${fonts.length}. Add .ttf or .otf files before building.`);
    }
    if (words.length < 5) {
      throw new Error(`fontWars needs at least 5 words or phrases in assets/word_library/words.txt. Found ${words.length}. Add comma-separated, double-quoted entries before building.`);
    }
  }

  const source = `// Generated from public/fonts/*.{ttf,otf} and assets/word_library/words.txt.\n// Regenerate with npm run content:generate; do not edit this file by hand.\nexport interface DiscoveredFontAsset {\n  id: string;\n  name: string;\n  file: string;\n  format: 'truetype' | 'opentype';\n}\n\nexport const discoveredFonts: DiscoveredFontAsset[] = ${JSON.stringify(fonts, null, 2)};\n\nexport const specimenWords: string[] = ${JSON.stringify(words, null, 2)};\n`;
  await writeFile(generatedFile, source, 'utf8');
  await writeFile(previewContentFile, `${JSON.stringify({ fonts, words }, null, 2)}\n`, 'utf8');

  console.log(`Discovered ${fonts.length} font file(s) and ${words.length} specimen word(s).`);
  if (!strict && (fonts.length < 4 || words.length < 5)) {
    console.warn('The project is not ready to playtest yet. Add at least 4 fonts and 5 specimen entries.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateContent();
}
