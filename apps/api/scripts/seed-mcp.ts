/**
 * Seed trusted Claims MCP integration for all organisations.
 *
 * Usage: pnpm --filter api run db:seed:mcp
 * Safe to re-run (idempotent).
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/database/schema';
import { organizations } from '../src/database/schema';
import { seedMcpForTenant } from '../src/database/seeds/entries/mcp.seed';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[seed-mcp] DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations);
  console.log(`[seed-mcp] Seeding MCP for ${orgs.length} org(s)`);

  for (const org of orgs) {
    const result = await seedMcpForTenant({
      db,
      tenantId: org.id,
      logger: {
        info: (m) => console.log(m),
        warn: (m) => console.warn(m),
        error: (m) => console.error(m),
      },
    });
    console.log(
      `[seed-mcp] org=${org.name} inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}`,
    );
  }

  await pool.end();
  console.log('[seed-mcp] Done');
}

main().catch((err) => {
  console.error('[seed-mcp] Failed', err);
  process.exit(1);
});
