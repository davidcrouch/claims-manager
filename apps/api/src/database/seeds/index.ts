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
 *   2. Tenant seeds for first org — catalog-dev; sample-data if SEED_SAMPLE_DATA=true
 *
 * Note: Document template uploads moved to first-login provisioning flow
 * (ProvisioningService) — they go through the real API pipeline for thumbnails.
 */
import { openDb } from './lib/db';
import { runSeeds } from './lib/runner';
import type { Seed } from './lib/runner';
import filesystemDefaultSeed from './entries/filesystem-default.seed';
import sampleDataSeed from './entries/sample-data.seed';
import catalogDevSeed from './entries/catalog-dev.seed';

function isSampleDataEnabled(): boolean {
  return (process.env.SEED_SAMPLE_DATA ?? '').trim().toLowerCase() === 'true';
}

function buildSeeds(): Seed[] {
  const seeds: Seed[] = [filesystemDefaultSeed, catalogDevSeed];
  if (isSampleDataEnabled()) {
    seeds.push(sampleDataSeed);
  } else {
    console.log(
      '[seeds/index] SEED_SAMPLE_DATA is not true — skipping sample-data seed',
    );
  }
  return seeds;
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
