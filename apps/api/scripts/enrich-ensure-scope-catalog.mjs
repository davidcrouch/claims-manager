/**
 * Enrich an IAG / Crunchwork Catalog Items xlsx that has an
 * "Ensure Scope Line Item" column:
 *  - add Kind + Parent columns
 *  - for each unique Ensure value, emit a related scope row (name/description = Ensure text)
 *  - set each matching item's Parent to that scope's ID
 *
 * Usage:
 *   node apps/api/scripts/enrich-ensure-scope-catalog.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

function loadXlsx() {
  const candidates = [
    path.join(process.env.TEMP || '/tmp', 'package'),
    path.join(repoRoot, 'node_modules/xlsx'),
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try next */
    }
  }
  throw new Error(
    'xlsx package not found. Run: npm pack xlsx && tar -xzf xlsx-*.tgz in %TEMP%',
  );
}

const XLSX = loadXlsx();

const INPUT = path.join(
  repoRoot,
  'data/catalogues/IAG Catalog ItemsExport -2026-04-35 with ENSURE SCOPE ITEMS.xlsx',
);
const OUTPUT_XLSX = INPUT;
const OUTPUT_CSV = path.join(
  repoRoot,
  'data/catalogues/IAG Catalog ItemsExport -2026-04-35 with ENSURE SCOPE ITEMS.import.csv',
);

const ENSURE_HEADER = 'Ensure Scope Line Item';

function scopeIdFor(ensureText) {
  const h = crypto
    .createHash('md5')
    .update(`ensure-scope:${ensureText.trim().toLowerCase()}`)
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function findEnsureSheet(wb) {
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const header = (rows[0] || []).map(String);
    if (header.some((h) => h.trim().toLowerCase() === ENSURE_HEADER.toLowerCase())) {
      return { name, rows, header };
    }
  }
  throw new Error(`No sheet with column "${ENSURE_HEADER}" found`);
}

function rowToObject(header, row) {
  /** @type {Record<string, unknown>} */
  const obj = {};
  for (let i = 0; i < header.length; i++) {
    obj[header[i]] = row[i] ?? '';
  }
  return obj;
}

function objectToRow(outHeader, obj) {
  return outHeader.map((h) => (obj[h] == null ? '' : obj[h]));
}

function main() {
  const wb = XLSX.readFile(INPUT);
  const { name: sheetName, rows, header } = findEnsureSheet(wb);

  const required = ['ID', 'Name', 'Type'];
  for (const col of required) {
    if (!header.some((h) => h.trim().toLowerCase() === col.toLowerCase())) {
      throw new Error(`Sheet missing required column: ${col}`);
    }
  }

  // Build output header: insert Kind + Parent after Description (or Name)
  const descPos = header.findIndex((h) => h.trim().toLowerCase() === 'description');
  const namePos = header.findIndex((h) => h.trim().toLowerCase() === 'name');
  const insertAt = descPos >= 0 ? descPos + 1 : namePos + 1;
  const outHeader = [...header.slice(0, insertAt), 'Kind', 'Parent', ...header.slice(insertAt)];

  /** @type {Map<string, { id: string, obj: Record<string, unknown> }>} */
  const scopesByEnsure = new Map();
  /** @type {Record<string, unknown>[]} */
  const primitiveObjs = [];

  for (const raw of rows.slice(1)) {
    if (!raw.some((c) => String(c).trim() !== '')) continue;
    const obj = rowToObject(header, raw);
    const ensure = String(obj[ENSURE_HEADER] ?? '').trim();

    obj.Kind = 'primitive';
    obj.Parent = '';

    if (ensure) {
      const key = ensure.toLowerCase();
      let scope = scopesByEnsure.get(key);
      if (!scope) {
        const scopeId = scopeIdFor(ensure);
        /** @type {Record<string, unknown>} */
        const scopeObj = {};
        for (const h of outHeader) scopeObj[h] = '';
        scopeObj.ID = scopeId;
        scopeObj.Name = ensure;
        scopeObj.Description = ensure;
        scopeObj.Kind = 'scope';
        scopeObj.Parent = '';
        scopeObj.Type = 'Other';
        scopeObj.Category = obj.Category ?? '';
        scopeObj['Markup Type'] = 'Percentage';
        scopeObj.Markup = 19;
        scopeObj['Tax %'] = 10;
        scopeObj.Enabled = true;
        scopeObj.Archived = false;
        scopeObj[ENSURE_HEADER] = ensure;
        scope = { id: scopeId, obj: scopeObj };
        scopesByEnsure.set(key, scope);
      }
      obj.Parent = scope.id;
    }

    primitiveObjs.push(obj);
  }

  const outRows = [
    outHeader,
    ...[...scopesByEnsure.values()].map((s) => objectToRow(outHeader, s.obj)),
    ...primitiveObjs.map((o) => objectToRow(outHeader, o)),
  ];

  const outWb = XLSX.utils.book_new();
  const outSheet = XLSX.utils.aoa_to_sheet(outRows);
  XLSX.utils.book_append_sheet(outWb, outSheet, 'CatalogItems-EnsureScopes');
  XLSX.writeFile(outWb, OUTPUT_XLSX);

  fs.writeFileSync(OUTPUT_CSV, XLSX.utils.sheet_to_csv(outSheet), 'utf8');

  console.log(
    `enrich-ensure-scope-catalog — sheet=${sheetName} scopes=${scopesByEnsure.size} primitives=${primitiveObjs.length}`,
  );
  console.log(`enrich-ensure-scope-catalog — wrote ${OUTPUT_XLSX}`);
  console.log(`enrich-ensure-scope-catalog — wrote ${OUTPUT_CSV}`);
}

main();
