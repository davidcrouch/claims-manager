/**
 * Seed entry point. Registers all seeds and runs them sequentially.
 *
 * Run: pnpm --filter api run db:seed
 *
 * Seeds are idempotent — safe to run on a fresh DB or an existing one.
 * To add a new seed, create an entry under `./entries/` and register it below.
 *
 * Order:
 *   1. Platform seeds (no org required) — filesystem-default
 *   2. Ensure Construction org + Crunchwork staging connection
 *   3. Tenant seeds for that org — catalog-dev, lookups
 *
 * Note: Document template uploads moved to first-login provisioning flow
 * (ProvisioningService) — they go through the real API pipeline for thumbnails.
 */
import { openDb } from './lib/db';
import { runSeeds } from './lib/runner';
import type { Seed } from './lib/runner';
import filesystemDefaultSeed from './entries/filesystem-default.seed';
import ensureConstructionSeed from './entries/ensure-construction.seed';
import catalogDevSeed from './entries/catalog-dev.seed';
import lookupsSeed from './entries/lookups.seed';

function buildSeeds(): Seed[] {
  return [
    filesystemDefaultSeed,
    ensureConstructionSeed,
    catalogDevSeed,
    lookupsSeed,
  ];
}

export async function seed(): Promise<void> {
  const { db, pool } = openDb();
  try {
    await runSeeds({ db, seeds: buildSeeds() });
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
