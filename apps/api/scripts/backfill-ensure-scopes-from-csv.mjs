/**
 * Backfill Ensure Catalogue from the version-1 IAG CSV mappings:
 *  - create missing Ensure scope items (label = "Ensure Scope Line Item")
 *  - copy missing Crunchwork primitives into Ensure Catalogue
 *  - link each primitive under its Ensure scope via catalog_assembly_components
 *
 * Also regenerates seed/import CSVs used by iag-catalog seed.
 *
 * Usage:
 *   node apps/api/scripts/backfill-ensure-scopes-from-csv.mjs
 *   node apps/api/scripts/backfill-ensure-scopes-from-csv.mjs --dry-run
 */
import crypto from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const LOG = 'backfill-ensure-scopes-from-csv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const envPath = path.resolve(__dirname, '../.env');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^DATABASE_URL=(.*)$/);
  if (m) {
    process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
    break;
  }
}

const DRY_RUN = process.argv.includes('--dry-run');
const SOURCE_CSV = path.join(
  repoRoot,
  'data/catalogues/IAG Catalog ItemsExport -2026-04-35 with ENSURE SCOPE ITEMS (version 1).csv',
);
const OUT_IMPORT_CSV = path.join(
  repoRoot,
  'data/catalogues/IAG Catalog ItemsExport -2026-04-35 with ENSURE SCOPE ITEMS.import.csv',
);
const OUT_STABLE_CSV = path.join(repoRoot, 'data/catalogues/iag-ensure-scopes.import.csv');

const ENSURE_CATALOG_NAME = 'Ensure Catalogue';
const CW_CATALOG_NAME = 'Crunchwork 2026-04-35';
const ENSURE_HEADER = 'Ensure Scope Line Item';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
      continue;
    }
    if (c === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(filePath) {
  const text = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    /** @type {Record<string, string>} */
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = (cells[i] ?? '').trim();
    return obj;
  });
  return { header, rows };
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function scopeIdFor(ensureText) {
  const h = crypto
    .createHash('md5')
    .update(`ensure-scope:${ensureText.trim().toLowerCase()}`)
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function slugCode(name) {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'SCOPE'
  );
}

async function uniqueCode(client, { tenantId, catalogId, base }) {
  let candidate = base;
  let n = 2;
  for (;;) {
    const hit = await client.query(
      `SELECT 1 FROM catalog_items
       WHERE tenant_id = $1::uuid AND catalog_id = $2::uuid
         AND lower(code) = lower($3) AND deleted_at IS NULL
       LIMIT 1`,
      [tenantId, catalogId, candidate],
    );
    if (hit.rowCount === 0) return candidate;
    candidate = `${base.slice(0, 70)}-${n++}`;
  }
}

function writeImportCsv(mappings) {
  const outHeader = [
    'ID',
    'Name',
    'Description',
    'Kind',
    'Parent',
    ENSURE_HEADER,
    'Type',
    'Category',
    'Subcategory',
    'Markup Type',
    'Unit',
    'Tax %',
    'Markup',
    'Buy Cost',
    'Unit Cost',
    'Enabled',
    'Archived',
  ];

  /** @type {Map<string, { id: string, label: string, category: string }>} */
  const scopes = new Map();
  const primitiveRows = [];

  for (const m of mappings) {
    const key = m.scopeLabel.toLowerCase();
    if (!scopes.has(key)) {
      scopes.set(key, {
        id: scopeIdFor(m.scopeLabel),
        label: m.scopeLabel,
        category: m.category || '',
      });
    }
    const scope = scopes.get(key);
    primitiveRows.push({
      ID: m.cwExternalRef,
      Name: m.cwName,
      Description: m.cwDescription || '',
      Kind: 'primitive',
      Parent: scope.id,
      [ENSURE_HEADER]: m.scopeLabel,
      Type: m.type || 'Other',
      Category: m.category || '',
      Subcategory: m.subcategory || '',
      'Markup Type': m.markupType || 'Percentage',
      Unit: m.unit || 'EA',
      'Tax %': m.tax || '10',
      Markup: m.markup || '19',
      'Buy Cost': m.buyCost || '',
      'Unit Cost': m.unitCost || '',
      Enabled: 'TRUE',
      Archived: 'FALSE',
    });
  }

  const scopeRows = [...scopes.values()].map((s) => ({
    ID: s.id,
    Name: s.label,
    Description: s.label,
    Kind: 'scope',
    Parent: '',
    [ENSURE_HEADER]: s.label,
    Type: 'Other',
    Category: s.category,
    Subcategory: '',
    'Markup Type': 'Percentage',
    Unit: '',
    'Tax %': '10',
    Markup: '19',
    'Buy Cost': '',
    'Unit Cost': '',
    Enabled: 'TRUE',
    Archived: 'FALSE',
  }));

  const lines = [
    outHeader.join(','),
    ...scopeRows.map((r) => outHeader.map((h) => csvEscape(r[h])).join(',')),
    ...primitiveRows.map((r) => outHeader.map((h) => csvEscape(r[h])).join(',')),
  ];
  const body = `${lines.join('\n')}\n`;
  writeFileSync(OUT_IMPORT_CSV, body, 'utf8');
  writeFileSync(OUT_STABLE_CSV, body, 'utf8');
  console.log(
    `[${LOG}] wrote import CSV scopes=${scopeRows.length} primitives=${primitiveRows.length}`,
  );
  console.log(`[${LOG}]   ${OUT_IMPORT_CSV}`);
  console.log(`[${LOG}]   ${OUT_STABLE_CSV}`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const { rows: csvRows } = parseCsv(SOURCE_CSV);
  const withScope = csvRows.filter((r) => String(r[ENSURE_HEADER] || '').trim());
  console.log(
    `[${LOG}] source=${path.basename(SOURCE_CSV)} rows=${csvRows.length} withScope=${withScope.length} dryRun=${DRY_RUN}`,
  );

  /** @type {Array<Record<string, string>>} */
  const mappings = withScope.map((r) => ({
    scopeLabel: String(r[ENSURE_HEADER]).trim(),
    cwExternalRef: String(r.ID || '').trim(),
    cwName: String(r.Name || '').trim(),
    cwDescription: String(r.Description || '').trim(),
    type: String(r.Type || '').trim(),
    category: String(r.Category || '').trim(),
    subcategory: String(r.Subcategory || '').trim(),
    unit: String(r.Unit || '').trim(),
    markupType: String(r['Markup Type'] || '').trim(),
    tax: String(r['Tax %'] || '').trim(),
    markup: String(r.Markup || '').trim(),
    buyCost: String(r['Buy Cost'] || '').trim(),
    unitCost: String(r['Unit Cost'] || '').trim(),
  }));

  writeImportCsv(mappings);

  const client = await pool.connect();
  try {
    const ensureCat = (
      await client.query(
        `SELECT id::text, tenant_id::text, name FROM catalogs
         WHERE lower(name) IN ('ensure', 'ensure catalogue')
         ORDER BY CASE WHEN lower(name) = 'ensure catalogue' THEN 0 ELSE 1 END
         LIMIT 1`,
      )
    ).rows[0];
    const cwCat = (
      await client.query(
        `SELECT id::text, tenant_id::text, name FROM catalogs
         WHERE name = $1 LIMIT 1`,
        [CW_CATALOG_NAME],
      )
    ).rows[0];

    if (!ensureCat || !cwCat) {
      throw new Error(
        `[${LOG}] missing catalogues ensure=${!!ensureCat} crunchwork=${!!cwCat}`,
      );
    }
    if (ensureCat.tenant_id !== cwCat.tenant_id) {
      throw new Error(`[${LOG}] catalogue tenant mismatch`);
    }

    const tenantId = ensureCat.tenant_id;
    console.log(
      `[${LOG}] ensure=${ensureCat.name} (${ensureCat.id}) cw=${cwCat.name} (${cwCat.id}) tenant=${tenantId}`,
    );

    const otherType = (
      await client.query(
        `SELECT id::text FROM catalog_item_types
         WHERE tenant_id = $1::uuid AND code = 'other' LIMIT 1`,
        [tenantId],
      )
    ).rows[0];
    if (!otherType) throw new Error(`[${LOG}] missing catalog item type 'other'`);

    const ensureScopes = (
      await client.query(
        `SELECT id::text, code, name, external_reference,
                (SELECT count(*)::int FROM catalog_assembly_components c WHERE c.assembly_id = i.id) AS child_count
         FROM catalog_items i
         WHERE catalog_id = $1::uuid AND kind = 'scope' AND deleted_at IS NULL`,
        [ensureCat.id],
      )
    ).rows;

    /** @type {Map<string, typeof ensureScopes[0]>} */
    const scopeByName = new Map();
    for (const s of ensureScopes) {
      const key = String(s.name).trim().toLowerCase();
      const prev = scopeByName.get(key);
      if (!prev || Number(s.child_count) > Number(prev.child_count)) {
        scopeByName.set(key, s);
      }
    }

    const ensurePrims = (
      await client.query(
        `SELECT id::text, code, name, external_reference, source_item_id::text
         FROM catalog_items
         WHERE catalog_id = $1::uuid AND kind = 'primitive' AND deleted_at IS NULL`,
        [ensureCat.id],
      )
    ).rows;
    /** @type {Map<string, typeof ensurePrims[0]>} */
    const ensurePrimByExt = new Map();
    /** @type {Map<string, typeof ensurePrims[0]>} */
    const ensurePrimBySource = new Map();
    for (const p of ensurePrims) {
      if (p.external_reference) ensurePrimByExt.set(String(p.external_reference).toLowerCase(), p);
      if (p.source_item_id) ensurePrimBySource.set(String(p.source_item_id).toLowerCase(), p);
    }

    const cwItems = (
      await client.query(
        `SELECT id::text, code, name, description, kind, type_id::text, category_id::text,
                sub_category_id::text, unit_type_lookup_id::text, unit_cost, buy_cost,
                markup_type, markup_value, tax_rate, pricing_mode, fixed_unit_cost,
                computed_unit_cost, external_reference, provider_codes, metadata,
                effective_from, effective_to
         FROM catalog_items
         WHERE catalog_id = $1::uuid AND deleted_at IS NULL AND kind = 'primitive'`,
        [cwCat.id],
      )
    ).rows;
    /** @type {Map<string, typeof cwItems[0]>} */
    const cwByExt = new Map();
    for (const item of cwItems) {
      if (item.external_reference) cwByExt.set(String(item.external_reference).toLowerCase(), item);
      cwByExt.set(String(item.id).toLowerCase(), item);
    }

    const existingBom = (
      await client.query(
        `SELECT assembly_id::text, component_id::text
         FROM catalog_assembly_components cac
         JOIN catalog_items parent ON parent.id = cac.assembly_id
         WHERE parent.catalog_id = $1::uuid`,
        [ensureCat.id],
      )
    ).rows;
    const bomKeys = new Set(existingBom.map((b) => `${b.assembly_id}|${b.component_id}`));

    let createdScopes = 0;
    let createdPrims = 0;
    let createdLinks = 0;
    let alreadyOk = 0;
    let missingCw = 0;
    const errors = [];
    /** @type {Set<string>} */
    const newScopeIds = new Set();
    /** @type {Set<string>} */
    const newPrimIds = new Set();

    if (!DRY_RUN) await client.query('BEGIN');

    for (const m of mappings) {
      const scopeKey = m.scopeLabel.toLowerCase();
      let scope = scopeByName.get(scopeKey);

      if (!scope) {
        const detId = scopeIdFor(m.scopeLabel);
        const code = await uniqueCode(client, {
          tenantId,
          catalogId: ensureCat.id,
          base: slugCode(m.scopeLabel),
        });
        if (DRY_RUN) {
          scope = {
            id: detId,
            code,
            name: m.scopeLabel,
            external_reference: detId,
            child_count: 0,
          };
          scopeByName.set(scopeKey, scope);
          newScopeIds.add(scope.id);
          createdScopes++;
        } else {
          const inserted = await client.query(
            `INSERT INTO catalog_items (
               id, tenant_id, catalog_id, code, name, description, kind, type_id,
               pricing_mode, markup_type, markup_value, tax_rate, external_reference,
               provider_codes, is_active, metadata
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid, $4, $5, $5, 'scope', $6::uuid,
               'computed', 'percent', 0.19, 0.10, $7,
               ARRAY['internal']::text[], true, '{}'::jsonb
             )
             RETURNING id::text, code, name, external_reference`,
            [randomUUID(), tenantId, ensureCat.id, code, m.scopeLabel, otherType.id, detId],
          );
          scope = { ...inserted.rows[0], child_count: 0 };
          scopeByName.set(scopeKey, scope);
          newScopeIds.add(scope.id);
          createdScopes++;
        }
      }

      const cw = cwByExt.get(m.cwExternalRef.toLowerCase());
      if (!cw) {
        missingCw++;
        errors.push({ type: 'missing_cw', scope: m.scopeLabel, id: m.cwExternalRef, name: m.cwName });
        continue;
      }

      let ensurePrim =
        ensurePrimBySource.get(cw.id.toLowerCase()) ||
        ensurePrimByExt.get(String(cw.external_reference || m.cwExternalRef).toLowerCase());

      if (!ensurePrim) {
        if (DRY_RUN) {
          ensurePrim = {
            id: `dry-${cw.id}`,
            code: cw.code,
            name: cw.name,
            external_reference: cw.external_reference,
            source_item_id: cw.id,
          };
          newPrimIds.add(ensurePrim.id);
          createdPrims++;
        } else {
          const code = await uniqueCode(client, {
            tenantId,
            catalogId: ensureCat.id,
            base: cw.code || slugCode(cw.name),
          });
          const inserted = await client.query(
            `INSERT INTO catalog_items (
               tenant_id, catalog_id, code, name, description, kind, type_id,
               category_id, sub_category_id, unit_type_lookup_id,
               unit_cost, buy_cost, markup_type, markup_value, tax_rate,
               pricing_mode, fixed_unit_cost, computed_unit_cost,
               external_reference, provider_codes, source_item_id,
               effective_from, effective_to, is_active, metadata
             ) VALUES (
               $1::uuid, $2::uuid, $3, $4, $5, 'primitive', $6::uuid,
               $7::uuid, $8::uuid, $9::uuid,
               $10, $11, $12, $13, $14,
               $15, $16, $17,
               $18, ARRAY['crunchwork']::text[], $19::uuid,
               $20, $21, true, COALESCE($22::jsonb, '{}'::jsonb)
             )
             RETURNING id::text, code, name, external_reference, source_item_id::text`,
            [
              tenantId,
              ensureCat.id,
              code,
              cw.name,
              cw.description,
              cw.type_id,
              cw.category_id,
              cw.sub_category_id,
              cw.unit_type_lookup_id,
              cw.unit_cost,
              cw.buy_cost,
              cw.markup_type,
              cw.markup_value,
              cw.tax_rate,
              cw.pricing_mode,
              cw.fixed_unit_cost,
              cw.computed_unit_cost,
              cw.external_reference || m.cwExternalRef,
              cw.id,
              cw.effective_from,
              cw.effective_to,
              JSON.stringify(cw.metadata || {}),
            ],
          );
          ensurePrim = inserted.rows[0];
          ensurePrimByExt.set(String(ensurePrim.external_reference || '').toLowerCase(), ensurePrim);
          ensurePrimBySource.set(cw.id.toLowerCase(), ensurePrim);
          newPrimIds.add(ensurePrim.id);
          createdPrims++;
        }
      }

      // Link under every Ensure scope with this label (handles historical duplicates).
      const scopesForLabel = (
        await client.query(
          `SELECT id::text FROM catalog_items
           WHERE catalog_id = $1::uuid AND kind = 'scope' AND deleted_at IS NULL
             AND lower(name) = lower($2)`,
          [ensureCat.id, m.scopeLabel],
        )
      ).rows;
      if (scopesForLabel.length === 0 && scope) scopesForLabel.push({ id: scope.id });

      for (const scopeRow of scopesForLabel) {
        const scopeId = scopeRow.id;
        const bomKey = `${scopeId}|${ensurePrim.id}`;
        if (bomKeys.has(bomKey)) {
          alreadyOk++;
          continue;
        }

        const canQueryBom = !newScopeIds.has(scopeId) && !newPrimIds.has(ensurePrim.id);

        if (canQueryBom) {
          const alreadyLinked = (
            await client.query(
              `SELECT child.id::text
               FROM catalog_assembly_components cac
               JOIN catalog_items child ON child.id = cac.component_id
               WHERE cac.assembly_id = $1::uuid
                 AND child.deleted_at IS NULL
                 AND (
                   lower(coalesce(child.external_reference, '')) = lower($2)
                   OR child.source_item_id = $3::uuid
                   OR child.id = $4::uuid
                 )
               LIMIT 1`,
              [scopeId, m.cwExternalRef, cw.id, ensurePrim.id],
            )
          ).rows[0];

          if (alreadyLinked) {
            bomKeys.add(`${scopeId}|${alreadyLinked.id}`);
            alreadyOk++;
            continue;
          }
        }

        if (DRY_RUN) {
          createdLinks++;
          bomKeys.add(bomKey);
        } else {
          const sort = (
            await client.query(
              `SELECT coalesce(max(sort_index), -1)::int + 1 AS next
               FROM catalog_assembly_components WHERE assembly_id = $1::uuid`,
              [scopeId],
            )
          ).rows[0].next;
          await client.query(
            `INSERT INTO catalog_assembly_components (
               tenant_id, assembly_id, component_id, quantity, waste_factor, sort_index, is_optional
             ) VALUES ($1::uuid, $2::uuid, $3::uuid, 1, 1, $4, false)`,
            [tenantId, scopeId, ensurePrim.id, sort],
          );
          bomKeys.add(bomKey);
          createdLinks++;
        }
      }
    }

    if (!DRY_RUN) await client.query('COMMIT');

    console.log(
      `[${LOG}] done createdScopes=${createdScopes} createdPrims=${createdPrims} createdLinks=${createdLinks} alreadyOk=${alreadyOk} missingCw=${missingCw}`,
    );
    if (errors.length) {
      console.log(`[${LOG}] errors (${errors.length})`, errors.slice(0, 20));
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
