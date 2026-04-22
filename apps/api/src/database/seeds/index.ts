/**
 * Seed entry point. Registers all seeds and runs them sequentially.
 *
 * Run: pnpm --filter api run db:seed
 *
 * Seeds are idempotent — safe to run on a fresh DB or an existing one.
 * To add a new seed, create an entry under `./entries/` and register it below.
 */
import { openDb } from './lib/db';
import { runSeeds } from './lib/runner';
import type { Seed } from './lib/runner';
import sampleDataSeed from './entries/sample-data.seed';

const SEEDS: Seed[] = [sampleDataSeed];

export async function seed(): Promise<void> {
  const { db, pool } = openDb();
  try {
    await runSeeds({ db, seeds: SEEDS });
  } finally {
    await pool.end();
  }
}

const isMain =
  typeof require !== 'undefined' && require.main === module;

if (isMain) {
  seed().catch((err) => {
    console.error('[seeds/index.seed] failed:', err);
    process.exit(1);
  });
}
