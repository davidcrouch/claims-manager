/**
 * One-shot: backfill `jobs.status_lookup_id` from `api_payload.status`.
 *
 * CW jobs ingested before the autoCreate fix have status_lookup_id = NULL
 * despite having a valid status object in their api_payload. This script
 * finds or creates the lookup_values row and patches the job.
 *
 * Safe to re-run: skips rows that already have a status_lookup_id.
 *
 * Run with: `pnpm --filter api exec ts-node src/database/seeds/backfill-job-status.ts`
 */
import 'dotenv/config';
import { eq, and, isNull } from 'drizzle-orm';
import { openDb } from './lib/db';
import * as schema from '../schema';

async function run(): Promise<void> {
  const { db, pool } = openDb();

  const rows = await db
    .select({
      id: schema.jobs.id,
      tenantId: schema.jobs.tenantId,
      statusLookupId: schema.jobs.statusLookupId,
      apiPayload: schema.jobs.apiPayload,
    })
    .from(schema.jobs)
    .where(isNull(schema.jobs.statusLookupId));

  console.log(
    `backfill-job-status — found ${rows.length} job(s) with null status_lookup_id`,
  );

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const payload = row.apiPayload as Record<string, unknown> | null;
    const status = payload?.status as
      | { id?: string; name?: string; externalReference?: string }
      | undefined;

    const extRef = status?.externalReference ?? status?.id;
    if (!extRef) {
      skipped++;
      continue;
    }

    const name = status?.name ?? extRef;

    // Find existing lookup
    const [existing] = await db
      .select({ id: schema.lookupValues.id })
      .from(schema.lookupValues)
      .where(
        and(
          eq(schema.lookupValues.tenantId, row.tenantId),
          eq(schema.lookupValues.domain, 'job_status'),
          eq(schema.lookupValues.externalReference, extRef),
        ),
      )
      .limit(1);

    let lookupId: string;
    if (existing) {
      lookupId = existing.id;
    } else {
      const [created] = await db
        .insert(schema.lookupValues)
        .values({
          tenantId: row.tenantId,
          domain: 'job_status',
          externalReference: extRef,
          name,
        })
        .returning({ id: schema.lookupValues.id });
      lookupId = created.id;
      console.log(`  Created lookup: job_status/${extRef} = "${name}"`);
    }

    await db
      .update(schema.jobs)
      .set({ statusLookupId: lookupId, updatedAt: new Date() })
      .where(eq(schema.jobs.id, row.id));

    console.log(`  ${row.id} -> status="${name}"`);
    updated++;
  }

  await pool.end();
  console.log(
    `backfill-job-status — done (updated=${updated}, skipped=${skipped})`,
  );
}

run().catch((err) => {
  console.error('backfill-job-status — failed:', err);
  process.exit(1);
});
