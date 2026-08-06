/**
 * Seed trusted Claims Tools + Microsoft 365 MCP integrations for a tenant.
 * Idempotent. Used by provisioning and the db:seed:mcp CLI.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';

const LOG = '[seeds/mcp]';

function resolveClaimsMcpUrl(): string {
  const raw = (process.env.CLAIMS_MCP_URL ?? '').trim();
  if (!raw) return 'http://localhost:4601/mcp';
  return raw.endsWith('/mcp') ? raw : `${raw.replace(/\/+$/, '')}/mcp`;
}

function resolveMsGraphMcpUrl(): string {
  const raw = (process.env.MS_GRAPH_MCP_URL ?? '').trim();
  if (!raw) return 'http://localhost:4602/mcp';
  return raw.endsWith('/mcp') ? raw : `${raw.replace(/\/+$/, '')}/mcp`;
}

export async function seedMcpForTenant(params: {
  db: SeedDb;
  tenantId: string;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const logger = params.logger ?? {
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
    error: (m: string) => console.error(m),
  };
  const { db, tenantId } = params;
  const claimsUrl = resolveClaimsMcpUrl();
  const graphUrl = resolveMsGraphMcpUrl();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  logger.info(`${LOG} seeding MCP integrations tenant=${tenantId} claims=${claimsUrl}`);

  const [existingClaims] = await db
    .select()
    .from(schema.mcpIntegration)
    .where(
      and(
        eq(schema.mcpIntegration.tenantId, tenantId),
        eq(schema.mcpIntegration.name, 'Claims Tools'),
      ),
    )
    .limit(1);

  let claimsIntegrationId = existingClaims?.id;
  if (!existingClaims) {
    const [created] = await db
      .insert(schema.mcpIntegration)
      .values({
        tenantId,
        name: 'Claims Tools',
        description: 'First-party claims-manager domain tools (trusted)',
        url: claimsUrl,
        transportType: 'http',
        supportedAuthTypes: ['bearer_passthrough'],
        authConfig: {},
        visibility: 'org',
        status: 'active',
        trustedServer: true,
        sharedConnectionPolicy: 'org_shared',
      })
      .returning();
    claimsIntegrationId = created.id;
    inserted += 1;
    logger.info(`${LOG} created Claims Tools integration id=${claimsIntegrationId}`);
  } else {
    await db
      .update(schema.mcpIntegration)
      .set({
        url: claimsUrl,
        status: 'active',
        trustedServer: true,
        supportedAuthTypes: ['bearer_passthrough'],
        updatedAt: new Date(),
      })
      .where(eq(schema.mcpIntegration.id, existingClaims.id));
    updated += 1;
    logger.info(`${LOG} updated Claims Tools integration id=${existingClaims.id}`);
  }

  if (claimsIntegrationId) {
    const [conn] = await db
      .select()
      .from(schema.mcpConnection)
      .where(
        and(
          eq(schema.mcpConnection.tenantId, tenantId),
          eq(schema.mcpConnection.integrationId, claimsIntegrationId),
          isNull(schema.mcpConnection.deletedAt),
          isNull(schema.mcpConnection.userId),
        ),
      )
      .limit(1);

    if (!conn) {
      await db.insert(schema.mcpConnection).values({
        integrationId: claimsIntegrationId,
        tenantId,
        userId: null,
        authType: 'bearer_passthrough',
        status: 'connected',
        visibility: 'org',
        enabled: true,
      });
      inserted += 1;
      logger.info(`${LOG} created org-shared Claims Tools connection`);
    } else {
      skipped += 1;
    }
  }

  const [existingGraph] = await db
    .select()
    .from(schema.mcpIntegration)
    .where(
      and(
        eq(schema.mcpIntegration.tenantId, tenantId),
        eq(schema.mcpIntegration.name, 'Microsoft 365'),
      ),
    )
    .limit(1);

  if (!existingGraph) {
    await db.insert(schema.mcpIntegration).values({
      tenantId,
      name: 'Microsoft 365',
      description: 'Microsoft Graph API — email, calendar, contacts, and files',
      url: graphUrl,
      transportType: 'http',
      supportedAuthTypes: ['oauth'],
      authConfig: {
        oauth: {
          authorizationUrl:
            'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
          scopes: [
            'Mail.ReadWrite',
            'Calendars.ReadWrite',
            'Contacts.Read',
            'Files.ReadWrite.All',
          ],
        },
      },
      visibility: 'org',
      status: 'active',
      trustedServer: false,
      sharedConnectionPolicy: 'user_required',
    });
    inserted += 1;
    logger.info(`${LOG} created Microsoft 365 integration`);
  } else {
    await db
      .update(schema.mcpIntegration)
      .set({
        url: graphUrl,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.mcpIntegration.id, existingGraph.id));
    updated += 1;
    logger.info(`${LOG} updated Microsoft 365 integration id=${existingGraph.id}`);
  }

  return {
    inserted,
    updated,
    skipped,
    notes: `mcp tenant=${tenantId}`,
  };
}
