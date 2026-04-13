/**
 * Runs SQL migrations from apps/api/src/database/migrations-drizzle (copied beside dist for Docker).
 * Invoked in CI/Kubernetes as: node dist/database/run-migrations.js
 */
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const migrationsFolder = join(
    typeof __dirname !== 'undefined' ? __dirname : process.cwd(),
    'migrations-drizzle',
  );
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
