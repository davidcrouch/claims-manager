import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CatalogsRepository,
  CatalogCategoriesRepository,
  CatalogItemTypesRepository,
  CatalogItemsRepository,
  LookupsRepository,
} from '../../../database/repositories';
import { TenantContext } from '../../../tenant/tenant-context';
import { CatalogBootstrapService } from './catalog-bootstrap.service';
import { CatalogPricingService } from './catalog-pricing.service';
import type { CatalogItemKind, CatalogPricingMode } from '../catalog.utils';
import { DEFAULT_CATALOG_CATEGORIES } from '../catalog.utils';
import type { CatalogCategoryRow } from '../../../database/repositories';
import type { CatalogType } from './catalogs.service';

// ── Column mapping profiles ─────────────────────────────────────

export interface ColumnMapping {
  csvHeader: string;
  aliases?: string[];
  target: 'column' | 'metadata';
  field: string;
  required?: boolean;
  transform?: (value: string) => unknown;
}

function toBool(v: string): boolean {
  return v.toLowerCase() === 'true' || v === '1';
}

function toNumericOrNull(v: string): string | undefined {
  const n = parseFloat(v);
  return isNaN(n) ? undefined : String(n);
}

function toTagArray(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const INTERNAL_PROFILE: ColumnMapping[] = [
  { csvHeader: 'code', target: 'column', field: 'code', required: true },
  { csvHeader: 'display_name', aliases: ['name'], target: 'column', field: 'name', required: true },
  { csvHeader: 'line_item_description', aliases: ['description'], target: 'column', field: 'description' },
  { csvHeader: 'kind', target: 'column', field: 'kind', required: true },
  { csvHeader: 'type_code', target: 'column', field: 'type_code', required: true },
  { csvHeader: 'category_code', target: 'column', field: 'category_code' },
  { csvHeader: 'unit_type_ref', target: 'column', field: 'unit_type_ref' },
  { csvHeader: 'unit_cost', target: 'column', field: 'unitCost' },
  { csvHeader: 'buy_cost', target: 'column', field: 'buyCost' },
  { csvHeader: 'markup_type', target: 'column', field: 'markupType' },
  { csvHeader: 'markup_value', target: 'column', field: 'markupValue' },
  { csvHeader: 'tax_rate', target: 'column', field: 'taxRate' },
  { csvHeader: 'pricing_mode', target: 'column', field: 'pricingMode' },
  { csvHeader: 'fixed_unit_cost', target: 'column', field: 'fixedUnitCost' },
  { csvHeader: 'external_reference', target: 'column', field: 'externalReference' },
];

const CRUNCHWORK_PROFILE: ColumnMapping[] = [
  { csvHeader: 'id', target: 'column', field: 'externalReference', required: true },
  { csvHeader: 'name', target: 'column', field: 'name', required: true },
  { csvHeader: 'description', target: 'column', field: 'description' },
  { csvHeader: 'type', target: 'column', field: 'type_code', required: true },
  { csvHeader: 'category', target: 'column', field: 'category_code' },
  { csvHeader: 'subcategory', target: 'column', field: 'sub_category_code' },
  { csvHeader: 'unit', target: 'column', field: 'unit_type_ref' },
  { csvHeader: 'markup type', target: 'column', field: 'markupType' },
  { csvHeader: 'markup', target: 'column', field: 'markupValue' },
  { csvHeader: 'buy cost', target: 'column', field: 'buyCost' },
  { csvHeader: 'unit cost', target: 'column', field: 'unitCost' },
  { csvHeader: 'tax %', target: 'column', field: 'taxRate' },
  { csvHeader: 'enabled', target: 'column', field: 'isActive', transform: (v) => toBool(v) },
  { csvHeader: 'archived', target: 'column', field: 'archived', transform: (v) => toBool(v) },
  { csvHeader: 'default quantity', target: 'metadata', field: 'defaultQuantity', transform: toNumericOrNull },
  { csvHeader: 'pc/ps', target: 'metadata', field: 'pcPs' },
  { csvHeader: 'low limit pricing threshold', target: 'metadata', field: 'pricingThresholds.low', transform: toNumericOrNull },
  { csvHeader: 'high limit pricing threshold', target: 'metadata', field: 'pricingThresholds.high', transform: toNumericOrNull },
  { csvHeader: 'maximum limit pricing threshold', target: 'metadata', field: 'pricingThresholds.max', transform: toNumericOrNull },
  { csvHeader: 'use zone default buy cost', target: 'metadata', field: 'zoneDefaults.buyCost', transform: (v) => toBool(v) },
  { csvHeader: 'use zone default unit cost', target: 'metadata', field: 'zoneDefaults.unitCost', transform: (v) => toBool(v) },
  { csvHeader: 'description locked', target: 'metadata', field: 'locks.description', transform: (v) => toBool(v) },
  { csvHeader: 'markup locked', target: 'metadata', field: 'locks.markup', transform: (v) => toBool(v) },
  { csvHeader: 'qty locked', target: 'metadata', field: 'locks.qty', transform: (v) => toBool(v) },
  { csvHeader: 'buy locked', target: 'metadata', field: 'locks.buy', transform: (v) => toBool(v) },
  { csvHeader: 'unit locked', target: 'metadata', field: 'locks.unit', transform: (v) => toBool(v) },
  { csvHeader: 'tags', target: 'metadata', field: 'tags', transform: toTagArray },
  { csvHeader: 'category id', target: 'metadata', field: 'cwCategoryId' },
  { csvHeader: 'subcategory id', target: 'metadata', field: 'cwSubcategoryId' },
];

const COLUMN_PROFILES: Record<string, ColumnMapping[]> = {
  internal: INTERNAL_PROFILE,
  crunchwork: CRUNCHWORK_PROFILE,
};

function getProfile(catalogType: string): ColumnMapping[] {
  return COLUMN_PROFILES[catalogType] ?? INTERNAL_PROFILE;
}

function buildTemplateFromProfile(profile: ColumnMapping[]): string {
  return profile.map((m) => m.csvHeader).join(',');
}

// ── Shared types ─────────────────────────────────────────────────

export interface CatalogImportRowResult {
  row: number;
  code: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
}

export interface CatalogImportPreviewRow {
  row: number;
  code: string;
  displayName: string;
  lineItemDescription: string | null;
  kind: string;
  typeCode: string;
  categoryCode: string | null;
  unitTypeRef: string | null;
  status: 'ok' | 'warning' | 'error' | 'skipped';
  action: 'create' | 'update' | 'skip';
  message?: string;
}

export interface CatalogImportPreviewResult {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  willCreate: number;
  willUpdate: number;
  categoriesToCreate: string[];
  rows: CatalogImportPreviewRow[];
}

interface ImportParseContext {
  tenantId: string;
  catalogId: string | undefined;
  catalogType: CatalogType;
  profile: ColumnMapping[];
  header: string[];
  colIndex: Map<string, number>;
  typeByCode: Map<string, { id: string; code: string }>;
  categoryByCode: Map<string, CatalogCategoryRow>;
  unitByRef: Map<string, { id: string }>;
  rows: string[][];
}

// ── Service ──────────────────────────────────────────────────────

@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger('CatalogImportService');

  constructor(
    private readonly catalogsRepo: CatalogsRepository,
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly typesRepo: CatalogItemTypesRepository,
    private readonly categoriesRepo: CatalogCategoriesRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly bootstrapService: CatalogBootstrapService,
    private readonly pricingService: CatalogPricingService,
    private readonly tenantContext: TenantContext,
  ) {}

  getTemplate(catalogType?: string): { csv: string; columns: string[]; catalogType: string } {
    const type = catalogType ?? 'internal';
    const profile = getProfile(type);
    const header = buildTemplateFromProfile(profile);
    const columns = profile.map((m) => m.csvHeader);

    if (type === 'crunchwork') {
      return {
        catalogType: type,
        columns,
        csv: `${header}\n`,
      };
    }

    return {
      catalogType: type,
      columns,
      csv: `${header}\nGYPROCK-10,Gyprock 10mm sheet,"Supply 10mm plasterboard sheet 2400×1200 for wall or ceiling lining",primitive,material,plastering,ea,45.00,32.00,percent,15,0.10,,,\n`,
    };
  }

  async previewCsv(params: {
    csv: string;
    catalogId?: string;
  }): Promise<CatalogImportPreviewResult> {
    const ctx = await this.buildImportContext(params.csv, params.catalogId);
    const categoriesToCreate = new Set<string>();
    const previewRows: CatalogImportPreviewRow[] = [];

    for (let i = 1; i < ctx.rows.length; i++) {
      const preview = await this.previewRow(ctx, i, categoriesToCreate);
      previewRows.push(preview);
    }

    const validRows = previewRows.filter((r) => r.status === 'ok').length;
    const warningRows = previewRows.filter((r) => r.status === 'warning').length;
    const errorRows = previewRows.filter((r) => r.status === 'error').length;
    const skippedRows = previewRows.filter((r) => r.status === 'skipped').length;

    return {
      totalRows: previewRows.length,
      validRows,
      warningRows,
      errorRows,
      skippedRows,
      willCreate: previewRows.filter((r) => r.action === 'create').length,
      willUpdate: previewRows.filter((r) => r.action === 'update').length,
      categoriesToCreate: [...categoriesToCreate],
      rows: previewRows,
    };
  }

  async importCsv(params: {
    csv: string;
    catalogId?: string;
  }): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    results: CatalogImportRowResult[];
  }> {
    const ctx = await this.buildImportContext(params.csv, params.catalogId);
    const categoryByCode = new Map(ctx.categoryByCode);

    const results: CatalogImportRowResult[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < ctx.rows.length; i++) {
      const cells = ctx.rows[i];
      const code = this.resolveCode(ctx, cells);
      if (!code) {
        results.push({ row: i + 1, code: '', status: 'skipped', message: 'Empty code' });
        skipped++;
        continue;
      }

      try {
        const rowData = await this.buildRowData(ctx, i, categoryByCode);
        const existing = await this.itemsRepo.findByCode({
          tenantId: ctx.tenantId,
          code,
          catalogId: ctx.catalogId,
        });

        if (existing) {
          await this.itemsRepo.update({ tenantId: ctx.tenantId, id: existing.id, data: rowData });
          if (existing.kind === 'assembly') {
            await this.pricingService.refreshComputedCost({
              tenantId: ctx.tenantId,
              assemblyId: existing.id,
            });
          }
          results.push({ row: i + 1, code, status: 'updated' });
          updated++;
        } else {
          const row = await this.itemsRepo.create({
            tenantId: ctx.tenantId,
            data: { ...rowData, code, catalogId: ctx.catalogId, isActive: true },
          });
          if (row.kind === 'assembly') {
            await this.pricingService.refreshComputedCost({
              tenantId: ctx.tenantId,
              assemblyId: row.id,
            });
          }
          results.push({ row: i + 1, code, status: 'created' });
          created++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`CatalogImportService.importCsv — row ${i + 1} failed: ${message}`);
        results.push({ row: i + 1, code, status: 'error', message });
        errors++;
      }
    }

    return { created, updated, skipped, errors, results };
  }

  private async buildImportContext(
    csv: string,
    catalogId?: string,
  ): Promise<ImportParseContext> {
    const tenantId = this.tenantContext.getTenantId();
    await this.bootstrapService.ensureDefaults({ tenantId });

    let catalogType: CatalogType = 'internal';
    if (catalogId) {
      const catalog = await this.catalogsRepo.findById({ tenantId, id: catalogId });
      if (!catalog) throw new NotFoundException('Catalogue not found');
      catalogType = catalog.type as CatalogType;
    }

    const profile = getProfile(catalogType);
    const rows = parseCsv(csv);
    if (rows.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row');
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const colIndex = new Map<string, number>();
    for (const mapping of profile) {
      const allNames = [mapping.csvHeader, ...(mapping.aliases ?? [])];
      for (const name of allNames) {
        const idx = header.indexOf(name.toLowerCase());
        if (idx >= 0) {
          colIndex.set(mapping.field, idx);
          break;
        }
      }
    }

    const requiredFields = profile.filter((m) => m.required);
    for (const req of requiredFields) {
      if (!colIndex.has(req.field)) {
        throw new BadRequestException(
          `CSV missing required column: ${req.csvHeader}`,
        );
      }
    }

    const types = await this.typesRepo.findAll({ tenantId, activeOnly: false });
    const categories = await this.categoriesRepo.findAll({ tenantId, activeOnly: false });
    const units = await this.lookupsRepo.findByDomain({ tenantId, domain: 'unit_type' });

    return {
      tenantId,
      catalogId,
      catalogType,
      profile,
      header,
      colIndex,
      typeByCode: new Map(types.map((t) => [t.code.toLowerCase(), t])),
      categoryByCode: new Map(categories.map((c) => [c.code.toLowerCase(), c])),
      unitByRef: new Map(
        units.map((u) => [(u.externalReference ?? u.name ?? '').toLowerCase(), u]),
      ),
      rows,
    };
  }

  private resolveCode(ctx: ImportParseContext, cells: string[]): string {
    if (ctx.catalogType === 'crunchwork') {
      const nameIdx = ctx.colIndex.get('name');
      const name = nameIdx !== undefined ? cellValue(cells, nameIdx) : '';
      return name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || '';
    }
    const codeIdx = ctx.colIndex.get('code');
    return codeIdx !== undefined ? cellValue(cells, codeIdx) : '';
  }

  private async previewRow(
    ctx: ImportParseContext,
    rowIndex: number,
    categoriesToCreate: Set<string>,
  ): Promise<CatalogImportPreviewRow> {
    const cells = ctx.rows[rowIndex];
    const rowNum = rowIndex + 1;

    const code = this.resolveCode(ctx, cells);
    const displayName = cellByField(ctx, cells, 'name');
    const description = cellByField(ctx, cells, 'description') || null;
    const typeCode = cellByField(ctx, cells, 'type_code');
    const categoryCode = cellByField(ctx, cells, 'category_code') || null;
    const unitTypeRef = cellByField(ctx, cells, 'unit_type_ref') || null;

    const kind = ctx.catalogType === 'crunchwork' ? 'primitive' : cellByField(ctx, cells, 'kind');

    const base = {
      row: rowNum,
      code,
      displayName,
      lineItemDescription: description,
      kind,
      typeCode,
      categoryCode,
      unitTypeRef,
    };

    if (!code) {
      return { ...base, status: 'skipped', action: 'skip', message: 'Empty code' };
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    if (kind !== 'primitive' && kind !== 'assembly') {
      issues.push(`Invalid kind: ${kind || '(missing)'}`);
    }

    if (!displayName) {
      issues.push('Name is required');
    }

    if (!typeCode) {
      issues.push('Type is required');
    } else if (!ctx.typeByCode.has(typeCode.toLowerCase())) {
      issues.push(`Unknown type: ${typeCode}`);
    }

    if (categoryCode && !ctx.categoryByCode.has(categoryCode.toLowerCase())) {
      categoriesToCreate.add(categoryCode);
      warnings.push(`Category "${categoryCode}" will be created on import`);
    }

    if (kind === 'primitive') {
      if (!unitTypeRef) {
        issues.push('Primitive requires a unit type');
      } else if (!ctx.unitByRef.has(unitTypeRef.toLowerCase())) {
        issues.push(`Unknown unit type: ${unitTypeRef}`);
      }
    }

    if (issues.length > 0) {
      return { ...base, status: 'error', action: 'skip', message: issues.join('; ') };
    }

    const existing = await this.itemsRepo.findByCode({
      tenantId: ctx.tenantId,
      code,
      catalogId: ctx.catalogId,
    });

    return {
      ...base,
      status: warnings.length > 0 ? 'warning' : 'ok',
      action: existing ? 'update' : 'create',
      message: warnings.length > 0 ? warnings.join('; ') : undefined,
    };
  }

  private async buildRowData(
    ctx: ImportParseContext,
    rowIndex: number,
    categoryByCode: Map<string, CatalogCategoryRow>,
  ) {
    const cells = ctx.rows[rowIndex];

    const kind: CatalogItemKind =
      ctx.catalogType === 'crunchwork'
        ? 'primitive'
        : (cellByField(ctx, cells, 'kind') as CatalogItemKind);
    if (kind !== 'primitive' && kind !== 'assembly') {
      throw new Error(`Invalid kind: ${kind}`);
    }

    const typeCode = cellByField(ctx, cells, 'type_code').toLowerCase();
    const type = ctx.typeByCode.get(typeCode);
    if (!type) throw new Error(`Unknown type_code: ${typeCode}`);

    const categoryCode = cellByField(ctx, cells, 'category_code');
    const category = categoryCode
      ? await this.resolveOrCreateCategory({
          tenantId: ctx.tenantId,
          categoryCode,
          categoryByCode,
        })
      : undefined;

    const subCategoryCode = cellByField(ctx, cells, 'sub_category_code');
    const subCategory = subCategoryCode
      ? await this.resolveOrCreateCategory({
          tenantId: ctx.tenantId,
          categoryCode: subCategoryCode,
          categoryByCode,
        })
      : undefined;

    const unitRef = cellByField(ctx, cells, 'unit_type_ref');
    const unit = unitRef ? ctx.unitByRef.get(unitRef.toLowerCase()) : undefined;
    if (kind === 'primitive' && !unit) {
      throw new Error(`Primitive requires valid unit type: ${unitRef || '(missing)'}`);
    }

    const displayName = cellByField(ctx, cells, 'name');
    if (!displayName) throw new Error('Name is required');

    const metadata = this.buildMetadata(ctx, cells);

    const isActiveRaw = cellByField(ctx, cells, 'isActive');
    const archivedRaw = cellByField(ctx, cells, 'archived');
    const isActive = archivedRaw ? !toBool(archivedRaw) : (isActiveRaw ? toBool(isActiveRaw) : true);

    return {
      name: displayName,
      description: cellByField(ctx, cells, 'description') || undefined,
      kind,
      typeId: type.id,
      categoryId: category?.id,
      subCategoryId: subCategory?.id,
      unitTypeLookupId: unit?.id,
      unitCost: cellByField(ctx, cells, 'unitCost') || undefined,
      buyCost: cellByField(ctx, cells, 'buyCost') || undefined,
      markupType: cellByField(ctx, cells, 'markupType') || undefined,
      markupValue: cellByField(ctx, cells, 'markupValue') || undefined,
      taxRate: cellByField(ctx, cells, 'taxRate') || undefined,
      pricingMode: (cellByField(ctx, cells, 'pricingMode') ||
        (kind === 'assembly' ? 'computed' : null)) as CatalogPricingMode | null,
      fixedUnitCost: cellByField(ctx, cells, 'fixedUnitCost') || undefined,
      externalReference: cellByField(ctx, cells, 'externalReference') || undefined,
      isActive,
      deletedAt: archivedRaw && toBool(archivedRaw) ? new Date() : undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : {},
    };
  }

  private buildMetadata(
    ctx: ImportParseContext,
    cells: string[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const mapping of ctx.profile) {
      if (mapping.target !== 'metadata') continue;
      const idx = ctx.colIndex.get(mapping.field);
      if (idx === undefined) continue;
      const raw = cellValue(cells, idx);
      if (!raw) continue;

      const value = mapping.transform ? mapping.transform(raw) : raw;
      setNestedValue(result, mapping.field, value);
    }

    return result;
  }

  private async resolveOrCreateCategory(params: {
    tenantId: string;
    categoryCode: string;
    categoryByCode: Map<string, CatalogCategoryRow>;
  }): Promise<CatalogCategoryRow | undefined> {
    const trimmed = params.categoryCode.trim();
    if (!trimmed) return undefined;

    const key = trimmed.toLowerCase();
    const existing = params.categoryByCode.get(key);
    if (existing) return existing;

    const meta = findDefaultCategoryMeta(trimmed);
    let parentCategoryId: string | null = null;

    if (meta?.parentCode) {
      const parent = await this.resolveOrCreateCategory({
        tenantId: params.tenantId,
        categoryCode: meta.parentCode,
        categoryByCode: params.categoryByCode,
      });
      parentCategoryId = parent?.id ?? null;
    } else if (!meta?.isRoot) {
      const trades = await this.resolveOrCreateCategory({
        tenantId: params.tenantId,
        categoryCode: 'trades',
        categoryByCode: params.categoryByCode,
      });
      parentCategoryId = trades?.id ?? null;
    }

    const created = await this.categoriesRepo.create({
      tenantId: params.tenantId,
      data: {
        code: trimmed,
        name: meta?.name ?? humanizeCategoryCode(trimmed),
        parentCategoryId,
        sortIndex: meta?.sortIndex ?? params.categoryByCode.size,
        isActive: true,
      },
    });

    params.categoryByCode.set(key, created);
    this.logger.log(
      `CatalogImportService.resolveOrCreateCategory — auto-created category code=${trimmed}`,
    );
    return created;
  }
}

// ── Column profile helpers ────────────────────────────────────

function cellByField(ctx: ImportParseContext, cells: string[], field: string): string {
  const idx = ctx.colIndex.get(field);
  return idx !== undefined ? cellValue(cells, idx) : '';
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

// ── CSV parsing ──────────────────────────────────────────────

interface DefaultCategoryMeta {
  name: string;
  sortIndex: number;
  isRoot?: boolean;
  parentCode?: string;
}

function findDefaultCategoryMeta(code: string): DefaultCategoryMeta | undefined {
  const normalized = code.toLowerCase();
  for (const root of DEFAULT_CATALOG_CATEGORIES) {
    if (root.code.toLowerCase() === normalized) {
      return { name: root.name, sortIndex: root.sortIndex, isRoot: true };
    }
    for (const child of root.children) {
      if (child.code.toLowerCase() === normalized) {
        return {
          name: child.name,
          sortIndex: child.sortIndex,
          parentCode: root.code,
        };
      }
    }
  }
  return undefined;
}

function humanizeCategoryCode(code: string): string {
  return code
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function parseCsv(text: string): string[][] {
  return text
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

function cellValue(cells: string[], index: number): string {
  if (index < 0) return '';
  return (cells[index] ?? '').trim();
}
