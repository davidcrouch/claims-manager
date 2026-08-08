/**
 * Catalogue seed — Crunchwork v1 + Internal Building Repairs.
 *
 * Sources (repo `data/`):
 *   - building-repairs-catalog.csv  → "Crunchwork v1" (type=crunchwork)
 *   - same primitives + internal-assembly-bom.json → "Building Repairs" (type=internal)
 *
 * Idempotent per (tenant, catalog, code). Safe to re-run.
 *
 * Callers:
 *   - CLI (`pnpm --filter api run db:seed`) → first org
 *   - api-server `POST /internal/seed-tenant` → always for new tenants
 */
import { readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import { parseCsv } from '../lib/csv';
import { assemblyBomPath, catalogCsvPath } from '../lib/catalog-data-paths';
import * as schema from '../../schema';

const LOG = '[seeds/catalog-dev]';

const CRUNCHWORK_CATALOG_NAME = 'Crunchwork v1';
const INTERNAL_CATALOG_NAME = 'Building Repairs';

const CATEGORY_DEFS: Array<{ code: string; name: string }> = [
  { code: 'electrical', name: 'Electrical' },
  { code: 'plumbing', name: 'Plumbing' },
  { code: 'plastering', name: 'Plastering' },
  { code: 'carpentry', name: 'Carpentry' },
  { code: 'general', name: 'General' },
  { code: 'labour', name: 'Labour' },
];

interface BomComponent {
  code: string;
  quantity: number;
  wasteFactor?: number;
}

interface BomAssembly {
  code: string;
  name: string;
  description?: string;
  typeCode: string;
  categoryCode: string;
  pricingMode?: 'computed' | 'fixed' | 'cost_plus';
  components: BomComponent[];
}

async function ensureBasics(
  db: SeedDb,
  tenantId: string,
  logger: SeedLogger,
): Promise<{
  typeByCode: Map<string, string>;
  categoryByCode: Map<string, string>;
  unitByRef: Map<string, string>;
  inserted: number;
  skipped: number;
}> {
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

  const typeRows = await db
    .select()
    .from(schema.catalogItemTypes)
    .where(eq(schema.catalogItemTypes.tenantId, tenantId));
  const typeByCode = new Map(typeRows.map((t) => [t.code, t.id]));

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

  const categories = await db
    .select()
    .from(schema.catalogCategories)
    .where(eq(schema.catalogCategories.tenantId, tenantId));
  const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));

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
  } else {
    skipped += units.length;
  }

  const unitRows = await db
    .select()
    .from(schema.lookupValues)
    .where(
      and(
        eq(schema.lookupValues.tenantId, tenantId),
        eq(schema.lookupValues.domain, 'unit_type'),
      ),
    );
  const unitByRef = new Map(
    unitRows.map((u) => [(u.externalReference ?? u.name ?? '').toLowerCase(), u.id]),
  );
  // Also map common lowercase refs used in CSV
  for (const [k, id] of [...unitByRef.entries()]) {
    if (k === 'ea') unitByRef.set('each', id);
    if (k === 'hr') unitByRef.set('hour', id);
  }

  return { typeByCode, categoryByCode, unitByRef, inserted, skipped };
}

async function ensureCatalog(
  db: SeedDb,
  tenantId: string,
  name: string,
  type: 'crunchwork' | 'internal',
  description: string,
): Promise<{ id: string; created: boolean }> {
  const [existing] = await db
    .select()
    .from(schema.catalogs)
    .where(and(eq(schema.catalogs.tenantId, tenantId), eq(schema.catalogs.name, name)))
    .limit(1);
  if (existing) return { id: existing.id, created: false };

  const [created] = await db
    .insert(schema.catalogs)
    .values({
      tenantId,
      name,
      type,
      description,
      isActive: true,
    })
    .returning();
  return { id: created.id, created: true };
}

async function findItemByCode(
  db: SeedDb,
  tenantId: string,
  catalogId: string,
  code: string,
) {
  const [row] = await db
    .select()
    .from(schema.catalogItems)
    .where(
      and(
        eq(schema.catalogItems.tenantId, tenantId),
        eq(schema.catalogItems.catalogId, catalogId),
        eq(schema.catalogItems.code, code),
      ),
    )
    .limit(1);
  return row ?? null;
}

function numOrNull(v: string | undefined): string | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(v) : null;
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

  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  const basics = await ensureBasics(db, tenantId, logger);
  inserted += basics.inserted;
  skipped += basics.skipped;
  const { typeByCode, categoryByCode, unitByRef } = basics;

  const csvText = readFileSync(catalogCsvPath(), 'utf8');
  const { rows: csvRows } = parseCsv(csvText);
  if (csvRows.length === 0) {
    throw new Error(`${LOG} building-repairs-catalog.csv has no rows`);
  }

  const bomAssemblies = JSON.parse(readFileSync(assemblyBomPath(), 'utf8')) as BomAssembly[];

  // ── Crunchwork v1 (from CSV — mirrors CW export for CW jobs) ──
  const cw = await ensureCatalog(
    db,
    tenantId,
    CRUNCHWORK_CATALOG_NAME,
    'crunchwork',
    'Seeded Crunchwork v1 catalogue from building-repairs-catalog.csv (residential insurance repairs).',
  );
  if (cw.created) {
    inserted++;
    logger.info(`${LOG} created catalogue "${CRUNCHWORK_CATALOG_NAME}"`);
  } else {
    skipped++;
  }

  for (const r of csvRows) {
    const code = (r.code || '').trim();
    if (!code) continue;
    const kind = (r.kind || 'primitive').trim() as 'primitive' | 'assembly' | 'scope';
    const typeCode = (r.type_code || 'other').trim();
    const typeId = typeByCode.get(typeCode);
    if (!typeId) {
      logger.warn(`${LOG} skip ${code}: unknown type_code=${typeCode}`);
      continue;
    }

    const existing = await findItemByCode(db, tenantId, cw.id, code);
    if (existing) {
      skipped++;
      continue;
    }

    const unitRef = (r.unit_type_ref || '').trim().toLowerCase();
    const unitTypeLookupId =
      kind === 'primitive' ? unitByRef.get(unitRef) ?? unitByRef.get('ea') ?? null : null;

    if (kind === 'primitive' && !unitTypeLookupId) {
      logger.warn(`${LOG} skip CW ${code}: missing unit type for ${unitRef}`);
      continue;
    }

    await db.insert(schema.catalogItems).values({
      tenantId,
      catalogId: cw.id,
      code,
      name: (r.display_name || r.name || code).trim(),
      description: (r.line_item_description || r.description || '').trim() || null,
      kind,
      typeId,
      categoryId: categoryByCode.get((r.category_code || '').trim()) ?? null,
      unitTypeLookupId,
      unitCost: kind === 'primitive' ? numOrNull(r.unit_cost) : null,
      buyCost: kind === 'primitive' ? numOrNull(r.buy_cost) : null,
      markupType: (r.markup_type || '').trim() || null,
      markupValue: numOrNull(r.markup_value),
      taxRate: numOrNull(r.tax_rate) ?? '0.10',
      pricingMode: kind === 'assembly' ? ((r.pricing_mode || 'fixed').trim() as 'fixed') : null,
      fixedUnitCost: kind === 'assembly' ? numOrNull(r.fixed_unit_cost) : null,
      externalReference: code, // CW sync key
      isActive: true,
      metadata: { source: 'building-repairs-catalog.csv', seededAs: 'crunchwork-v1' },
    });
    inserted++;
  }
  logger.info(`${LOG} Crunchwork v1 items seeded from CSV`);

  // ── Internal Building Repairs (primitives from CSV + computed BOM assemblies) ──
  const internal = await ensureCatalog(
    db,
    tenantId,
    INTERNAL_CATALOG_NAME,
    'internal',
    'Internal residential insurance repairs catalogue with computed assemblies (BOM).',
  );
  if (internal.created) {
    inserted++;
    logger.info(`${LOG} created catalogue "${INTERNAL_CATALOG_NAME}"`);
  } else {
    skipped++;
  }

  const internalPrimitiveIds = new Map<string, string>();

  for (const r of csvRows) {
    const code = (r.code || '').trim();
    if (!code) continue;
    const kind = (r.kind || '').trim();
    if (kind !== 'primitive') continue; // assemblies come from BOM JSON

    const typeCode = (r.type_code || 'other').trim();
    const typeId = typeByCode.get(typeCode);
    if (!typeId) continue;

    const existing = await findItemByCode(db, tenantId, internal.id, code);
    if (existing) {
      internalPrimitiveIds.set(code, existing.id);
      skipped++;
      continue;
    }

    const unitRef = (r.unit_type_ref || '').trim().toLowerCase();
    const unitTypeLookupId = unitByRef.get(unitRef) ?? unitByRef.get('ea') ?? null;
    if (!unitTypeLookupId) {
      logger.warn(`${LOG} skip internal ${code}: missing unit`);
      continue;
    }

    const [row] = await db
      .insert(schema.catalogItems)
      .values({
        tenantId,
        catalogId: internal.id,
        code,
        name: (r.display_name || code).trim(),
        description: (r.line_item_description || '').trim() || null,
        kind: 'primitive',
        typeId,
        categoryId: categoryByCode.get((r.category_code || '').trim()) ?? null,
        unitTypeLookupId,
        unitCost: numOrNull(r.unit_cost),
        buyCost: numOrNull(r.buy_cost),
        markupType: (r.markup_type || 'percent').trim() || 'percent',
        markupValue: numOrNull(r.markup_value) ?? '20',
        taxRate: numOrNull(r.tax_rate) ?? '0.10',
        isActive: true,
        metadata: { source: 'building-repairs-catalog.csv', seededAs: 'internal' },
      })
      .returning();
    internalPrimitiveIds.set(code, row.id);
    inserted++;
  }

  for (const asm of bomAssemblies) {
    const typeId = typeByCode.get(asm.typeCode) ?? typeByCode.get('other')!;
    let assemblyId: string | null = null;

    const existing = await findItemByCode(db, tenantId, internal.id, asm.code);
    if (existing) {
      assemblyId = existing.id;
      skipped++;
    } else {
      const [row] = await db
        .insert(schema.catalogItems)
        .values({
          tenantId,
          catalogId: internal.id,
          code: asm.code,
          name: asm.name,
          description: asm.description ?? null,
          kind: 'assembly',
          typeId,
          categoryId: categoryByCode.get(asm.categoryCode) ?? null,
          pricingMode: asm.pricingMode ?? 'computed',
          taxRate: '0.10',
          isActive: true,
          metadata: { source: 'internal-assembly-bom.json' },
        })
        .returning();
      assemblyId = row.id;
      inserted++;
    }

    // Replace BOM lines if none exist yet (idempotent)
    const existingBom = await db
      .select({ id: schema.catalogAssemblyComponents.id })
      .from(schema.catalogAssemblyComponents)
      .where(
        and(
          eq(schema.catalogAssemblyComponents.tenantId, tenantId),
          eq(schema.catalogAssemblyComponents.assemblyId, assemblyId),
        ),
      )
      .limit(1);

    if (existingBom.length > 0) {
      skipped += asm.components.length;
      continue;
    }

    const lines = [];
    let sortIndex = 0;
    for (const c of asm.components) {
      const componentId = internalPrimitiveIds.get(c.code);
      if (!componentId) {
        logger.warn(`${LOG} BOM ${asm.code}: missing component ${c.code}`);
        continue;
      }
      lines.push({
        tenantId,
        assemblyId,
        componentId,
        quantity: String(c.quantity),
        wasteFactor: String(c.wasteFactor ?? 1),
        sortIndex: sortIndex++,
        isOptional: false,
      });
    }
    if (lines.length > 0) {
      await db.insert(schema.catalogAssemblyComponents).values(lines);
      inserted += lines.length;
      updated++;
    }
  }

  logger.info(
    `${LOG} done tenant=${tenantId} cw=${CRUNCHWORK_CATALOG_NAME} internal=${INTERNAL_CATALOG_NAME} bomAssemblies=${bomAssemblies.length}`,
  );

  return {
    inserted,
    updated,
    skipped,
    notes: `tenant=${tenantId}; ${CRUNCHWORK_CATALOG_NAME} + ${INTERNAL_CATALOG_NAME}`,
  };
}

async function run(ctx: SeedContext): Promise<SeedResult> {
  const { db, logger } = ctx;

  const [org] = await db
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
  description: 'Crunchwork v1 + Internal Building Repairs catalogues from data/',
  run,
};

export default seed;
