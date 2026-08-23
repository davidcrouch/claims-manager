/**
 * Migrate legacy document_template_transforms to `_context` JSONata.
 * Usage: node --env-file=.env ./scripts/migrate-transforms-to-context.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONTEXT_TYPES = [
  'assessment',
  'quote',
  'invoice',
  'job_details',
  'scope_of_work',
  'purchase_order',
  'work_order',
  'claim',
  'report',
  'bill',
  'proposal',
  'rfq',
];

// Mirror apps/api/.../schemas/target/defaults.ts group helpers
const itemJsonata = `{ "name": item_name, "description": item_description, "category": item_category, "quantity": item_quantity, "unit_cost": item_unit_cost, "tax": item_tax, "total": item_total, "note": item_note }`;
const asArray = (field) => `($exists(${field}) ? ${field} : [])`;
const mapArray = (field, mapExpr) => `$append([], ${asArray(field)}.(${mapExpr}))`;
const comboJsonata = `{ "name": combo_name, "description": combo_description, "quantity": combo_quantity, "subtotal": combo_subtotal, "note": combo_note, "items": ${mapArray('items', itemJsonata)} }`;
const scopeJsonata = `{ "name": scope_name, "description": scope_description, "quantity": scope_quantity, "subtotal": scope_subtotal, "note": scope_note, "items": ${mapArray('items', itemJsonata)}, "combos": ${mapArray('combos', comboJsonata)} }`;
const groupJsonataFields =
  `"name": group_name, "note": group_note, "subtotal": group_subtotal, "dimensions": { "length": group_length, "width": group_width, "height": group_height }`;
const groupedItemsJsonataCtx = `$append([], ($exists(_context.groups) ? _context.groups : []).{ ${groupJsonataFields}, "items": ${mapArray('items', itemJsonata)}, "combos": ${mapArray('combos', comboJsonata)}, "scopes": ${mapArray('scopes', scopeJsonata)} })`;

function looksLegacy(rules) {
  if (!rules || typeof rules !== 'string') return true; // force rewrite if empty/broken
  if (rules.includes('${')) return true; // unevaluated template from prior bad migration
  if (rules.includes('_context.') && !rules.includes('${')) return false;
  return (
    /\bcompany_name\b/.test(rules) ||
    /\bquote_number\b/.test(rules) ||
    /\brfq_number\b/.test(rules) ||
    rules.trim() === '$'
  );
}

function loadDefaultsFromSource() {
  const srcPath = path.resolve(
    __dirname,
    '../src/modules/document-generation/schemas/target/defaults.ts',
  );
  const src = fs.readFileSync(srcPath, 'utf8');
  const defaults = {};
  for (const type of CONTEXT_TYPES) {
    const re = new RegExp(
      `${type}:\\s*\\{\\s*jsonataRules:\\s*\`([\\s\\S]*?)\``,
      'm',
    );
    const m = src.match(re);
    if (!m) continue;
    defaults[type] = m[1]
      .replaceAll('${groupedItemsJsonataCtx}', groupedItemsJsonataCtx)
      .replaceAll('${groupedItemsJsonata}', groupedItemsJsonataCtx);
  }
  return defaults;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('migrate-transforms-to-context — DATABASE_URL is required');
    process.exit(1);
  }

  const defaults = loadDefaultsFromSource();
  console.log(
    'migrate-transforms-to-context — loaded defaults for',
    Object.keys(defaults).join(', '),
  );

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const { rows } = await client.query(
    `SELECT id, tenant_id, document_type, jsonata_rules, version
     FROM document_template_transforms
     ORDER BY document_type, tenant_id`,
  );

  let updated = 0;
  for (const row of rows) {
    if (!CONTEXT_TYPES.includes(row.document_type)) continue;
    if (!looksLegacy(row.jsonata_rules)) {
      console.log(
        `migrate-transforms-to-context — skip ${row.document_type} tenant=${row.tenant_id}`,
      );
      continue;
    }
    const rules = defaults[row.document_type];
    if (!rules) {
      console.warn(
        `migrate-transforms-to-context — no default rules for ${row.document_type}`,
      );
      continue;
    }
    if (rules.includes('${')) {
      console.error(
        `migrate-transforms-to-context — still has template interp for ${row.document_type}`,
      );
      process.exit(1);
    }

    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO document_template_transform_versions
           (transform_id, version, jsonata_rules, target_schema, created_by)
         SELECT id, version, jsonata_rules, target_schema, updated_by
         FROM document_template_transforms
         WHERE id = $1`,
        [row.id],
      );
      await client.query(
        `UPDATE document_template_transforms
         SET jsonata_rules = $2,
             test_data = NULL,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, rules],
      );
      await client.query('COMMIT');
      updated += 1;
      console.log(
        `migrate-transforms-to-context — updated ${row.document_type} tenant=${row.tenant_id} v${row.version}->${row.version + 1}`,
      );
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  console.log(
    `migrate-transforms-to-context — done; updated=${updated} scanned=${rows.length}`,
  );
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
