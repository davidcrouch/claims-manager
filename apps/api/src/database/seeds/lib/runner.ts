/**
 * Seed framework: each seed exports a `Seed` object with a unique `name` and
 * an idempotent `run(db)` function. The runner executes them sequentially and
 * prints a per-seed summary.
 *
 * Add a new seed by:
 *   1. Creating a file in ../entries/<name>.seed.ts exporting a default `Seed`.
 *   2. Importing and registering it in ../index.ts.
 */
import type { SeedDb } from './db';

export interface SeedContext {
  db: SeedDb;
  logger: SeedLogger;
}

export interface SeedResult {
  inserted: number;
  updated: number;
  skipped: number;
  notes?: string;
}

export interface Seed {
  name: string;
  description?: string;
  run: (ctx: SeedContext) => Promise<SeedResult>;
}

export interface SeedLogger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}

function makeLogger(name: string): SeedLogger {
  const prefix = `[seeds/${name}]`;
  return {
    info: (msg) => console.log(`${prefix} ${msg}`),
    warn: (msg) => console.warn(`${prefix} ${msg}`),
    error: (msg) => console.error(`${prefix} ${msg}`),
  };
}

export async function runSeeds(params: {
  db: SeedDb;
  seeds: Seed[];
}): Promise<void> {
  const { db, seeds } = params;
  const overallPrefix = '[seeds/runSeeds]';
  console.log(`${overallPrefix} running ${seeds.length} seed(s)`);

  const results: Array<{ seed: Seed; result: SeedResult }> = [];
  for (const seed of seeds) {
    const logger = makeLogger(seed.name);
    logger.info(`start${seed.description ? ` — ${seed.description}` : ''}`);
    try {
      const result = await seed.run({ db, logger });
      logger.info(
        `done — inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}${
          result.notes ? ` (${result.notes})` : ''
        }`,
      );
      results.push({ seed, result });
    } catch (err) {
      logger.error(`failed — ${(err as Error).message}`);
      throw err;
    }
  }

  const totals = results.reduce(
    (acc, { result }) => ({
      inserted: acc.inserted + result.inserted,
      updated: acc.updated + result.updated,
      skipped: acc.skipped + result.skipped,
    }),
    { inserted: 0, updated: 0, skipped: 0 },
  );
  console.log(
    `${overallPrefix} complete — inserted=${totals.inserted} updated=${totals.updated} skipped=${totals.skipped}`,
  );
}
