/**
 * Platform Company + Project filesystem template seeds.
 *
 * - Company (is_default): org-wide document tree
 * - Project: per-job document tree (Jobs workspace)
 *
 * Replaces legacy "Default" / fat construction trees. Descriptions are
 * classifier prompts — keep them when editing categories.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Seed, SeedContext, SeedResult } from '../lib/runner';
import * as schema from '../../schema';
import {
  PLATFORM_FILESYSTEM_TEMPLATES,
  type SeededCategoryNode,
  type SeededFilesystemTemplate,
} from './seeded-filesystem-templates';

const LOG = '[seeds/filesystem-default]';

const FAT_CONSTRUCTION_SLUGS = new Set([
  'CLAIMS_PROJECT',
  'ASSESSMENTS_REPORTS',
  'SCOPE_COMMERCIAL',
  'SITE_EVIDENCE',
  'WORKS_COMPLIANCE',
  'PROCUREMENT',
  'FINANCIALS',
]);

const LEGACY_FLAT_SLUGS = new Set([
  'claims',
  'jobs',
  'photos',
  'reports',
  'correspondence',
  'invoices-financials',
  'other',
]);

function flattenCategories(
  nodes: SeededCategoryNode[],
  templateId: string,
  parentId: string | null,
) {
  const rows: Array<{
    id: string;
    templateId: string;
    parentCategoryId: string | null;
    displayName: string;
    description: string;
    slug: string;
    config: Record<string, unknown>;
    sortOrder: number;
  }> = [];
  for (const node of nodes) {
    const id = crypto.randomUUID();
    rows.push({
      id,
      templateId,
      parentCategoryId: parentId,
      displayName: node.displayName,
      description: node.description,
      slug: node.slug,
      config: node.config ?? {},
      sortOrder: node.sortOrder,
    });
    if (node.children?.length) {
      rows.push(...flattenCategories(node.children, templateId, id));
    }
  }
  return rows;
}

function flattenOrgCategories(
  nodes: SeededCategoryNode[],
  filesystemId: string,
  parentId: string | null,
) {
  const rows: Array<{
    id: string;
    filesystemId: string;
    parentCategoryId: string | null;
    displayName: string;
    description: string;
    slug: string;
    config: Record<string, unknown>;
    sortOrder: number;
  }> = [];
  for (const node of nodes) {
    const id = crypto.randomUUID();
    rows.push({
      id,
      filesystemId,
      parentCategoryId: parentId,
      displayName: node.displayName,
      description: node.description,
      slug: node.slug,
      config: node.config ?? {},
      sortOrder: node.sortOrder,
    });
    if (node.children?.length) {
      rows.push(...flattenOrgCategories(node.children, filesystemId, id));
    }
  }
  return rows;
}

function needsTemplateReseed(
  cats: Array<{ slug: string; description: string | null }>,
  expected: SeededFilesystemTemplate,
): boolean {
  if (cats.length === 0) return true;
  const expectedSlugs = new Set(expected.categories.map((c) => c.slug));
  const actualSlugs = new Set(cats.map((c) => c.slug));
  if (expectedSlugs.size !== actualSlugs.size) return true;
  for (const s of expectedSlugs) {
    if (!actualSlugs.has(s)) return true;
  }
  return cats.some((c) => !c.description?.trim());
}

function isBloatedOrLegacyOrgTree(
  cats: Array<{ slug: string; description: string | null; parentCategoryId: string | null }>,
): boolean {
  if (cats.length === 0) return false;
  const slugs = cats.map((c) => c.slug);
  if (slugs.some((s) => FAT_CONSTRUCTION_SLUGS.has(s))) return true;
  if (cats.length > 15) return true;
  const allRoots = cats.every((c) => !c.parentCategoryId);
  const noneDescribed = cats.every((c) => !c.description?.trim());
  const legacyFlat = cats.every((c) => LEGACY_FLAT_SLUGS.has(c.slug));
  return allRoots && noneDescribed && legacyFlat;
}

async function clearTemplateTree(
  db: SeedContext['db'],
  templateId: string,
): Promise<void> {
  const pipelines = await db
    .select({ id: schema.filesystemTemplatePipelines.id })
    .from(schema.filesystemTemplatePipelines)
    .where(eq(schema.filesystemTemplatePipelines.templateId, templateId));
  const pipelineIds = pipelines.map((p) => p.id);
  if (pipelineIds.length > 0) {
    await db
      .delete(schema.filesystemTemplatePipelineSteps)
      .where(inArray(schema.filesystemTemplatePipelineSteps.pipelineId, pipelineIds));
    await db
      .delete(schema.filesystemTemplatePipelines)
      .where(eq(schema.filesystemTemplatePipelines.templateId, templateId));
  }
  await db
    .delete(schema.filesystemTemplateCategories)
    .where(eq(schema.filesystemTemplateCategories.templateId, templateId));
}

async function seedTemplateTree(
  db: SeedContext['db'],
  templateId: string,
  def: SeededFilesystemTemplate,
  logger: SeedContext['logger'],
): Promise<number> {
  let inserted = 0;
  const flat = flattenCategories(def.categories, templateId, null);
  await db.insert(schema.filesystemTemplateCategories).values(flat);
  inserted += flat.length;

  const slugToId = new Map(flat.map((r) => [r.slug, r.id]));
  for (const p of def.pipelines) {
    const templateCategoryId = p.categorySlug ? slugToId.get(p.categorySlug) ?? null : null;
    const [pipeline] = await db
      .insert(schema.filesystemTemplatePipelines)
      .values({
        templateId,
        templateCategoryId,
        name: p.name,
        description: p.description,
        isActive: true,
        triggerOn: p.triggerOn,
        sortOrder: p.sortOrder,
      })
      .returning();
    inserted += 1;
    if (p.steps.length > 0) {
      await db.insert(schema.filesystemTemplatePipelineSteps).values(
        p.steps.map((s) => ({
          pipelineId: pipeline.id,
          agentId: s.agentId,
          stepOrder: s.stepOrder,
          config: s.config ?? {},
        })),
      );
      inserted += p.steps.length;
    }
  }
  logger.info(`${LOG} seeded template="${def.name}" kind=${def.kind} cats=${flat.length}`);
  return inserted;
}

async function upsertPlatformTemplate(
  db: SeedContext['db'],
  def: SeededFilesystemTemplate,
  logger: SeedContext['logger'],
): Promise<{ templateId: string; inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  const [existing] = await db
    .select()
    .from(schema.filesystemTemplates)
    .where(
      and(
        isNull(schema.filesystemTemplates.tenantId),
        eq(schema.filesystemTemplates.name, def.name),
        eq(schema.filesystemTemplates.kind, def.kind),
        isNull(schema.filesystemTemplates.archivedAt),
      ),
    )
    .limit(1);

  let templateId: string;
  if (existing) {
    templateId = existing.id;
    await db
      .update(schema.filesystemTemplates)
      .set({
        description: def.description,
        kind: def.kind,
        isDefault: def.isDefault,
        updatedAt: new Date(),
      })
      .where(eq(schema.filesystemTemplates.id, templateId));
    updated += 1;
  } else {
    const [created] = await db
      .insert(schema.filesystemTemplates)
      .values({
        tenantId: null,
        name: def.name,
        description: def.description,
        kind: def.kind,
        isDefault: def.isDefault,
      })
      .returning();
    templateId = created.id;
    inserted += 1;
    logger.info(`${LOG} created platform template="${def.name}" id=${templateId}`);
  }

  // Ensure only Company is default among platform templates
  if (def.isDefault) {
    await db
      .update(schema.filesystemTemplates)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          isNull(schema.filesystemTemplates.tenantId),
          eq(schema.filesystemTemplates.isDefault, true),
          isNull(schema.filesystemTemplates.archivedAt),
        ),
      );
    await db
      .update(schema.filesystemTemplates)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(schema.filesystemTemplates.id, templateId));
  }

  const cats = await db
    .select()
    .from(schema.filesystemTemplateCategories)
    .where(eq(schema.filesystemTemplateCategories.templateId, templateId));

  if (needsTemplateReseed(cats, def)) {
    await clearTemplateTree(db, templateId);
    inserted += await seedTemplateTree(db, templateId, def, logger);
  }

  return { templateId, inserted, updated };
}

async function archiveLegacyDefault(
  db: SeedContext['db'],
  logger: SeedContext['logger'],
): Promise<number> {
  const legacy = await db
    .select()
    .from(schema.filesystemTemplates)
    .where(
      and(
        isNull(schema.filesystemTemplates.tenantId),
        eq(schema.filesystemTemplates.name, 'Default'),
        isNull(schema.filesystemTemplates.archivedAt),
      ),
    );
  let updated = 0;
  for (const row of legacy) {
    await clearTemplateTree(db, row.id);
    await db
      .update(schema.filesystemTemplates)
      .set({ archivedAt: new Date(), isDefault: false, updatedAt: new Date() })
      .where(eq(schema.filesystemTemplates.id, row.id));
    updated += 1;
    logger.info(`${LOG} archived legacy Default template id=${row.id}`);
  }
  return updated;
}

async function upgradeBloatedOrgFilesystems(
  db: SeedContext['db'],
  companyTemplateId: string,
  companyDef: SeededFilesystemTemplate,
  logger: SeedContext['logger'],
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  const orgFs = await db
    .select()
    .from(schema.filesystems)
    .where(isNull(schema.filesystems.archivedAt));

  for (const fs of orgFs) {
    const cats = await db
      .select()
      .from(schema.filesystemCategories)
      .where(
        and(
          eq(schema.filesystemCategories.filesystemId, fs.id),
          isNull(schema.filesystemCategories.archivedAt),
        ),
      );

    if (!isBloatedOrLegacyOrgTree(cats)) continue;

    logger.info(
      `${LOG} upgrading org filesystem to Company template id=${fs.id} tenant=${fs.tenantId} cats=${cats.length}`,
    );

    for (const cat of cats) {
      await db
        .update(schema.documents)
        .set({ filesystemCategoryId: null, updatedAt: new Date() })
        .where(eq(schema.documents.filesystemCategoryId, cat.id));
    }

    const orgPipelines = await db
      .select({ id: schema.documentPipelines.id })
      .from(schema.documentPipelines)
      .where(eq(schema.documentPipelines.filesystemId, fs.id));
    const orgPipelineIds = orgPipelines.map((p) => p.id);
    if (orgPipelineIds.length > 0) {
      await db
        .delete(schema.documentPipelineSteps)
        .where(inArray(schema.documentPipelineSteps.pipelineId, orgPipelineIds));
      await db
        .delete(schema.documentPipelines)
        .where(eq(schema.documentPipelines.filesystemId, fs.id));
    }

    await db
      .delete(schema.filesystemCategories)
      .where(eq(schema.filesystemCategories.filesystemId, fs.id));

    const flat = flattenOrgCategories(companyDef.categories, fs.id, null);
    await db.insert(schema.filesystemCategories).values(flat);
    inserted += flat.length;

    const slugToId = new Map(flat.map((r) => [r.slug, r.id]));
    for (const p of companyDef.pipelines) {
      const categoryId = p.categorySlug ? slugToId.get(p.categorySlug) ?? null : null;
      const [pipeline] = await db
        .insert(schema.documentPipelines)
        .values({
          tenantId: fs.tenantId,
          filesystemId: fs.id,
          categoryId,
          name: p.name,
          description: p.description,
          isActive: true,
          triggerOn: p.triggerOn,
          sortOrder: p.sortOrder,
        })
        .returning();
      inserted += 1;
      if (p.steps.length > 0) {
        await db.insert(schema.documentPipelineSteps).values(
          p.steps.map((s) => ({
            pipelineId: pipeline.id,
            agentId: s.agentId,
            stepOrder: s.stepOrder,
            config: s.config ?? {},
          })),
        );
        inserted += p.steps.length;
      }
    }

    await db
      .update(schema.filesystems)
      .set({
        sourceTemplateId: companyTemplateId,
        copiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.filesystems.id, fs.id));
    updated += 1;
  }

  return { inserted, updated };
}

const seed: Seed = {
  name: 'filesystem-default',
  description: 'Platform Company + Project filesystem templates',
  async run(ctx: SeedContext): Promise<SeedResult> {
    const { db, logger } = ctx;
    let inserted = 0;
    let skipped = 0;
    let updated = 0;

    updated += await archiveLegacyDefault(db, logger);

    let companyTemplateId = '';
    let companyDef = PLATFORM_FILESYSTEM_TEMPLATES.find((t) => t.kind === 'company')!;

    for (const def of PLATFORM_FILESYSTEM_TEMPLATES) {
      const result = await upsertPlatformTemplate(db, def, logger);
      inserted += result.inserted;
      updated += result.updated;
      if (def.kind === 'company') {
        companyTemplateId = result.templateId;
        companyDef = def;
      }
    }

    if (companyTemplateId) {
      const org = await upgradeBloatedOrgFilesystems(
        db,
        companyTemplateId,
        companyDef,
        logger,
      );
      inserted += org.inserted;
      updated += org.updated;
    }

    return {
      inserted,
      updated,
      skipped,
      notes: 'Company + Project platform templates',
    };
  },
};

export default seed;
