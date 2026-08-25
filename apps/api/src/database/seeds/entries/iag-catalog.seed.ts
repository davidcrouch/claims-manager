/**
 * Replace tenant catalogues with the IAG / Crunchwork export used on local
 * (Crunchwork 2026-04-35 + Ensure Catalogue default).
 *
 * Idempotent: skips the full wipe/re-import when the target Crunchwork
 * catalogue already has a full item set, unless REPLACE_IAG_CATALOG=true.
 * Always retags Ensure Catalogue primitives as crunchwork (scopes stay
 * internal) so insurer publish is not blocked after a replace.
 *
 * Callers:
 *   - Cloud Run job `seed-api-lookups` (`run-seed-lookups.js`)
 *   - CLI `pnpm --filter api run db:seed`
 */
import { readFileSync } from 'node:fs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';
import { seedCatalogDevForTenant } from './catalog-dev.seed';
import {
  iagCrunchworkCatalogCsvPath,
  iagEnsureScopesCsvPath,
} from '../lib/catalog-data-paths';
import { coerceToRateString, DEFAULT_MARKUP_RATE, DEFAULT_TAX_RATE } from '../../../common/rates';
import {
  defaultProviderCodesForImport,
  providerCodesForEnsureCatalogItem,
} from '../../../modules/catalog/catalog.utils';

const LOG = '[seeds/iag-catalog]';

export const CW_CATALOG_NAME = 'Crunchwork 2026-04-35';
export const ENSURE_CATALOG_NAME = 'Ensure Catalogue';
const DEFAULT_CATALOG_NAME = 'Default';
const MIN_CW_ITEMS = 800;

const TYPE_CODE: Record<string, string> = {
  material: 'material',
  labour: 'labour',
  hire: 'equipment',
  equipment: 'equipment',
  vendor: 'vendor',
  other: 'other',
};

function forceReplace(): boolean {
  return (process.env.REPLACE_IAG_CATALOG ?? '').trim().toLowerCase() === 'true';
}

function parseCsv(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '');
  return normalized
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function colMap(header: string[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((h, i) => map.set(h.replace(/^\uFEFF/, '').trim().toLowerCase(), i));
  return map;
}

function cell(cols: Map<string, number>, row: string[], name: string): string {
  const idx = cols.get(name);
  if (idx === undefined) return '';
  return (row[idx] ?? '').trim();
}

function asNumeric(raw: string): string | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : null;
}

function slugCode(name: string): string {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'ITEM'
  );
}

async function wipeTenantCatalogs(db: SeedDb, tenantId: string, logger: SeedLogger): Promise<void> {
  const unlinkStatements = [
    sql`
      UPDATE quote_items t SET catalog_item_id = NULL
      FROM catalog_items ci
      WHERE t.catalog_item_id = ci.id AND ci.tenant_id = ${tenantId}
    `,
    sql`
      UPDATE quote_combos t SET catalog_combo_id = NULL
      FROM catalog_items ci
      WHERE t.catalog_combo_id = ci.id AND ci.tenant_id = ${tenantId}
    `,
    sql`
      UPDATE purchase_order_items t SET catalog_item_id = NULL
      FROM catalog_items ci
      WHERE t.catalog_item_id = ci.id AND ci.tenant_id = ${tenantId}
    `,
    sql`
      UPDATE purchase_order_combos t SET catalog_combo_id = NULL
      FROM catalog_items ci
      WHERE t.catalog_combo_id = ci.id AND ci.tenant_id = ${tenantId}
    `,
    sql`
      UPDATE work_order_items t SET catalog_item_id = NULL
      FROM catalog_items ci
      WHERE t.catalog_item_id = ci.id AND ci.tenant_id = ${tenantId}
    `,
    sql`
      UPDATE work_order_combos t SET catalog_combo_id = NULL
      FROM catalog_items ci
      WHERE t.catalog_combo_id = ci.id AND ci.tenant_id = ${tenantId}
    `,
  ];
  const unlinkLabels = [
    'quote_items.catalog_item_id',
    'quote_combos.catalog_combo_id',
    'purchase_order_items.catalog_item_id',
    'purchase_order_combos.catalog_combo_id',
    'work_order_items.catalog_item_id',
    'work_order_combos.catalog_combo_id',
  ];
  for (let i = 0; i < unlinkStatements.length; i++) {
    const result = await db.execute(unlinkStatements[i]);
    logger.info(`${LOG} unlinked ${Number(result.rowCount ?? 0)} ${unlinkLabels[i]}`);
  }

  await db
    .delete(schema.catalogAssemblyComponents)
    .where(eq(schema.catalogAssemblyComponents.tenantId, tenantId));
  await db.delete(schema.catalogItems).where(eq(schema.catalogItems.tenantId, tenantId));
  await db.delete(schema.catalogs).where(eq(schema.catalogs.tenantId, tenantId));
}

async function alreadyImported(db: SeedDb, tenantId: string): Promise<boolean> {
  const [catalog] = await db
    .select({ id: schema.catalogs.id })
    .from(schema.catalogs)
    .where(
      and(
        eq(schema.catalogs.tenantId, tenantId),
        eq(schema.catalogs.name, CW_CATALOG_NAME),
        eq(schema.catalogs.type, 'crunchwork'),
      ),
    )
    .limit(1);
  if (!catalog) return false;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.catalogItems)
    .where(
      and(
        eq(schema.catalogItems.tenantId, tenantId),
        eq(schema.catalogItems.catalogId, catalog.id),
        isNull(schema.catalogItems.deletedAt),
      ),
    );
  return (row?.n ?? 0) >= MIN_CW_ITEMS;
}

async function ensureType(
  db: SeedDb,
  tenantId: string,
  cache: Map<string, string>,
  raw: string,
): Promise<string> {
  const code = TYPE_CODE[raw.trim().toLowerCase()] ?? 'other';
  const hit = cache.get(code);
  if (hit) return hit;
  const [row] = await db
    .select({ id: schema.catalogItemTypes.id })
    .from(schema.catalogItemTypes)
    .where(
      and(
        eq(schema.catalogItemTypes.tenantId, tenantId),
        eq(schema.catalogItemTypes.code, code),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error(`${LOG} missing catalog item type ${code} — run catalog-dev seed first`);
  }
  cache.set(code, row.id);
  return row.id;
}

async function ensureCategory(
  db: SeedDb,
  tenantId: string,
  cache: Map<string, string>,
  raw: string,
  tradesRootId: string | null,
): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const [existing] = await db
    .select({ id: schema.catalogCategories.id })
    .from(schema.catalogCategories)
    .where(
      and(
        eq(schema.catalogCategories.tenantId, tenantId),
        eq(schema.catalogCategories.code, trimmed),
      ),
    )
    .limit(1);
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }
  const [created] = await db
    .insert(schema.catalogCategories)
    .values({
      tenantId,
      code: trimmed,
      name: trimmed,
      parentCategoryId: tradesRootId,
      sortIndex: cache.size,
      isActive: true,
    })
    .returning({ id: schema.catalogCategories.id });
  cache.set(key, created.id);
  return created.id;
}

async function ensureUnit(
  db: SeedDb,
  tenantId: string,
  cache: Map<string, string>,
  raw: string,
): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const rows = await db
    .select({
      id: schema.lookupValues.id,
      name: schema.lookupValues.name,
      externalReference: schema.lookupValues.externalReference,
    })
    .from(schema.lookupValues)
    .where(
      and(
        eq(schema.lookupValues.tenantId, tenantId),
        eq(schema.lookupValues.domain, 'unit_type'),
      ),
    );
  for (const row of rows) {
    if (row.externalReference) cache.set(row.externalReference.toLowerCase(), row.id);
    if (row.name) cache.set(row.name.toLowerCase(), row.id);
  }
  const afterLoad = cache.get(key);
  if (afterLoad) return afterLoad;
  const [created] = await db
    .insert(schema.lookupValues)
    .values({
      tenantId,
      domain: 'unit_type',
      providerCode: 'crunchwork',
      name: trimmed,
      externalReference: trimmed.toUpperCase(),
      isActive: true,
    })
    .returning({ id: schema.lookupValues.id });
  cache.set(key, created.id);
  cache.set(trimmed.toUpperCase().toLowerCase(), created.id);
  return created.id;
}

async function retagEnsurePrimitives(params: {
  db: SeedDb;
  tenantId: string;
  logger: SeedLogger;
}): Promise<number> {
  const result = await params.db.execute(sql`
    UPDATE "catalog_items" AS ci
    SET "provider_codes" = ARRAY['crunchwork']::text[]
    FROM "catalogs" AS c
    WHERE ci."catalog_id" = c."id"
      AND ci."tenant_id" = ${params.tenantId}
      AND c."tenant_id" = ${params.tenantId}
      AND ci."deleted_at" IS NULL
      AND ci."kind" = 'primitive'
      AND lower(c."name") IN ('ensure', 'ensure catalogue')
      AND ci."provider_codes" IS DISTINCT FROM ARRAY['crunchwork']::text[]
  `);
  const n = Number(result.rowCount ?? 0);
  if (n > 0) {
    params.logger.info(
      `${LOG} retagged ${n} Ensure primitives to crunchwork (tenant=${params.tenantId})`,
    );
  }
  return n;
}

async function importRows(params: {
  db: SeedDb;
  tenantId: string;
  catalogId: string;
  importFormat: 'internal' | 'crunchwork';
  tagging?: 'default' | 'ensure';
  cols: Map<string, number>;
  rows: string[][];
  onlyKind?: string;
  logger: SeedLogger;
}): Promise<number> {
  const { db, tenantId, catalogId, importFormat, cols, rows, onlyKind, logger } = params;
  const tagging = params.tagging ?? 'default';
  const typeCache = new Map<string, string>();
  const catCache = new Map<string, string>();
  const unitCache = new Map<string, string>();

  const [trades] = await db
    .select({ id: schema.catalogCategories.id })
    .from(schema.catalogCategories)
    .where(
      and(
        eq(schema.catalogCategories.tenantId, tenantId),
        eq(schema.catalogCategories.code, 'trades'),
      ),
    )
    .limit(1);
  const tradesRootId = trades?.id ?? null;

  type Pending = {
    code: string;
    name: string;
    description: string | null;
    kind: 'primitive' | 'assembly' | 'scope';
    typeId: string;
    categoryId: string | null;
    unitTypeLookupId: string | null;
    unitCost: string | null;
    buyCost: string | null;
    markupType: string;
    markupValue: string;
    taxRate: string;
    externalReference: string | null;
    providerCodes: string[];
    parentCode: string;
    isActive: boolean;
  };

  const pending: Pending[] = [];
  for (const row of rows) {
    const kindRaw = cell(cols, row, 'kind').toLowerCase();
    const kind =
      kindRaw === 'scope' || kindRaw === 'assembly' || kindRaw === 'primitive'
        ? kindRaw
        : 'primitive';
    if (onlyKind && kind !== onlyKind) continue;

    const id = cell(cols, row, 'id');
    const name = cell(cols, row, 'name');
    if (!name) continue;
    const code = id || slugCode(name);
    const typeId = await ensureType(db, tenantId, typeCache, cell(cols, row, 'type'));
    const categoryId = await ensureCategory(
      db,
      tenantId,
      catCache,
      cell(cols, row, 'category'),
      tradesRootId,
    );
    const unitRaw = cell(cols, row, 'unit');
    const unitTypeLookupId =
      kind === 'primitive' ? await ensureUnit(db, tenantId, unitCache, unitRaw || 'EA') : null;
    const archived = cell(cols, row, 'archived').toLowerCase() === 'true';
    const markupRaw = cell(cols, row, 'markup type').toLowerCase();
    const markupType =
      markupRaw === 'absolute' || markupRaw === 'fixed' ? 'fixed' : 'percent';

    pending.push({
      code,
      name,
      description: cell(cols, row, 'description') || null,
      kind,
      typeId,
      categoryId,
      unitTypeLookupId,
      unitCost: asNumeric(cell(cols, row, 'unit cost')),
      buyCost: asNumeric(cell(cols, row, 'buy cost')),
      markupType,
      markupValue: coerceToRateString(cell(cols, row, 'markup'), DEFAULT_MARKUP_RATE),
      taxRate: coerceToRateString(cell(cols, row, 'tax %'), DEFAULT_TAX_RATE),
      externalReference: id || null,
      providerCodes:
        tagging === 'ensure'
          ? providerCodesForEnsureCatalogItem(kind)
          : defaultProviderCodesForImport(importFormat, kind),
      parentCode: cell(cols, row, 'parent'),
      isActive: !archived,
    });
  }

  pending.sort((a, b) => {
    const rank = (k: string) => (k === 'scope' ? 0 : k === 'assembly' ? 1 : 2);
    return rank(a.kind) - rank(b.kind);
  });

  const idByCode = new Map<string, string>();
  const chunkSize = 50;
  for (let i = 0; i < pending.length; i += chunkSize) {
    const chunk = pending.slice(i, i + chunkSize);
    const inserted = await db
      .insert(schema.catalogItems)
      .values(
        chunk.map((item) => ({
          tenantId,
          catalogId,
          code: item.code,
          name: item.name,
          description: item.description,
          kind: item.kind,
          typeId: item.typeId,
          categoryId: item.categoryId,
          unitTypeLookupId: item.unitTypeLookupId,
          unitCost: item.unitCost,
          buyCost: item.buyCost,
          markupType: item.markupType,
          markupValue: item.markupValue,
          taxRate: item.taxRate,
          pricingMode: item.kind === 'scope' || item.kind === 'assembly' ? 'computed' : null,
          externalReference: item.externalReference,
          providerCodes: item.providerCodes,
          isActive: item.isActive,
          metadata: {},
        })),
      )
      .returning({ id: schema.catalogItems.id, code: schema.catalogItems.code });
    for (const row of inserted) {
      idByCode.set(row.code.toLowerCase(), row.id);
    }
  }

  const bomRows: Array<{
    tenantId: string;
    assemblyId: string;
    componentId: string;
    quantity: string;
    wasteFactor: string;
    sortIndex: number;
  }> = [];
  let sortIndex = 0;
  for (const item of pending) {
    if (!item.parentCode) continue;
    const parentId = idByCode.get(item.parentCode.toLowerCase());
    const childId = idByCode.get(item.code.toLowerCase());
    if (!parentId || !childId || parentId === childId) continue;
    bomRows.push({
      tenantId,
      assemblyId: parentId,
      componentId: childId,
      quantity: '1',
      wasteFactor: '1',
      sortIndex: sortIndex++,
    });
  }
  for (let i = 0; i < bomRows.length; i += chunkSize) {
    await db.insert(schema.catalogAssemblyComponents).values(bomRows.slice(i, i + chunkSize));
  }

  logger.info(
    `${LOG} catalog=${catalogId} items=${pending.length} bom=${bomRows.length}`,
  );
  return pending.length;
}

type ParsedCsv = { cols: Map<string, number>; rows: string[][] };

async function replaceForTenant(params: {
  db: SeedDb;
  tenantId: string;
  logger: SeedLogger;
  crunchwork: ParsedCsv;
  ensureScopes: ParsedCsv;
}): Promise<{ inserted: number; skipped: number; updated: number }> {
  const { db, tenantId, logger, crunchwork, ensureScopes } = params;

  await seedCatalogDevForTenant({ db, tenantId, logger });

  if (!forceReplace() && (await alreadyImported(db, tenantId))) {
    const updated = await retagEnsurePrimitives({ db, tenantId, logger });
    logger.info(
      `${LOG} skip tenant=${tenantId} — ${CW_CATALOG_NAME} already present` +
        (updated > 0 ? `; retaggedEnsurePrimitives=${updated}` : ''),
    );
    return { inserted: 0, skipped: 1, updated };
  }

  logger.info(`${LOG} replacing catalogues for tenant=${tenantId}`);
  await wipeTenantCatalogs(db, tenantId, logger);

  const [ensureCat] = await db
    .insert(schema.catalogs)
    .values({
      tenantId,
      name: ENSURE_CATALOG_NAME,
      description: 'Ensure internal default catalogue (scope line items)',
      type: 'internal',
      isActive: true,
      isDefault: true,
    })
    .returning({ id: schema.catalogs.id });

  await db.insert(schema.catalogs).values({
    tenantId,
    name: DEFAULT_CATALOG_NAME,
    description: 'Default item catalogue',
    type: 'internal',
    isActive: true,
    isDefault: false,
  });

  const [cwCat] = await db
    .insert(schema.catalogs)
    .values({
      tenantId,
      name: CW_CATALOG_NAME,
      description: 'IAG / Crunchwork catalog items export 2026-04-35',
      type: 'crunchwork',
      isActive: true,
      isDefault: false,
    })
    .returning({ id: schema.catalogs.id });

  const ensureCount = await importRows({
    db,
    tenantId,
    catalogId: ensureCat.id,
    importFormat: 'internal',
    tagging: 'ensure',
    cols: ensureScopes.cols,
    rows: ensureScopes.rows,
    logger,
  });
  const cwCount = await importRows({
    db,
    tenantId,
    catalogId: cwCat.id,
    importFormat: 'crunchwork',
    cols: crunchwork.cols,
    rows: crunchwork.rows,
    logger,
  });

  const updated = await retagEnsurePrimitives({ db, tenantId, logger });
  logger.info(
    `${LOG} tenant=${tenantId} ensureScopes=${ensureCount} crunchworkItems=${cwCount}`,
  );
  return { inserted: ensureCount + cwCount, skipped: 0, updated };
}

export async function replaceIagCatalogForAllTenants(params: {
  db: SeedDb;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const { db } = params;
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  function loadCsv(path: string): ParsedCsv {
    const parsed = parseCsv(readFileSync(path, 'utf8'));
    if (parsed.length < 2) {
      throw new Error(`${LOG} CSV has no data rows: ${path}`);
    }
    return { cols: colMap(parsed[0]), rows: parsed.slice(1) };
  }

  const cwPath = iagCrunchworkCatalogCsvPath();
  const ensurePath = iagEnsureScopesCsvPath();
  const crunchwork = loadCsv(cwPath);
  const ensureScopes = loadCsv(ensurePath);
  logger.info(
    `${LOG} loaded crunchworkRows=${crunchwork.rows.length} from ${cwPath}; ensureScopeRows=${ensureScopes.rows.length} from ${ensurePath}`,
  );

  const orgs = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      subscriptionStatus: schema.organizations.subscriptionStatus,
    })
    .from(schema.organizations);

  const tenants = orgs.filter((org) => org.subscriptionStatus !== 'ghost');
  const totals: SeedResult = { inserted: 0, updated: 0, skipped: 0 };
  for (const org of tenants) {
    logger.info(`${LOG} tenant=${org.name} (${org.id})`);
    const result = await replaceForTenant({
      db,
      tenantId: org.id,
      logger,
      crunchwork,
      ensureScopes,
    });
    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
  }
  totals.notes = `tenants=${tenants.length}`;
  return totals;
}

const seed: Seed = {
  name: 'iag-catalog',
  description:
    'Replace catalogues with the IAG Crunchwork 2026-04-35 export (idempotent)',
  run: (ctx: SeedContext) =>
    replaceIagCatalogForAllTenants({ db: ctx.db, logger: ctx.logger }),
};

export default seed;
