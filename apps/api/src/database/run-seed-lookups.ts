/**
 * Seeds status/type lookups and Crunchwork group labels for every tenant.
 * Invoked in Cloud Run as: node dist/database/run-seed-lookups.js
 */
import { openDb } from './seeds/lib/db';
import { seedLookupsForAllTenants } from './seeds/entries/lookups.seed';

const LOG = 'database/run-seed-lookups';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(`${LOG} — DATABASE_URL is required`);
  }

  const { db, pool } = openDb();
  try {
    const result = await seedLookupsForAllTenants({
      db,
      logger: {
        info: (msg) => console.log(`[${LOG}] ${msg}`),
        warn: (msg) => console.warn(`[${LOG}] ${msg}`),
        error: (msg) => console.error(`[${LOG}] ${msg}`),
      },
    });
    console.log(
      `[${LOG}] done inserted=${result.inserted} skipped=${result.skipped}${
        result.notes ? ` (${result.notes})` : ''
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
