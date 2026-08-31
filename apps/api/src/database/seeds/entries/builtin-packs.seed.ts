/**
 * Idempotent install of builtin capability packs (agents + skills) for every tenant.
 * Ensures Report Builder, Help Assistant, journal/catalog agents, etc. exist on staging
 * without requiring a manual Admin → Packs install.
 *
 * Packs live under apps/api/packs (bundled in the api-server image).
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { parse as parseYaml } from 'yaml';
import type { SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';
import {
  packAgentSchema,
  packManifestSchema,
  packSkillSchema,
  type PackAgent,
  type PackManifest,
  type PackSkill,
} from '../../../modules/capability-packs/pack-manifest.types';
import { buildNamespacedToolId } from '../../../modules/mcp-integration/mcp-integration.types';

const LOG = '[seeds/builtin-packs]';

function contentHash(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function resolvePacksRoot(): string {
  const fromEnv = (process.env.PACKS_ROOT ?? '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  // Cloud Run cwd is /app/apps/api; local scripts often run from apps/api too.
  return path.resolve(process.cwd(), 'packs');
}

async function listPackDirs(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

async function loadPack(
  root: string,
  packId: string,
): Promise<{
  manifest: PackManifest;
  agents: Array<{ hash: string; data: PackAgent; key: string }>;
  skills: Array<{ hash: string; data: PackSkill; key: string }>;
} | null> {
  const packRoot = path.join(root, packId);
  let manifestRaw: string;
  try {
    manifestRaw = await fs.readFile(path.join(packRoot, 'pack.yaml'), 'utf8');
  } catch {
    return null;
  }
  const manifest = packManifestSchema.parse(parseYaml(manifestRaw));
  if (manifest.id !== packId) {
    throw new Error(`Pack folder "${packId}" does not match manifest id "${manifest.id}"`);
  }

  const agents = [];
  for (const ref of manifest.agents) {
    const raw = await fs.readFile(path.join(packRoot, ref.file), 'utf8');
    agents.push({
      key: ref.file,
      hash: contentHash(raw),
      data: packAgentSchema.parse(parseYaml(raw)),
    });
  }

  const skills = [];
  for (const ref of manifest.skills) {
    const raw = await fs.readFile(path.join(packRoot, ref.file), 'utf8');
    skills.push({
      key: ref.file,
      hash: contentHash(raw),
      data: packSkillSchema.parse(parseYaml(raw)),
    });
  }

  return { manifest, agents, skills };
}

async function resolveConnectionIds(
  db: SeedDb,
  tenantId: string,
  integrationNames: string[],
): Promise<string[]> {
  if (integrationNames.length === 0) return [];
  const integrations = await db
    .select({
      id: schema.mcpIntegration.id,
      name: schema.mcpIntegration.name,
    })
    .from(schema.mcpIntegration)
    .where(
      and(
        eq(schema.mcpIntegration.tenantId, tenantId),
        inArray(schema.mcpIntegration.name, integrationNames),
      ),
    );

  const byName = new Map(integrations.map((i) => [i.name, i.id]));
  const connectionIds: string[] = [];
  for (const name of integrationNames) {
    const integrationId = byName.get(name);
    if (!integrationId) continue;
    const [conn] = await db
      .select({ id: schema.mcpConnection.id })
      .from(schema.mcpConnection)
      .where(
        and(
          eq(schema.mcpConnection.tenantId, tenantId),
          eq(schema.mcpConnection.integrationId, integrationId),
          isNull(schema.mcpConnection.deletedAt),
          eq(schema.mcpConnection.enabled, true),
        ),
      )
      .limit(1);
    if (conn) connectionIds.push(conn.id);
  }
  return connectionIds;
}

function namespaceTools(connectionIds: string[], toolNames: string[]): string[] {
  if (!connectionIds.length || !toolNames.length) return [];
  // Prefer exact names (no globs) — enough for Report Builder and most pack agents.
  const exact = toolNames.filter((t) => !t.includes('*'));
  const out = new Set<string>();
  for (const connectionId of connectionIds) {
    for (const tool of exact) {
      out.add(buildNamespacedToolId(connectionId, tool));
    }
  }
  return [...out];
}

export async function seedBuiltinPacksForTenant(params: {
  db: SeedDb;
  tenantId: string;
  logger?: SeedLogger;
  packsRoot?: string;
}): Promise<SeedResult> {
  const logger = params.logger ?? {
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
    error: (m: string) => console.error(m),
  };
  const { db, tenantId } = params;
  const root = params.packsRoot ?? resolvePacksRoot();
  const packIds = await listPackDirs(root);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  if (packIds.length === 0) {
    logger.warn(`${LOG} no packs found under ${root}`);
    return { inserted: 0, updated: 0, skipped: 0, notes: `packsRoot=${root}` };
  }

  logger.info(`${LOG} seeding ${packIds.length} packs for tenant=${tenantId} root=${root}`);

  for (const packId of packIds) {
    let pack: Awaited<ReturnType<typeof loadPack>>;
    try {
      pack = await loadPack(root, packId);
    } catch (err) {
      logger.warn(
        `${LOG} skip pack=${packId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      skipped++;
      continue;
    }
    if (!pack) {
      skipped++;
      continue;
    }

    const [existingInstall] = await db
      .select()
      .from(schema.capabilityPackInstall)
      .where(
        and(
          eq(schema.capabilityPackInstall.tenantId, tenantId),
          eq(schema.capabilityPackInstall.packId, pack.manifest.id),
          inArray(schema.capabilityPackInstall.status, ['active', 'upgrading', 'error']),
        ),
      )
      .limit(1);

    let installId = existingInstall?.id;
    if (!installId) {
      const [created] = await db
        .insert(schema.capabilityPackInstall)
        .values({
          tenantId,
          packId: pack.manifest.id,
          packVersion: pack.manifest.version,
          status: 'active',
          source: 'builtin',
          displayName: pack.manifest.name,
        })
        .returning({ id: schema.capabilityPackInstall.id });
      installId = created!.id;
      inserted++;
      logger.info(`${LOG} created install pack=${pack.manifest.id} id=${installId}`);
    } else {
      await db
        .update(schema.capabilityPackInstall)
        .set({
          packVersion: pack.manifest.version,
          displayName: pack.manifest.name,
          status: 'active',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.capabilityPackInstall.id, installId));
      updated++;
    }

    const skillIdBySlug = new Map<string, string>();

    for (const entry of pack.skills) {
      const [existing] = await db
        .select()
        .from(schema.skill)
        .where(
          and(eq(schema.skill.tenantId, tenantId), eq(schema.skill.name, entry.data.name)),
        )
        .limit(1);

      if (existing) {
        await db
          .update(schema.skill)
          .set({
            description: entry.data.description ?? null,
            triggerHints: entry.data.triggerHints,
            instructionPrompt: entry.data.instructionPrompt,
            requiredToolRefs: entry.data.requiredToolRefs,
            invocationMode: entry.data.invocationMode,
            includeHistory: entry.data.includeHistory,
            historyMessageCount: entry.data.historyMessageCount ?? 5,
            category: entry.data.category,
            visibility: entry.data.visibility,
            packInstallId: installId,
            updatedAt: new Date(),
          })
          .where(eq(schema.skill.id, existing.id));
        skillIdBySlug.set(entry.data.slug, existing.id);
        updated++;
      } else {
        const [created] = await db
          .insert(schema.skill)
          .values({
            tenantId,
            name: entry.data.name,
            description: entry.data.description ?? null,
            triggerHints: entry.data.triggerHints,
            instructionPrompt: entry.data.instructionPrompt,
            requiredToolRefs: entry.data.requiredToolRefs,
            invocationMode: entry.data.invocationMode,
            includeHistory: entry.data.includeHistory,
            historyMessageCount: entry.data.historyMessageCount ?? 5,
            category: entry.data.category,
            visibility: entry.data.visibility,
            packInstallId: installId,
            embedding: null,
          })
          .returning({ id: schema.skill.id });
        skillIdBySlug.set(entry.data.slug, created!.id);
        inserted++;
      }
    }

    for (const entry of pack.agents) {
      const refs = entry.data.integrationRefs.length
        ? entry.data.integrationRefs
        : pack.manifest.integrationRefs;
      const connectionIds = await resolveConnectionIds(db, tenantId, refs);
      const enabledToolRefs = namespaceTools(connectionIds, entry.data.enabledTools);
      const pinnedSkills = entry.data.pinnedSkillSlugs
        .map((slug) => skillIdBySlug.get(slug))
        .filter((id): id is string => !!id);

      const [existing] = await db
        .select()
        .from(schema.agent)
        .where(and(eq(schema.agent.tenantId, tenantId), eq(schema.agent.slug, entry.data.slug)))
        .limit(1);

      if (existing) {
        await db
          .update(schema.agent)
          .set({
            name: entry.data.name,
            description: entry.data.description ?? null,
            type: entry.data.type,
            chatEnabled: entry.data.chatEnabled,
            provider: entry.data.provider,
            model: entry.data.model,
            temperature: String(entry.data.temperature),
            maxTokens: entry.data.maxTokens,
            systemPrompt: entry.data.systemPrompt,
            visibility: entry.data.visibility,
            connectionIds,
            enabledToolRefs,
            pinnedSkills,
            semanticSkills: entry.data.semanticSkills,
            supportsVision: entry.data.supportsVision,
            maxSteps: entry.data.maxSteps,
            autonomousMode: entry.data.autonomousMode,
            pauseAfterToolSteps: entry.data.pauseAfterToolSteps,
            maxDurationSeconds: entry.data.maxDurationSeconds,
            isDefault: entry.data.isDefault,
            packInstallId: installId,
            updatedAt: new Date(),
          })
          .where(eq(schema.agent.id, existing.id));
        updated++;
        logger.info(`${LOG} updated agent slug=${entry.data.slug}`);
      } else {
        await db.insert(schema.agent).values({
          tenantId,
          slug: entry.data.slug,
          name: entry.data.name,
          description: entry.data.description ?? null,
          type: entry.data.type,
          chatEnabled: entry.data.chatEnabled,
          provider: entry.data.provider,
          model: entry.data.model,
          temperature: String(entry.data.temperature),
          maxTokens: entry.data.maxTokens,
          systemPrompt: entry.data.systemPrompt,
          visibility: entry.data.visibility,
          connectionIds,
          enabledToolRefs,
          pinnedSkills,
          semanticSkills: entry.data.semanticSkills,
          supportsVision: entry.data.supportsVision,
          maxSteps: entry.data.maxSteps,
          autonomousMode: entry.data.autonomousMode,
          pauseAfterToolSteps: entry.data.pauseAfterToolSteps,
          maxDurationSeconds: entry.data.maxDurationSeconds,
          isDefault: entry.data.isDefault,
          packInstallId: installId,
        });
        inserted++;
        logger.info(`${LOG} inserted agent slug=${entry.data.slug}`);
      }
    }
  }

  return {
    inserted,
    updated,
    skipped,
    notes: `tenant=${tenantId} packs=${packIds.length}`,
  };
}

export async function seedBuiltinPacksForAllTenants(params: {
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
    const result = await seedBuiltinPacksForTenant({ db, tenantId: org.id, logger });
    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
  }
  totals.notes = `tenants=${tenants.length}`;
  return totals;
}
