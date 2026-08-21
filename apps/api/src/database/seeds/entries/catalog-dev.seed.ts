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
 */
import { and, eq } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';
import { ENSURE_CONSTRUCTION_SLUG } from './ensure-construction.seed';

const LOG = '[seeds/catalog-dev]';

const CATEGORY_DEFS: Array<{ code: string; name: string }> = [
  { code: 'electrical', name: 'Electrical' },
  { code: 'plumbing', name: 'Plumbing' },
  { code: 'plastering', name: 'Plastering' },
  { code: 'carpentry', name: 'Carpentry' },
  { code: 'general', name: 'General' },
  { code: 'labour', name: 'Labour' },
];

async function ensureBasics(
  db: SeedDb,
  tenantId: string,
  logger: SeedLogger,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

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

  let [tradesRoot] = await db
    .select()
    .from(schema.catalogCategories)
    .where(
      and(
        eq(schema.catalogCategories.tenantId, tenantId),
        eq(schema.catalogCategories.code, 'trades'),
      ),
    )
    .limit(1);

  if (!tradesRoot) {
    [tradesRoot] = await db
      .insert(schema.catalogCategories)
      .values({
        tenantId,
        code: 'trades',
        name: 'Trades',
        sortIndex: 0,
        isActive: true,
      })
      .returning();
    inserted++;
  } else {
    skipped++;
  }

  for (const cat of CATEGORY_DEFS) {
    const [existing] = await db
      .select()
      .from(schema.catalogCategories)
      .where(
        and(
          eq(schema.catalogCategories.tenantId, tenantId),
          eq(schema.catalogCategories.code, cat.code),
        ),
      )
      .limit(1);
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

  return { inserted, skipped };
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
    `${LOG} done tenant=${tenantId} inserted=${basics.inserted} skipped=${basics.skipped} (basics only; no catalogues)`,
  );

  return {
    inserted: basics.inserted,
    updated: 0,
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
