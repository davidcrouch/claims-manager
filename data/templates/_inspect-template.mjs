import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../apps/api/package.json'),
);
const PizZip = require('pizzip');

const dir = path.dirname(fileURLToPath(import.meta.url));
const names = process.argv.slice(2);

for (const name of names) {
  const p = path.join(dir, name);
  const zip = new PizZip(fs.readFileSync(p));
  const xml = zip.file('word/document.xml').asText();
  const tags = [...new Set([...xml.matchAll(/w:tag w:val="([^"]+)"/g)].map((m) => m[1]))];
  const aliases = [...new Set([...xml.matchAll(/w:alias w:val="([^"]+)"/g)].map((m) => m[1]))];
  const braces = [...new Set([...xml.matchAll(/\{[#\/]?[a-zA-Z0-9_.]+\}/g)].map((m) => m[0]))];
  const dbl = [
    ...new Set(
      [...xml.matchAll(/&lt;&lt;[^&]+&gt;&gt;/g)].map((m) =>
        m[0].replaceAll('&lt;', '<').replaceAll('&gt;', '>'),
      ),
    ),
  ];
  console.log(`=== ${name} ===`);
  console.log('SDT tags:\n', tags.join('\n '));
  console.log('aliases:\n', aliases.join('\n '));
  console.log('brace tags:', braces.join(', ') || '(none)');
  console.log('<< tags:', dbl.join(', ') || '(none)');
  console.log('');
}
