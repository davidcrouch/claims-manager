/**
 * Seed trusted Claims Tools + Microsoft 365 MCP integrations for a tenant.
 * Idempotent. Used by provisioning and the db:seed:mcp CLI.
 *
 * Also seeds coarse category integrations (operations/documents/
 * filesystem/ai/organisation) pointing at `/{category}/mcp` mounts on claims-mcp.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';

const LOG = '[seeds/mcp]';

/** Must stay aligned with apps/claims-mcp/src/categories.ts SEEDED_CATEGORY_INTEGRATIONS. */
const SEEDED_CATEGORY_INTEGRATIONS = [
  {
    slug: 'operations',
    name: 'Claims Operations',
    description:
      'Main-menu domains: claims, jobs, commercial docs, finance, tasks, schedule, contacts, journals, reports',
  },
  {
    slug: 'documents',
    name: 'Claims Documents',
    description: 'Documents runtime plus templates, transforms, and attachments',
  },
  {
    slug: 'filesystem',
    name: 'Claims Filesystem',
    description: 'Filesystems, templates, pipelines, and catalogue',
  },
  {
    slug: 'ai',
    name: 'Claims AI',
    description: 'Messages/chat plus agents, skills, AI settings, MCP admin, and providers',
  },
  {
    slug: 'organisation',
    name: 'Claims Organisation',
    description: 'Users, organisations, roles, and notifications',
  },
] as const;

function resolveClaimsMcpBaseUrl(): string {
  const raw = (process.env.CLAIMS_MCP_URL ?? '').trim() || 'http://localhost:4601';
  return raw.replace(/\/+$/, '').replace(/\/mcp$/i, '');
}

function resolveClaimsMcpUrl(): string {
  return `${resolveClaimsMcpBaseUrl()}/mcp`;
}

function resolveClaimsMcpCategoryUrl(slug: string): string {
  return `${resolveClaimsMcpBaseUrl()}/${slug}/mcp`;
}

function resolveMsGraphMcpUrl(): string {
  const raw = (process.env.MS_GRAPH_MCP_URL ?? '').trim();
  if (!raw) return 'http://localhost:4602/mcp';
  return raw.endsWith('/mcp') ? raw : `${raw.replace(/\/+$/, '')}/mcp`;
}

async function upsertTrustedIntegration(params: {
  db: SeedDb;
  tenantId: string;
  name: string;
  description: string;
  url: string;
  logger: SeedLogger;
  counters: { inserted: number; updated: number; skipped: number };
  createOrgConnection: boolean;
}): Promise<string | undefined> {
  const { db, tenantId, name, description, url, logger, counters, createOrgConnection } =
    params;

  const [existing] = await db
    .select()
    .from(schema.mcpIntegration)
    .where(
      and(eq(schema.mcpIntegration.tenantId, tenantId), eq(schema.mcpIntegration.name, name)),
    )
    .limit(1);

  let integrationId = existing?.id;
  if (!existing) {
    const [created] = await db
      .insert(schema.mcpIntegration)
      .values({
        tenantId,
        name,
        description,
        url,
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
    counters.inserted += 1;
    logger.info(`${LOG} created ${name} integration id=${integrationId}`);
  } else {
    await db
      .update(schema.mcpIntegration)
      .set({
        url,
        description,
        status: 'active',
        trustedServer: true,
        supportedAuthTypes: ['bearer_passthrough'],
        updatedAt: new Date(),
      })
      .where(eq(schema.mcpIntegration.id, existing.id));
    counters.updated += 1;
    logger.info(`${LOG} updated ${name} integration id=${existing.id}`);
  }

  if (createOrgConnection && integrationId) {
    const [conn] = await db
      .select()
      .from(schema.mcpConnection)
      .where(
        and(
          eq(schema.mcpConnection.tenantId, tenantId),
          eq(schema.mcpConnection.integrationId, integrationId),
          isNull(schema.mcpConnection.deletedAt),
          isNull(schema.mcpConnection.userId),
        ),
      )
      .limit(1);

    if (!conn) {
      await db.insert(schema.mcpConnection).values({
        integrationId,
        tenantId,
        userId: null,
        authType: 'bearer_passthrough',
        status: 'connected',
        visibility: 'org',
        enabled: true,
      });
      counters.inserted += 1;
      logger.info(`${LOG} created org-shared ${name} connection`);
    } else {
      counters.skipped += 1;
    }
  }

  return integrationId;
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
  const counters = { inserted: 0, updated: 0, skipped: 0 };

  logger.info(`${LOG} seeding MCP integrations tenant=${tenantId} claims=${claimsUrl}`);

  await upsertTrustedIntegration({
    db,
    tenantId,
    name: 'Claims Tools',
    description: 'First-party claims-manager domain tools (trusted, all categories)',
    url: claimsUrl,
    logger,
    counters,
    createOrgConnection: true,
  });

  for (const cat of SEEDED_CATEGORY_INTEGRATIONS) {
    await upsertTrustedIntegration({
      db,
      tenantId,
      name: cat.name,
      description: cat.description,
      url: resolveClaimsMcpCategoryUrl(cat.slug),
      logger,
      counters,
      createOrgConnection: true,
    });
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
    counters.inserted += 1;
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
    counters.updated += 1;
    logger.info(`${LOG} updated Microsoft 365 integration id=${existingGraph.id}`);
  }

  return {
    inserted: counters.inserted,
    updated: counters.updated,
    skipped: counters.skipped,
    notes: `mcp tenant=${tenantId}`,
  };
}

export async function seedMcpForAllTenants(params: {
  db: SeedDb;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const { db } = params;
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  const orgs = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      subscriptionStatus: schema.organizations.subscriptionStatus,
    })
    .from(schema.organizations);

  const tenants = orgs.filter((org) => org.subscriptionStatus !== 'ghost');
  if (tenants.length === 0) {
    logger.warn(`${LOG} no organisations in DB — nothing to seed`);
    return { inserted: 0, updated: 0, skipped: 0, notes: 'no tenant' };
  }

  const totals: SeedResult = { inserted: 0, updated: 0, skipped: 0 };
  for (const org of tenants) {
    logger.info(`${LOG} tenant=${org.name} (${org.id})`);
    const result = await seedMcpForTenant({ db, tenantId: org.id, logger });
    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
  }
  totals.notes = `tenants=${tenants.length}`;
  return totals;
}
