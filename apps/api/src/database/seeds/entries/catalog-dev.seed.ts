/**
 * Catalogue basics seed — item types, trade categories, and unit_type lookups.
 *
 * Does NOT seed catalogues or catalogue items. Tenants populate catalogues
 * via import / UI.
 *
 * Idempotent. Safe to re-run.
 *
 * Callers:
 *   - CLI (`pnpm --filter api run db:seed`) → Ensure Construction, else first org
 *   - api-server `POST /internal/seed-tenant` → always for new tenants
 *   - ProvisioningService on first login
 *   - iag-catalog seed (before catalogue replace)
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';
import { ENSURE_CONSTRUCTION_SLUG } from './ensure-construction.seed';

const LOG = '[seeds/catalog-dev]';

/** Canonical lowercase codes — imports often use title-case and must not create siblings. */
const CATEGORY_DEFS: Array<{ code: string; name: string }> = [
  { code: 'electrical', name: 'Electrical' },
  { code: 'plumbing', name: 'Plumbing' },
  { code: 'plastering', name: 'Plastering' },
  { code: 'carpentry', name: 'Carpentry' },
  { code: 'general', name: 'General' },
  { code: 'labour', name: 'Labour' },
];

async function findCategoryByCodeInsensitive(params: {
  db: SeedDb;
  tenantId: string;
  code: string;
  parentCategoryId?: string | null;
}): Promise<typeof schema.catalogCategories.$inferSelect | null> {
  const codeKey = params.code.trim().toLowerCase();
  const conditions = [
    eq(schema.catalogCategories.tenantId, params.tenantId),
    sql`lower(${schema.catalogCategories.code}) = ${codeKey}`,
  ];
  if (params.parentCategoryId !== undefined) {
    if (params.parentCategoryId === null) {
      conditions.push(sql`${schema.catalogCategories.parentCategoryId} IS NULL`);
    } else {
      conditions.push(eq(schema.catalogCategories.parentCategoryId, params.parentCategoryId));
    }
  }
  const [row] = await params.db
    .select()
    .from(schema.catalogCategories)
    .where(and(...conditions))
    .limit(1);
  return row ?? null;
}

/**
 * Merge active siblings that share the same lower(name) under the same parent.
 * Prefer the row whose code matches a seed def (lowercase), else the one with
 * more items, else lower sort_index. Reassigns items and deactivates losers.
 */
async function mergeCaseInsensitiveCategoryDupes(params: {
  db: SeedDb;
  tenantId: string;
  logger: SeedLogger;
}): Promise<number> {
  const { db, tenantId, logger } = params;
  const seedCodes = new Set(CATEGORY_DEFS.map((c) => c.code));

  const active = await db
    .select()
    .from(schema.catalogCategories)
    .where(
      and(
        eq(schema.catalogCategories.tenantId, tenantId),
        eq(schema.catalogCategories.isActive, true),
      ),
    );

  const groups = new Map<string, typeof active>();
  for (const row of active) {
    const key = `${row.parentCategoryId ?? 'root'}::${row.name.trim().toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let merged = 0;
  for (const siblings of groups.values()) {
    if (siblings.length < 2) continue;

    const scored = await Promise.all(
      siblings.map(async (row) => {
        const [countRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.catalogItems)
          .where(
            and(
              eq(schema.catalogItems.categoryId, row.id),
              isNull(schema.catalogItems.deletedAt),
            ),
          );
        return {
          row,
          itemCount: countRow?.count ?? 0,
          seedRank: seedCodes.has(row.code.toLowerCase()) ? 0 : 1,
        };
      }),
    );

    scored.sort((a, b) => {
      if (a.seedRank !== b.seedRank) return a.seedRank - b.seedRank;
      if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
      if (a.row.sortIndex !== b.row.sortIndex) return a.row.sortIndex - b.row.sortIndex;
      return a.row.id.localeCompare(b.row.id);
    });

    const keep = scored[0].row;
    for (const loser of scored.slice(1)) {
      const removeId = loser.row.id;
      await db.execute(sql`
        UPDATE catalog_items
        SET category_id = ${keep.id}, updated_at = now()
        WHERE category_id = ${removeId} AND deleted_at IS NULL
      `);
      await db.execute(sql`
        UPDATE catalog_items
        SET sub_category_id = ${keep.id}, updated_at = now()
        WHERE sub_category_id = ${removeId} AND deleted_at IS NULL
      `);
      await db.execute(sql`
        UPDATE catalog_categories
        SET parent_category_id = ${keep.id}
        WHERE parent_category_id = ${removeId}
      `);
      // Free unique (tenant, parent, code) before deactivating — keep may later
      // normalize to the same lowercase code the loser already holds.
      await db.execute(sql`
        UPDATE catalog_categories
        SET code = code || '__inactive_dupe_' || substr(id::text, 1, 8),
            is_active = false,
            updated_at = now()
        WHERE id = ${removeId}
      `);
      logger.info(
        `${LOG} merged duplicate category "${keep.name}" remove=${removeId} keep=${keep.id}`,
      );
      merged++;
    }
  }
  return merged;
}

async function ensureBasics(
  db: SeedDb,
  tenantId: string,
  logger: SeedLogger,
): Promise<{ inserted: number; skipped: number; updated: number }> {
  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  const types = await db
    .select()
    .from(schema.catalogItemTypes)
    .where(eq(schema.catalogItemTypes.tenantId, tenantId));
  if (types.length === 0) {
    for (const t of [
      { code: 'material', name: 'Material', sortIndex: 0 },
      { code: 'labour', name: 'Labour', sortIndex: 1 },
      { code: 'equipment', name: 'Equipment', sortIndex: 2 },
      { code: 'vendor', name: 'Vendor', sortIndex: 3 },
      { code: 'other', name: 'Other', sortIndex: 4 },
    ]) {
      await db.insert(schema.catalogItemTypes).values({ tenantId, ...t, isActive: true });
      inserted++;
    }
    logger.info(`${LOG} seeded catalog item types`);
  } else {
    skipped += types.length;
  }

  let tradesRoot = await findCategoryByCodeInsensitive({
    db,
    tenantId,
    code: 'trades',
    parentCategoryId: null,
  });

  if (!tradesRoot) {
    const [created] = await db
      .insert(schema.catalogCategories)
      .values({
        tenantId,
        code: 'trades',
        name: 'Trades',
        sortIndex: 0,
        isActive: true,
      })
      .returning();
    tradesRoot = created;
    inserted++;
  } else if (tradesRoot.code !== 'trades' || tradesRoot.name !== 'Trades') {
    await db
      .update(schema.catalogCategories)
      .set({ code: 'trades', name: 'Trades', updatedAt: new Date() })
      .where(eq(schema.catalogCategories.id, tradesRoot.id));
    updated++;
  } else {
    skipped++;
  }

  // Heal any title-case / casing siblings created by imports before we insert.
  const merged = await mergeCaseInsensitiveCategoryDupes({ db, tenantId, logger });
  if (merged > 0) updated += merged;

  for (const cat of CATEGORY_DEFS) {
    const existing = await findCategoryByCodeInsensitive({
      db,
      tenantId,
      code: cat.code,
      parentCategoryId: tradesRoot.id,
    });
    if (!existing) {
      await db.insert(schema.catalogCategories).values({
        tenantId,
        parentCategoryId: tradesRoot.id,
        code: cat.code,
        name: cat.name,
        sortIndex: 0,
        isActive: true,
      });
      inserted++;
    } else if (existing.code !== cat.code || existing.name !== cat.name) {
      await db
        .update(schema.catalogCategories)
        .set({ code: cat.code, name: cat.name, updatedAt: new Date() })
        .where(eq(schema.catalogCategories.id, existing.id));
      updated++;
      logger.info(
        `${LOG} normalized category code "${existing.code}" → "${cat.code}" id=${existing.id}`,
      );
    } else {
      skipped++;
    }
  }

  const units = await db
    .select()
    .from(schema.lookupValues)
    .where(
      and(
        eq(schema.lookupValues.tenantId, tenantId),
        eq(schema.lookupValues.domain, 'unit_type'),
      ),
    );
  if (units.length === 0) {
    for (const u of [
      { name: 'Each', externalReference: 'EA' },
      { name: 'Hour', externalReference: 'HR' },
      { name: 'Square Metre', externalReference: 'M2' },
      { name: 'Linear Metre', externalReference: 'LM' },
      { name: 'Lot', externalReference: 'LOT' },
      { name: 'Kilometre', externalReference: 'KM' },
      { name: 'Cubic Metre', externalReference: 'M3' },
      { name: 'Days', externalReference: 'DAYS' },
      { name: 'Item', externalReference: 'ITEM' },
      { name: 'Week', externalReference: 'WK' },
    ]) {
      await db.insert(schema.lookupValues).values({
        tenantId,
        domain: 'unit_type',
        providerCode: 'crunchwork',
        name: u.name,
        externalReference: u.externalReference,
        isActive: true,
      });
      inserted++;
    }
    logger.info(`${LOG} seeded unit_type lookups`);
  } else {
    skipped += units.length;
  }

  return { inserted, skipped, updated };
}

export async function seedCatalogDevForTenant(params: {
  db: SeedDb;
  tenantId: string;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const { db, tenantId } = params;
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  const basics = await ensureBasics(db, tenantId, logger);
  logger.info(
    `${LOG} done tenant=${tenantId} inserted=${basics.inserted} updated=${basics.updated} skipped=${basics.skipped} (basics only; no catalogues)`,
  );

  return {
    inserted: basics.inserted,
    updated: basics.updated,
    skipped: basics.skipped,
    notes: `tenant=${tenantId}; item types + categories + unit_type lookups only`,
  };
}

async function run(ctx: SeedContext): Promise<SeedResult> {
  const { db, logger } = ctx;

  const [named] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, ENSURE_CONSTRUCTION_SLUG))
    .limit(1);
  const [org] = named
    ? [named]
    : await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .limit(1);
  if (!org) {
    logger.warn(`${LOG} no organization — skipping`);
    return { inserted: 0, updated: 0, skipped: 0, notes: 'no tenant' };
  }

  return seedCatalogDevForTenant({ db, tenantId: org.id, logger });
}

const seed: Seed = {
  name: 'catalog-dev',
  description: 'Catalogue item types, trade categories, and unit_type lookups (no catalogues)',
  run,
};

export default seed;
