/**
 * Remap work_orders.status_lookup_id from purchase_order_status → work_order_status
 * by status name (per tenant). WO Active/Archived list tabs filter by work_order_status
 * IDs only; copied PO status IDs caused rows to flash then disappear.
 *
 * Usage: node scripts/backfill-work-order-status-domain.mjs [--dry-run]
 */
import 'dotenv/config';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const LOG = 'backfill-work-order-status-domain';

function mapPoNameToWoName(name) {
  const key = String(name ?? 'Open').trim().toLowerCase();
  if (key === 'issued') return 'Open';
  if (key === 'cancelled' || key === 'closed') return 'Archived';
  return String(name ?? 'Open').trim() || 'Open';
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(`[${LOG}] DATABASE_URL is required`);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const { rows: wrong } = await client.query(`
      SELECT wo.id AS wo_id, wo.tenant_id, src.id AS src_id, src.name AS src_name
      FROM work_orders wo
      JOIN lookup_values src ON src.id = wo.status_lookup_id
      WHERE src.domain = 'purchase_order_status'
    `);

    console.log(`[${LOG}] found ${wrong.length} work orders with purchase_order_status`);

    let updated = 0;
    let skipped = 0;
    const missing = new Map();

    for (const row of wrong) {
      const targetName = mapPoNameToWoName(row.src_name);
      const { rows: targets } = await client.query(
        `
        SELECT id
        FROM lookup_values
        WHERE tenant_id = $1
          AND domain = 'work_order_status'
          AND lower(name) = lower($2)
          AND is_active = true
        ORDER BY created_at ASC NULLS LAST, id ASC
        LIMIT 1
        `,
        [row.tenant_id, targetName],
      );

      const targetId = targets[0]?.id;
      if (!targetId) {
        skipped += 1;
        const key = `${row.tenant_id}:${targetName}`;
        missing.set(key, (missing.get(key) ?? 0) + 1);
        continue;
      }

      if (targetId === row.src_id) {
        skipped += 1;
        continue;
      }

      if (!dryRun) {
        await client.query(
          `UPDATE work_orders SET status_lookup_id = $1, updated_at = now() WHERE id = $2`,
          [targetId, row.wo_id],
        );
      }
      updated += 1;
    }

    console.log(
      `[${LOG}] ${dryRun ? 'dry-run would update' : 'updated'} ${updated}, skipped ${skipped}`,
    );
    if (missing.size > 0) {
      console.warn(`[${LOG}] missing work_order_status targets:`);
      for (const [key, count] of missing) {
        console.warn(`  ${key} (${count})`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[${LOG}]`, err);
  process.exit(1);
});
