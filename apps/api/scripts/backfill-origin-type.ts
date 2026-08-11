/**
 * Backfill origin_type for existing records.
 *
 * Sets origin_type='provider' on entities that were projected from an
 * external provider (identified by a source external_link).
 *
 * Sets origin_type='capture' on entities that have captureMethod='manual'.
 *
 * Sets origin_type='tenant' on entities that have sourceTenantId set
 * (cross-tenant issuance) and are not already covered above.
 *
 * Usage: npx tsx scripts/backfill-origin-type.ts
 * Safe to re-run (idempotent).
 */
import 'dotenv/config';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[backfill-origin-type] DATABASE_URL is required');
  process.exit(1);
}

const ENTITY_TABLES = [
  { table: 'quotes', entityType: 'quote', hasCaptureMethod: true, hasSourceTenantId: false },
  { table: 'purchase_orders', entityType: 'purchase_order', hasCaptureMethod: true, hasSourceTenantId: false },
  { table: 'invoices', entityType: 'invoice', hasCaptureMethod: true, hasSourceTenantId: true },
  { table: 'work_orders', entityType: 'work_order', hasCaptureMethod: false, hasSourceTenantId: true },
  { table: 'rfqs', entityType: 'rfq', hasCaptureMethod: true, hasSourceTenantId: true },
  { table: 'proposals', entityType: 'proposal', hasCaptureMethod: false, hasSourceTenantId: true },
  { table: 'bills', entityType: 'bill', hasCaptureMethod: false, hasSourceTenantId: true },
  { table: 'reports', entityType: 'report', hasCaptureMethod: false, hasSourceTenantId: false },
  { table: 'assessments', entityType: 'assessment', hasCaptureMethod: false, hasSourceTenantId: false },
  { table: 'journals', entityType: 'journal', hasCaptureMethod: false, hasSourceTenantId: false },
  { table: 'tasks', entityType: 'task', hasCaptureMethod: false, hasSourceTenantId: false },
  { table: 'messages', entityType: 'message', hasCaptureMethod: false, hasSourceTenantId: false },
  { table: 'attachments', entityType: 'attachment', hasCaptureMethod: false, hasSourceTenantId: false },
];

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    for (const { table, entityType, hasCaptureMethod, hasSourceTenantId } of ENTITY_TABLES) {
      // 1. Provider-projected rows (have a source external_link)
      const providerResult = await pool.query(`
        UPDATE "${table}" t
        SET origin_type = 'provider'
        FROM external_links el
        WHERE el.internal_entity_type = $1
          AND el.internal_entity_id = t.id
          AND el.link_role = 'source'
          AND t.origin_type = 'user'
      `, [entityType]);
      console.log(`[backfill-origin-type] ${table}: ${providerResult.rowCount} rows → provider`);

      // 2. Manually captured rows
      if (hasCaptureMethod) {
        const captureResult = await pool.query(`
          UPDATE "${table}"
          SET origin_type = 'capture'
          WHERE capture_method = 'manual'
            AND origin_type = 'user'
        `);
        console.log(`[backfill-origin-type] ${table}: ${captureResult.rowCount} rows → capture`);
      }

      // 3. Cross-tenant issued rows
      if (hasSourceTenantId) {
        const tenantResult = await pool.query(`
          UPDATE "${table}"
          SET origin_type = 'tenant'
          WHERE source_tenant_id IS NOT NULL
            AND origin_type = 'user'
        `);
        console.log(`[backfill-origin-type] ${table}: ${tenantResult.rowCount} rows → tenant`);
      }
    }

    console.log('[backfill-origin-type] Done.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[backfill-origin-type] Fatal error:', err);
  process.exit(1);
});
