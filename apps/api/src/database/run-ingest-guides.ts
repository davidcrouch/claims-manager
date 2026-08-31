/**
 * Post-migrate job: ingest docs/guides into guide_document + guide_chunk.
 *
 * Local:  pnpm --filter api guides:ingest [--tenant-id <uuid>]
 * Cloud Run: node dist/database/run-ingest-guides.js
 */
import { join } from 'node:path';
import { openDb } from './seeds/lib/db';
import {
  ingestGuidesFromDisk,
  resolveGuidesDir,
} from './seeds/entries/guides-ingest.seed';

const LOG = 'database/run-ingest-guides';

function parseTenantId(): string | null {
  const idx = process.argv.indexOf('--tenant-id');
  if (idx === -1) return process.env.GUIDES_TENANT_ID?.trim() || null;
  return process.argv[idx + 1]?.trim() || null;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(`${LOG} — DATABASE_URL is required`);
  }

  const scriptDir =
    typeof __dirname !== 'undefined' ? __dirname : join(process.cwd(), 'dist/database');
  const guidesDir = resolveGuidesDir(scriptDir);
  const tenantId = parseTenantId();

  const logger = {
    info: (msg: string) => console.log(msg),
    warn: (msg: string) => console.warn(msg),
    error: (msg: string) => console.error(msg),
  };

  console.log(`[${LOG}] guidesDir=${guidesDir} tenant=${tenantId ?? '(global)'}`);

  const { db, pool } = openDb();
  try {
    const result = await ingestGuidesFromDisk({
      db,
      logger,
      guidesDir,
      tenantId,
    });
    console.log(
      `[${LOG}] done ingested=${result.ingested} skipped=${result.skipped} errors=${result.errors}`,
    );
    if (result.errors > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(`[${LOG}] failed:`, err);
  process.exit(1);
});
