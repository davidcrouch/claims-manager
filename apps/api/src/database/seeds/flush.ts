/**
 * DESTRUCTIVE: wipes the DB and rebuilds it from scratch.
 *
 *   1. Drops the `public` and `drizzle` (migrator journal) schemas.
 *   2. Recreates `public` and re-runs all Drizzle migrations from
 *      `src/database/migrations-drizzle/`.
 *   3. Runs all seeds registered in `./index.ts`.
 *
 * Guarded by three checks — ALL must pass:
 *   - `NODE_ENV !== 'production'`
 *   - DB host is `localhost` / `127.0.0.1` (or `CONFIRM_FLUSH_NON_LOCAL=yes`)
 *   - `--yes` flag on the CLI (or `CONFIRM_FLUSH=yes`)
 *
 * Run: pnpm --filter api run db:flush -- --yes
 */
import 'dotenv/config';
import { join } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { openDb, getDbHost } from './lib/db';
import { runSeeds } from './lib/runner';
import type { Seed } from './lib/runner';

const SEEDS: Seed[] = [];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function hasConfirmFlag(): boolean {
  if (process.argv.includes('--yes') || process.argv.includes('-y')) return true;
  if ((process.env.CONFIRM_FLUSH ?? '').toLowerCase() === 'yes') return true;
  return false;
}

function assertSafeToFlush(params: { url: string }): void {
  const prefix = '[seeds/flush.assertSafeToFlush]';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${prefix} refusing to flush in NODE_ENV=production`);
  }

  const host = getDbHost(params.url);
  const allowNonLocal =
    (process.env.CONFIRM_FLUSH_NON_LOCAL ?? '').toLowerCase() === 'yes';
  if (!LOCAL_HOSTS.has(host) && !allowNonLocal) {
    throw new Error(
      `${prefix} DB host '${host}' is not local; set CONFIRM_FLUSH_NON_LOCAL=yes to override`,
    );
  }

  if (!hasConfirmFlag()) {
    throw new Error(
      `${prefix} missing confirmation — pass --yes or set CONFIRM_FLUSH=yes`,
    );
  }
}

async function dropAndRecreateSchema(params: { pool: Pool }): Promise<void> {
  const prefix = '[seeds/flush.dropAndRecreateSchema]';
  const client = await params.pool.connect();
  try {
    console.log(`${prefix} dropping schemas: public, drizzle`);
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await client.query('CREATE SCHEMA public');
    // Restore default grants that `CREATE SCHEMA public` does not reproduce.
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log(`${prefix} schemas recreated`);
  } finally {
    client.release();
  }
}

async function runMigrations(params: { url: string }): Promise<void> {
  const prefix = '[seeds/flush.runMigrations]';
  const migrationsFolder = join(
    __dirname,
    '..',
    'migrations-drizzle',
  );
  console.log(`${prefix} running migrations from ${migrationsFolder}`);
  const pool = new Pool({ connectionString: params.url });
  const db = drizzle(pool);
  try {
    await migrate(db, { migrationsFolder });
    console.log(`${prefix} migrations complete`);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const prefix = '[seeds/flush.main]';
  const { db, pool, url } = openDb();

  try {
    assertSafeToFlush({ url });

    const host = getDbHost(url);
    console.log(`${prefix} target host=${host}`);

    // Sanity: verify we can reach the DB before destroying anything.
    await db.execute(sql`SELECT 1`);

    await dropAndRecreateSchema({ pool });
  } finally {
    await pool.end();
  }

  // Fresh pool for migrations, and another for seeds, so each phase has a
  // clean connection against the newly recreated schema.
  await runMigrations({ url });

  const seedHandle = openDb();
  try {
    await runSeeds({ db: seedHandle.db, seeds: SEEDS });
  } finally {
    await seedHandle.pool.end();
  }

  console.log(`${prefix} flush + migrate + seed complete`);
}

main().catch((err) => {
  console.error('[seeds/flush.main] failed:', err);
  process.exit(1);
});
