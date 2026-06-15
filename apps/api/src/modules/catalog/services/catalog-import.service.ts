import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
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

export const CATALOG_IMPORT_TEMPLATE = [
  'code',
  'display_name',
  'line_item_description',
  'kind',
  'type_code',
  'category_code',
  'unit_type_ref',
  'unit_cost',
  'buy_cost',
  'markup_type',
  'markup_value',
  'tax_rate',
  'pricing_mode',
  'fixed_unit_cost',
  'external_reference',
].join(',');

/** Resolve a column index supporting legacy and explicit header names. */
function resolveCol(header: string[], names: string[]): number {
  for (const name of names) {
    const idx = header.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
}

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
  header: string[];
  col: (name: string) => number;
  nameCol: number;
  descriptionCol: number;
  typeByCode: Map<string, { id: string; code: string }>;
  categoryByCode: Map<string, CatalogCategoryRow>;
  unitByRef: Map<string, { id: string }>;
  rows: string[][];
}

@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger('CatalogImportService');

  constructor(
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly typesRepo: CatalogItemTypesRepository,
    private readonly categoriesRepo: CatalogCategoriesRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly bootstrapService: CatalogBootstrapService,
    private readonly pricingService: CatalogPricingService,
    private readonly tenantContext: TenantContext,
  ) {}

  getTemplate(): { csv: string; columns: string[] } {
    const columns = CATALOG_IMPORT_TEMPLATE.split(',');
    return {
      columns,
      csv: `${CATALOG_IMPORT_TEMPLATE}\nGYPROCK-10,Gyprock 10mm sheet,"Supply 10mm plasterboard sheet 2400×1200 for wall or ceiling lining",primitive,material,plastering,ea,45.00,32.00,percent,15,0.10,,,\n`,
    };
  }

  async previewCsv(params: { csv: string }): Promise<CatalogImportPreviewResult> {
    const ctx = await this.buildImportContext(params.csv);
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

  async importCsv(params: { csv: string }): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    results: CatalogImportRowResult[];
  }> {
    const ctx = await this.buildImportContext(params.csv);
    const categoryByCode = new Map(ctx.categoryByCode);

    const results: CatalogImportRowResult[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < ctx.rows.length; i++) {
      const cells = ctx.rows[i];
      const code = cell(cells, ctx.col('code'));
      if (!code) {
        results.push({ row: i + 1, code: '', status: 'skipped', message: 'Empty code' });
        skipped++;
        continue;
      }

      try {
        const rowData = await this.buildRowData(ctx, i, categoryByCode);
        const existing = await this.itemsRepo.findByCode({ tenantId: ctx.tenantId, code });

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
            data: { ...rowData, code, isActive: true },
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

  private async buildImportContext(csv: string): Promise<ImportParseContext> {
    const tenantId = this.tenantContext.getTenantId();
    await this.bootstrapService.ensureDefaults({ tenantId });

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row');
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const nameCol = resolveCol(header, ['display_name', 'name']);
    const descriptionCol = resolveCol(header, ['line_item_description', 'description']);

    const required = ['code', 'kind', 'type_code'];
    for (const field of required) {
      if (col(field) < 0) {
        throw new BadRequestException(`CSV missing required column: ${field}`);
      }
    }
    if (nameCol < 0) {
      throw new BadRequestException(
        'CSV missing required column: display_name (or legacy name)',
      );
    }

    const types = await this.typesRepo.findAll({ tenantId, activeOnly: false });
    const categories = await this.categoriesRepo.findAll({ tenantId, activeOnly: false });
    const units = await this.lookupsRepo.findByDomain({ tenantId, domain: 'unit_type' });

    return {
      tenantId,
      header,
      col,
      nameCol,
      descriptionCol,
      typeByCode: new Map(types.map((t) => [t.code.toLowerCase(), t])),
      categoryByCode: new Map(categories.map((c) => [c.code.toLowerCase(), c])),
      unitByRef: new Map(
        units.map((u) => [(u.externalReference ?? u.name ?? '').toLowerCase(), u]),
      ),
      rows,
    };
  }

  private async previewRow(
    ctx: ImportParseContext,
    rowIndex: number,
    categoriesToCreate: Set<string>,
  ): Promise<CatalogImportPreviewRow> {
    const cells = ctx.rows[rowIndex];
    const rowNum = rowIndex + 1;
    const code = cell(cells, ctx.col('code'));
    const displayName = cell(cells, ctx.nameCol);
    const lineItemDescription = optionalCell(cells, ctx.descriptionCol) ?? null;
    const kind = cell(cells, ctx.col('kind'));
    const typeCode = cell(cells, ctx.col('type_code'));
    const categoryCode = ctx.col('category_code') >= 0 ? cell(cells, ctx.col('category_code')) : '';
    const unitTypeRef = ctx.col('unit_type_ref') >= 0 ? cell(cells, ctx.col('unit_type_ref')) : '';

    const base = {
      row: rowNum,
      code,
      displayName,
      lineItemDescription,
      kind,
      typeCode,
      categoryCode: categoryCode || null,
      unitTypeRef: unitTypeRef || null,
    };

    if (!code) {
      return {
        ...base,
        status: 'skipped',
        action: 'skip',
        message: 'Empty code',
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    if (kind !== 'primitive' && kind !== 'assembly') {
      issues.push(`Invalid kind: ${kind || '(missing)'}`);
    }

    if (!displayName) {
      issues.push('display_name is required');
    }

    if (!typeCode) {
      issues.push('type_code is required');
    } else if (!ctx.typeByCode.has(typeCode.toLowerCase())) {
      issues.push(`Unknown type_code: ${typeCode}`);
    }

    if (categoryCode && !ctx.categoryByCode.has(categoryCode.toLowerCase())) {
      categoriesToCreate.add(categoryCode);
      warnings.push(`Category "${categoryCode}" will be created on import`);
    }

    if (kind === 'primitive') {
      if (!unitTypeRef) {
        issues.push('Primitive requires unit_type_ref');
      } else if (!ctx.unitByRef.has(unitTypeRef.toLowerCase())) {
        issues.push(`Unknown unit_type_ref: ${unitTypeRef}`);
      }
    }

    if (issues.length > 0) {
      return {
        ...base,
        status: 'error',
        action: 'skip',
        message: issues.join('; '),
      };
    }

    const existing = await this.itemsRepo.findByCode({ tenantId: ctx.tenantId, code });
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
    const kind = cell(cells, ctx.col('kind')) as CatalogItemKind;
    if (kind !== 'primitive' && kind !== 'assembly') {
      throw new Error(`Invalid kind: ${kind}`);
    }

    const typeCode = cell(cells, ctx.col('type_code')).toLowerCase();
    const type = ctx.typeByCode.get(typeCode);
    if (!type) throw new Error(`Unknown type_code: ${typeCode}`);

    const categoryCode = ctx.col('category_code') >= 0 ? cell(cells, ctx.col('category_code')) : '';
    const category = categoryCode
      ? await this.resolveOrCreateCategory({
          tenantId: ctx.tenantId,
          categoryCode,
          categoryByCode,
        })
      : undefined;

    const unitRef = ctx.col('unit_type_ref') >= 0 ? cell(cells, ctx.col('unit_type_ref')) : '';
    const unit = unitRef ? ctx.unitByRef.get(unitRef.toLowerCase()) : undefined;
    if (kind === 'primitive' && !unit) {
      throw new Error(`Primitive requires valid unit_type_ref: ${unitRef || '(missing)'}`);
    }

    const displayName = cell(cells, ctx.nameCol);
    if (!displayName) {
      throw new Error('display_name is required');
    }

    return {
      name: displayName,
      description: optionalCell(cells, ctx.descriptionCol),
      kind,
      typeId: type.id,
      categoryId: category?.id,
      unitTypeLookupId: unit?.id,
      unitCost: optionalCell(cells, ctx.col('unit_cost')),
      buyCost: optionalCell(cells, ctx.col('buy_cost')),
      markupType: optionalCell(cells, ctx.col('markup_type')),
      markupValue: optionalCell(cells, ctx.col('markup_value')),
      taxRate: optionalCell(cells, ctx.col('tax_rate')),
      pricingMode: (optionalCell(cells, ctx.col('pricing_mode')) ??
        (kind === 'assembly' ? 'computed' : null)) as CatalogPricingMode | null,
      fixedUnitCost: optionalCell(cells, ctx.col('fixed_unit_cost')),
      externalReference: optionalCell(cells, ctx.col('external_reference')),
    };
  }

  /**
   * Resolve a category by code, auto-creating it (and default parents) when missing.
   * Unknown codes are created under the `trades` root when that hierarchy applies.
   */
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

function cell(cells: string[], index: number): string {
  if (index < 0) return '';
  return (cells[index] ?? '').trim();
}

function optionalCell(cells: string[], index: number): string | undefined {
  const value = cell(cells, index);
  return value || undefined;
}
