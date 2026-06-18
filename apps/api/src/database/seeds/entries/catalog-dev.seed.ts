/**
 * Dev/staging catalogue seed — sample primitives and a two-level assembly.
 *
 * Idempotent via catalog item `code` uniqueness per tenant.
 */
import { and, eq } from 'drizzle-orm';
import type { Seed, SeedContext, SeedResult } from '../lib/runner';
import * as schema from '../../schema';

const LOG = '[seeds/catalog-dev]';

const PRIMITIVES = [
  {
    code: 'GYPROCK-10',
    name: 'Gyprock 10mm sheet',
    kind: 'primitive' as const,
    typeCode: 'material',
    categoryCode: 'plastering',
    unitRef: 'ea',
    unitCost: '45.0000',
    buyCost: '32.0000',
  },
  {
    code: 'LAB-PLASTER',
    name: 'Plasterer labour',
    kind: 'primitive' as const,
    typeCode: 'labour',
    categoryCode: 'plastering',
    unitRef: 'hr',
    unitCost: '85.0000',
    buyCost: '65.0000',
  },
  {
    code: 'WP-MEMBRANE',
    name: 'Waterproof membrane',
    kind: 'primitive' as const,
    typeCode: 'material',
    categoryCode: 'plumbing',
    unitRef: 'ea',
    unitCost: '120.0000',
    buyCost: '90.0000',
  },
];

const seed: Seed = {
  name: 'catalog-dev',
  description: 'Sample catalogue items and BATH-RELINE assembly',
  async run(ctx: SeedContext): Promise<SeedResult> {
    const { db, logger } = ctx;
    let inserted = 0;
    let skipped = 0;

    const [org] = await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1);
    if (!org) {
      logger.warn('no organization — skipping');
      return { inserted: 0, updated: 0, skipped: 0, notes: 'no tenant' };
    }
    const tenantId = org.id;

    const types = await db
      .select()
      .from(schema.catalogItemTypes)
      .where(eq(schema.catalogItemTypes.tenantId, tenantId));
    if (types.length === 0) {
      const defaults = [
        { code: 'material', name: 'Material', sortIndex: 0 },
        { code: 'labour', name: 'Labour', sortIndex: 1 },
        { code: 'equipment', name: 'Equipment', sortIndex: 2 },
        { code: 'vendor', name: 'Vendor', sortIndex: 3 },
        { code: 'other', name: 'Other', sortIndex: 4 },
      ];
      for (const t of defaults) {
        await db.insert(schema.catalogItemTypes).values({ tenantId, ...t, isActive: true });
      }
      logger.info('seeded catalog item types');
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
    }

    for (const cat of [
      { code: 'plastering', name: 'Plastering' },
      { code: 'plumbing', name: 'Plumbing' },
    ]) {
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
      }
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

    const itemIds = new Map<string, string>();

    for (const p of PRIMITIVES) {
      const [existing] = await db
        .select()
        .from(schema.catalogItems)
        .where(
          and(eq(schema.catalogItems.tenantId, tenantId), eq(schema.catalogItems.code, p.code)),
        )
        .limit(1);
      if (existing) {
        itemIds.set(p.code, existing.id);
        skipped++;
        continue;
      }

      const [row] = await db
        .insert(schema.catalogItems)
        .values({
          tenantId,
          code: p.code,
          name: p.name,
          kind: p.kind,
          typeId: typeByCode.get(p.typeCode)!,
          categoryId: categoryByCode.get(p.categoryCode),
          unitTypeLookupId: unitByRef.get(p.unitRef),
          unitCost: p.unitCost,
          buyCost: p.buyCost,
          isActive: true,
        })
        .returning();
      itemIds.set(p.code, row.id);
      inserted++;
    }

    // Waterproof kit sub-assembly
    let kitId = itemIds.get('WATERPROOF-KIT');
    if (!kitId) {
      const [existingKit] = await db
        .select()
        .from(schema.catalogItems)
        .where(
          and(
            eq(schema.catalogItems.tenantId, tenantId),
            eq(schema.catalogItems.code, 'WATERPROOF-KIT'),
          ),
        )
        .limit(1);
      if (existingKit) {
        kitId = existingKit.id;
        skipped++;
      } else {
        const [kit] = await db
          .insert(schema.catalogItems)
          .values({
            tenantId,
            code: 'WATERPROOF-KIT',
            name: 'Waterproofing kit',
            kind: 'assembly',
            typeId: typeByCode.get('material')!,
            categoryId: categoryByCode.get('plumbing'),
            pricingMode: 'computed',
            isActive: true,
          })
          .returning();
        kitId = kit.id;
        inserted++;

        await db.insert(schema.catalogAssemblyComponents).values({
          tenantId,
          assemblyId: kitId,
          componentId: itemIds.get('WP-MEMBRANE')!,
          quantity: '1',
          wasteFactor: '1.05',
          sortIndex: 0,
        });
      }
    }

    const [existingAssembly] = await db
      .select()
      .from(schema.catalogItems)
      .where(
        and(
          eq(schema.catalogItems.tenantId, tenantId),
          eq(schema.catalogItems.code, 'BATH-RELINE'),
        ),
      )
      .limit(1);

    if (!existingAssembly) {
      const [assembly] = await db
        .insert(schema.catalogItems)
        .values({
          tenantId,
          code: 'BATH-RELINE',
          name: 'Bathroom reline',
          description: 'Sample assembly with nested waterproof kit',
          kind: 'assembly',
          typeId: typeByCode.get('other')!,
          categoryId: categoryByCode.get('plumbing'),
          pricingMode: 'computed',
          isActive: true,
        })
        .returning();

      await db.insert(schema.catalogAssemblyComponents).values([
        {
          tenantId,
          assemblyId: assembly.id,
          componentId: kitId!,
          quantity: '1',
          wasteFactor: '1',
          sortIndex: 0,
        },
        {
          tenantId,
          assemblyId: assembly.id,
          componentId: itemIds.get('GYPROCK-10')!,
          quantity: '4',
          wasteFactor: '1.1',
          sortIndex: 1,
        },
        {
          tenantId,
          assemblyId: assembly.id,
          componentId: itemIds.get('LAB-PLASTER')!,
          quantity: '8',
          wasteFactor: '1',
          sortIndex: 2,
        },
      ]);
      inserted++;
      logger.info(`${LOG} created BATH-RELINE assembly`);
    } else {
      skipped++;
    }

    return { inserted, updated: 0, skipped };
  },
};

export default seed;
