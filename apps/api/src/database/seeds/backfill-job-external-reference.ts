/**
 * One-shot: backfill `jobs.external_reference` from `api_payload.externalReference`.
 *
 * Previously the mapper stored the CW job UUID (`payload.id`) as the job's
 * external_reference. The correct value is `payload.externalReference` — the
 * human-friendly insurer reference (e.g. "CODA12345"). This script reads
 * api_payload for every job row and updates external_reference where a
 * friendlier value is available.
 *
 * Safe to re-run: rows where api_payload.externalReference is null/empty or
 * already matches external_reference are skipped.
 *
 * Run with: `pnpm --filter api exec ts-node src/database/seeds/backfill-job-external-reference.ts`
 */
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { openDb } from './lib/db';
import * as schema from '../schema';

async function run(): Promise<void> {
  const { db, pool } = openDb();

  const rows = await db
    .select({
      id: schema.jobs.id,
      externalReference: schema.jobs.externalReference,
      apiPayload: schema.jobs.apiPayload,
    })
    .from(schema.jobs);

  console.log(
    `backfill-job-external-reference — scanning ${rows.length} job(s)`,
  );

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const payload = row.apiPayload as Record<string, unknown> | null;
    const friendlyRef =
      payload && typeof payload.externalReference === 'string' && payload.externalReference.trim()
        ? payload.externalReference.trim()
        : null;

    if (!friendlyRef) {
      skipped++;
      continue;
    }

    if (row.externalReference === friendlyRef) {
      skipped++;
      continue;
    }

    await db
      .update(schema.jobs)
      .set({
        externalReference: friendlyRef,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, row.id));

    console.log(
      `  ${row.id} — "${row.externalReference}" → "${friendlyRef}"`,
    );
    updated++;
  }

  await pool.end();
  console.log(
    `backfill-job-external-reference — done (updated=${updated}, skipped=${skipped})`,
  );
}

run().catch((err) => {
  console.error('backfill-job-external-reference — failed:', err);
  process.exit(1);
});
