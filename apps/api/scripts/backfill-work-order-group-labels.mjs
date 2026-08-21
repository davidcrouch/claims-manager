/**
 * Backfill work_order_groups.group_label_lookup_id (+ description) from
 * group_payload.groupLabel when CW left description null and sync never
 * resolved the label — UI then showed "Group 1/2/3".
 *
 * Usage: node scripts/backfill-work-order-group-labels.mjs [--dry-run]
 */
import 'dotenv/config';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const LOG = 'backfill-work-order-group-labels';

function labelFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const gl = payload.groupLabel;
  if (gl && typeof gl === 'object') {
    const name = typeof gl.name === 'string' ? gl.name.trim() : '';
    if (name) {
      const ext =
        typeof gl.externalReference === 'string' && gl.externalReference.trim()
          ? gl.externalReference.trim()
          : name;
      return { name, externalReference: ext };
    }
  }
  const desc = typeof payload.description === 'string' ? payload.description.trim() : '';
  return desc ? { name: desc, externalReference: desc } : null;
}

async function resolveOrCreateLookup(client, tenantId, label) {
  const existing = await client.query(
    `
    SELECT id FROM lookup_values
    WHERE tenant_id = $1 AND domain = 'group_label'
      AND (
        lower(external_reference) = lower($2)
        OR lower(name) = lower($3)
      )
      AND is_active = true
    ORDER BY created_at ASC NULLS LAST, id ASC
    LIMIT 1
    `,
    [tenantId, label.externalReference, label.name],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  if (dryRun) return `dry-run:${label.name}`;

  const inserted = await client.query(
    `
    INSERT INTO lookup_values (
      tenant_id, domain, external_reference, name, metadata, is_active
    ) VALUES ($1, 'group_label', $2, $3, '{}'::jsonb, true)
    RETURNING id
    `,
    [tenantId, label.externalReference, label.name],
  );
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
    const { rows } = await client.query(`
      SELECT id, tenant_id, description, group_label_lookup_id, group_payload
      FROM work_order_groups
      WHERE deleted_at IS NULL
        AND (
          group_label_lookup_id IS NULL
          OR description IS NULL
          OR btrim(description) = ''
        )
    `);

    console.log(`[${LOG}] candidates=${rows.length}`);
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const label = labelFromPayload(row.group_payload);
      if (!label) {
        skipped += 1;
        continue;
      }

      const lookupId =
        row.group_label_lookup_id ??
        (await resolveOrCreateLookup(client, row.tenant_id, label));

      const nextDescription =
        row.description && String(row.description).trim()
          ? row.description
          : label.name;

      if (!dryRun) {
        await client.query(
          `
          UPDATE work_order_groups
          SET group_label_lookup_id = $1,
              description = $2,
              updated_at = now()
          WHERE id = $3
          `,
          [lookupId, nextDescription, row.id],
        );
      }
      updated += 1;
    }

    console.log(
      `[${LOG}] ${dryRun ? 'dry-run would update' : 'updated'} ${updated}, skipped ${skipped}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[${LOG}]`, err);
  process.exit(1);
});
