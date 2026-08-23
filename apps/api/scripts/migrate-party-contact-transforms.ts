/**
 * One-off / local sync of saved rfq / purchase_order / work_order transforms.
 * Prefer `pnpm --filter api run db:seed` or the staging/prod `seed-api-lookups`
 * job, which run the same logic via document-template-transforms.seed.ts.
 *
 * Usage (from apps/api):
 *   npx ts-node --transpile-only scripts/migrate-party-contact-transforms.ts
 */
import 'dotenv/config';
import { openDb } from '../src/database/seeds/lib/db';
import { syncDocumentTemplateTransforms } from '../src/database/seeds/lib/sync-document-template-transforms';

async function main(): Promise<void> {
  const { db, pool } = openDb();
  try {
    const result = await syncDocumentTemplateTransforms({
      db,
      logger: {
        info: (msg) => console.log(`migrate-party-contact-transforms — ${msg}`),
        warn: (msg) => console.warn(`migrate-party-contact-transforms — ${msg}`),
        error: (msg) => console.error(`migrate-party-contact-transforms — ${msg}`),
      },
    });
    console.log(
      `migrate-party-contact-transforms — done; updated=${result.updated} skipped=${result.skipped} (${result.notes})`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('migrate-party-contact-transforms — failed:', err);
  process.exit(1);
});
