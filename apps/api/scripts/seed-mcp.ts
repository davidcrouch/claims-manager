/**
 * Seed trusted Claims MCP integration for all organisations.
 *
 * Usage: pnpm --filter api exec ts-node scripts/seed-mcp.ts
 * Safe to re-run (idempotent).
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, isNull } from 'drizzle-orm';
import { Pool } from 'pg';
import {
  mcpIntegration,
  mcpConnection,
  organizations,
} from '../src/database/schema';

const DATABASE_URL = process.env.DATABASE_URL;
const CLAIMS_MCP_URL = process.env.CLAIMS_MCP_URL || 'http://localhost:4601/mcp';
const MS_GRAPH_MCP_URL = process.env.MS_GRAPH_MCP_URL || 'http://localhost:4602/mcp';

if (!DATABASE_URL) {
  console.error('[seed-mcp] DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  console.log(`[seed-mcp] Seeding Claims Tools MCP for ${orgs.length} org(s) → ${CLAIMS_MCP_URL}`);

  for (const org of orgs) {
    const [existing] = await db
      .select()
      .from(mcpIntegration)
      .where(
        and(
          eq(mcpIntegration.tenantId, org.id),
          eq(mcpIntegration.name, 'Claims Tools'),
        ),
      )
      .limit(1);

    let integrationId = existing?.id;
    if (!existing) {
      const [created] = await db
        .insert(mcpIntegration)
        .values({
          tenantId: org.id,
          name: 'Claims Tools',
          description: 'First-party claims-manager domain tools (trusted)',
          url: CLAIMS_MCP_URL,
          transportType: 'http',
          supportedAuthTypes: ['bearer_passthrough'],
          authConfig: {},
          visibility: 'org',
          status: 'active',
          trustedServer: true,
          sharedConnectionPolicy: 'org_shared',
        })
        .returning();
      integrationId = created.id;
      console.log(`[seed-mcp] Created integration for org ${org.name} (${org.id})`);
    } else {
      await db
        .update(mcpIntegration)
        .set({
          url: CLAIMS_MCP_URL,
          status: 'active',
          trustedServer: true,
          supportedAuthTypes: ['bearer_passthrough'],
          updatedAt: new Date(),
        })
        .where(eq(mcpIntegration.id, existing.id));
      console.log(`[seed-mcp] Updated integration for org ${org.name}`);
    }

    if (!integrationId) continue;

    const [conn] = await db
      .select()
      .from(mcpConnection)
      .where(
        and(
          eq(mcpConnection.tenantId, org.id),
          eq(mcpConnection.integrationId, integrationId),
          isNull(mcpConnection.deletedAt),
          isNull(mcpConnection.userId),
        ),
      )
      .limit(1);

    if (!conn) {
      await db.insert(mcpConnection).values({
        integrationId,
        tenantId: org.id,
        userId: null,
        authType: 'bearer_passthrough',
        status: 'connected',
        visibility: 'org',
        enabled: true,
      });
      console.log(`[seed-mcp] Created org-shared connection for ${org.name}`);
    }

    // Seed MS Graph integration
    const [existingGraph] = await db
      .select()
      .from(mcpIntegration)
      .where(
        and(
          eq(mcpIntegration.tenantId, org.id),
          eq(mcpIntegration.name, 'Microsoft 365'),
        ),
      )
      .limit(1);

    let graphIntegrationId = existingGraph?.id;
    if (!existingGraph) {
      const [created] = await db
        .insert(mcpIntegration)
        .values({
          tenantId: org.id,
          name: 'Microsoft 365',
          description: 'Microsoft Graph API — email, calendar, contacts, and files',
          url: MS_GRAPH_MCP_URL,
          transportType: 'http',
          supportedAuthTypes: ['oauth'],
          authConfig: {
            oauth: {
              authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
              tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
              scopes: ['Mail.ReadWrite', 'Calendars.ReadWrite', 'Contacts.Read', 'Files.ReadWrite.All'],
            },
          },
          visibility: 'org',
          status: 'active',
          trustedServer: false,
          sharedConnectionPolicy: 'user_required',
        })
        .returning();
      graphIntegrationId = created.id;
      console.log(`[seed-mcp] Created MS Graph integration for org ${org.name}`);
    } else {
      console.log(`[seed-mcp] MS Graph integration already exists for org ${org.name}`);
    }
  }

  await pool.end();
  console.log('[seed-mcp] Done');
}

main().catch((err) => {
  console.error('[seed-mcp] Failed', err);
  process.exit(1);
});
