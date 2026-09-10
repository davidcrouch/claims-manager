/**
 * Assign default statuses to rows with a null (or blank) status.
 *
 * Lookup defaults:
 *   purchase_orders → Active
 *   quotes          → Draft
 *   work_orders     → Draft
 *   invoices        → Draft
 *   rfqs            → Draft
 *   jobs            → Pending
 *   bills           → Received
 *
 * Text status:
 *   assessments     → draft
 *
 * Usage (from repo root or apps/api):
 *   node apps/api/scripts/backfill-null-default-status.mjs [--dry-run]
 *
 * Reads DATABASE_URL / DB_* from apps/api/.env (same as drizzle).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(API_ROOT, '../..');
const pgCandidates = [
  join(API_ROOT, 'package.json'),
  join(process.cwd(), 'package.json'),
  join(process.cwd(), 'apps/api/package.json'),
];
let pg;
for (const pkg of pgCandidates) {
  if (!existsSync(pkg)) continue;
  try {
    pg = createRequire(pkg)('pg');
    break;
  } catch {
    continue;
  }
}
if (!pg) {
  throw new Error(`${LOG}: cannot resolve pg from ${pgCandidates.join(', ')}`);
}

const dryRun = process.argv.includes('--dry-run');
const LOG = 'backfill-null-default-status';

const LOOKUP_TARGETS = [
  {
    label: 'purchase_orders',
    table: 'purchase_orders',
    domain: 'purchase_order_status',
    name: 'Active',
    ref: 'seed-po-status-active',
    deletedSql: 'deleted_at IS NULL',
  },
  {
    label: 'quotes',
    table: 'quotes',
    domain: 'quote_status',
    name: 'Draft',
    ref: 'seed-quote-status-draft',
    deletedSql: 'deleted_at IS NULL',
  },
  {
    label: 'work_orders',
    table: 'work_orders',
    domain: 'work_order_status',
    name: 'Draft',
    ref: 'seed-wo-status-draft',
    deletedSql: 'deleted_at IS NULL',
  },
  {
    label: 'invoices',
    table: 'invoices',
    domain: 'invoice_status',
    name: 'Draft',
    ref: 'seed-invoice-status-draft',
    deletedSql: 'is_deleted = false',
  },
  {
    label: 'rfqs',
    table: 'rfqs',
    domain: 'rfq_status',
    name: 'Draft',
    ref: 'seed-rfq-status-draft',
    deletedSql: 'deleted_at IS NULL',
  },
  {
    label: 'jobs',
    table: 'jobs',
    domain: 'job_status',
    name: 'Pending',
    ref: 'seed-job-status-pending',
    deletedSql: 'deleted_at IS NULL',
  },
  {
    label: 'bills',
    table: 'bills',
    domain: 'bill_status',
    name: 'Received',
    ref: 'seed-bill-status-received',
    deletedSql: 'is_deleted = false',
  },
];

function loadEnvFile(filePath, into) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (into[key] === undefined) into[key] = val;
  }
}

function resolveDatabaseUrl() {
  const env = { ...process.env };
  const fileEnv = {};
  loadEnvFile(join(API_ROOT, '.env'), fileEnv);
  loadEnvFile(join(REPO_ROOT, '.env'), fileEnv);
  for (const [k, v] of Object.entries(fileEnv)) {
    if (env[k] === undefined) env[k] = v;
  }
  if (env.DATABASE_URL?.trim()) return env.DATABASE_URL.trim();
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = env;
  if (DB_HOST && DB_PORT && DB_NAME && DB_USER !== undefined && DB_PASSWORD !== undefined) {
    return `postgresql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
  return null;
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '[unparseable]';
  }
}

async function ensureLookup(client, params) {
  const existing = await client.query(
    `SELECT id FROM lookup_values
     WHERE tenant_id = $1 AND domain = $2 AND lower(name) = lower($3)
     ORDER BY created_at ASC NULLS LAST, id ASC
     LIMIT 1`,
    [params.tenantId, params.domain, params.name],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  if (dryRun) {
    console.log(
      `[${LOG}] dry-run: would create ${params.domain}/${params.name} tenant=${params.tenantId}`,
    );
    return null;
  }

  const inserted = await client.query(
    `INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [params.tenantId, params.domain, params.name, params.ref],
  );
  console.log(
    `[${LOG}] created ${params.domain}/${params.name} id=${inserted.rows[0].id} tenant=${params.tenantId}`,
  );
  return inserted.rows[0].id;
}

async function backfillLookupTable(client, target) {
  const { rows } = await client.query(
    `SELECT id, tenant_id FROM ${target.table}
     WHERE status_lookup_id IS NULL AND ${target.deletedSql}`,
  );
  console.log(`[${LOG}] ${target.label}: ${rows.length} row(s) with null status`);

  const lookupByTenant = new Map();
  let updated = 0;
  for (const row of rows) {
    let lookupId = lookupByTenant.get(row.tenant_id);
    if (lookupId === undefined) {
      lookupId = await ensureLookup(client, {
        tenantId: row.tenant_id,
        domain: target.domain,
        name: target.name,
        ref: target.ref,
      });
      lookupByTenant.set(row.tenant_id, lookupId);
    }
    if (!lookupId) {
      updated += 1;
      continue;
    }
    if (!dryRun) {
      await client.query(
        `UPDATE ${target.table}
         SET status_lookup_id = $1, updated_at = NOW()
         WHERE id = $2 AND status_lookup_id IS NULL`,
        [lookupId, row.id],
      );
    }
    updated += 1;
  }
  return { found: rows.length, updated };
}

async function backfillAssessments(client) {
  const { rows } = await client.query(
    `SELECT id, tenant_id, status FROM assessments
     WHERE deleted_at IS NULL
       AND (status IS NULL OR btrim(status) = '')`,
  );
  console.log(`[${LOG}] assessments: ${rows.length} row(s) with null/blank status`);
  if (rows.length === 0) return { found: 0, updated: 0 };
  if (dryRun) return { found: rows.length, updated: rows.length };
  const result = await client.query(
    `UPDATE assessments
     SET status = 'draft', updated_at = NOW()
     WHERE deleted_at IS NULL
       AND (status IS NULL OR btrim(status) = '')`,
  );
  return { found: rows.length, updated: result.rowCount ?? 0 };
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(`[${LOG}] DATABASE_URL or DB_* is required`);
    process.exit(1);
  }

  console.log(`[${LOG}] ${dryRun ? 'dry-run' : 'apply'} ${redactUrl(databaseUrl)}`);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const who = await client.query(
      'SELECT current_database() AS db, current_user AS user',
    );
    console.log(`[${LOG}] connected db=${who.rows[0].db} user=${who.rows[0].user}`);

    const summary = [];
    for (const target of LOOKUP_TARGETS) {
      summary.push({ entity: target.label, ...(await backfillLookupTable(client, target)) });
    }
    summary.push({ entity: 'assessments', ...(await backfillAssessments(client)) });

    console.log(`[${LOG}] ${dryRun ? 'would update' : 'updated'}:`);
    for (const row of summary) {
      console.log(`  ${row.entity}: ${row.updated}/${row.found}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[${LOG}] failed:`, err);
  process.exit(1);
});
