/**
 * Post-migrate seed job for staging/production:
 *   1. Status/type lookups + Crunchwork group labels (every tenant)
 *   2. Backfill claim status / loss-type FKs from stored CW payloads
 *   3. Replace catalogues with the IAG Crunchwork 2026-04-35 export (idempotent)
 *   4. Saved document-template JSONata transforms → code defaults
 *
 * Invoked in Cloud Run as: node dist/database/run-seed-lookups.js
 */
import { openDb } from './seeds/lib/db';
import { seedLookupsForAllTenants } from './seeds/entries/lookups.seed';
import { backfillClaimLookupsForAllTenants } from './seeds/entries/backfill-claim-lookups.seed';
import { replaceIagCatalogForAllTenants } from './seeds/entries/iag-catalog.seed';
import { seedDocumentTemplateTransforms } from './seeds/entries/document-template-transforms.seed';

const LOG = 'database/run-seed-lookups';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(`${LOG} — DATABASE_URL is required`);
  }

  const logger = {
    info: (msg: string) => console.log(`[${LOG}] ${msg}`),
    warn: (msg: string) => console.warn(`[${LOG}] ${msg}`),
    error: (msg: string) => console.error(`[${LOG}] ${msg}`),
  };

  const { db, pool } = openDb();
  try {
    const lookups = await seedLookupsForAllTenants({ db, logger });
    console.log(
      `[${LOG}] lookups done inserted=${lookups.inserted} skipped=${lookups.skipped}${
        lookups.notes ? ` (${lookups.notes})` : ''
      }`,
    );

    const backfill = await backfillClaimLookupsForAllTenants({ db, logger });
    console.log(
      `[${LOG}] claim-lookup backfill done inserted=${backfill.inserted} updated=${backfill.updated}${
        backfill.notes ? ` (${backfill.notes})` : ''
      }`,
    );

    const catalogs = await replaceIagCatalogForAllTenants({ db, logger });
    console.log(
      `[${LOG}] iag-catalog done inserted=${catalogs.inserted} skipped=${catalogs.skipped}${
        catalogs.notes ? ` (${catalogs.notes})` : ''
      }`,
    );

    const transforms = await seedDocumentTemplateTransforms({ db, logger });
    console.log(
      `[${LOG}] transforms done updated=${transforms.updated} skipped=${transforms.skipped}${
        transforms.notes ? ` (${transforms.notes})` : ''
      }`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(`[${LOG}] failed`, err);
  process.exit(1);
});
