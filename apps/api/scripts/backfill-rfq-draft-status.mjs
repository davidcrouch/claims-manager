/**
 * Ensure rfq_status Draft exists per tenant that has null-status RFQs, assign
 * Draft to those rows, and add missing workflow statuses (Draft/Responded/
 * Cancelled/Expired) only for tenants that already use rfq_status.
 *
 * Active-tab list filters by status IDs only, so null-status RFQs flash on SSR
 * then disappear after client refetch.
 *
 * Usage: node scripts/backfill-rfq-draft-status.mjs [--dry-run]
 */
import 'dotenv/config';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const LOG = 'backfill-rfq-draft-status';

async function ensureLookup(client, tenantId, name, externalReference) {
  const existing = await client.query(
    `SELECT id FROM lookup_values
     WHERE tenant_id = $1 AND domain = 'rfq_status' AND name = $2 AND is_active = true
     LIMIT 1`,
    [tenantId, name],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  if (dryRun) {
    console.log(`[${LOG}] dry-run: would create ${name} for tenant=${tenantId}`);
    return null;
  }

  const inserted = await client.query(
    `INSERT INTO lookup_values (tenant_id, domain, name, external_reference, is_active)
     VALUES ($1, 'rfq_status', $2, $3, true)
     RETURNING id`,
    [tenantId, name, externalReference],
  );
  console.log(`[${LOG}] created ${name} lookup id=${inserted.rows[0].id} tenant=${tenantId}`);
  return inserted.rows[0].id;
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
    const { rows: nullRfqs } = await client.query(`
      SELECT id, tenant_id, job_id, name
      FROM rfqs
      WHERE deleted_at IS NULL AND status_lookup_id IS NULL
    `);

    console.log(`[${LOG}] found ${nullRfqs.length} RFQs with null status`);

    const draftByTenant = new Map();
    let updated = 0;

    for (const row of nullRfqs) {
      let draftId = draftByTenant.get(row.tenant_id);
      if (draftId === undefined) {
        draftId = await ensureLookup(client, row.tenant_id, 'Draft', 'rfq-status-draft');
        draftByTenant.set(row.tenant_id, draftId);
      }
      if (!draftId) continue;

      if (dryRun) {
        console.log(
          `[${LOG}] dry-run: would set RFQ ${row.id} job=${row.job_id} → Draft ${draftId}`,
        );
        updated += 1;
        continue;
      }

      await client.query(
        `UPDATE rfqs SET status_lookup_id = $1, updated_at = NOW() WHERE id = $2`,
        [draftId, row.id],
      );
      updated += 1;
    }

    const { rows: tenants } = await client.query(`
      SELECT DISTINCT tenant_id FROM lookup_values WHERE domain = 'rfq_status'
    `);
    const extras = [
      ['Draft', 'rfq-status-draft'],
      ['Responded', 'rfq-status-responded'],
      ['Cancelled', 'rfq-status-cancelled'],
      ['Expired', 'rfq-status-expired'],
    ];
    for (const { tenant_id: tenantId } of tenants) {
      for (const [name, ref] of extras) {
        await ensureLookup(client, tenantId, name, ref);
      }
    }

    console.log(`[${LOG}] ${dryRun ? 'would update' : 'updated'} ${updated} RFQs`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[${LOG}] failed:`, err);
  process.exit(1);
});
