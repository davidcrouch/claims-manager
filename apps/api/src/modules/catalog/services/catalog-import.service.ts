import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CatalogsRepository,
  CatalogCategoriesRepository,
  CatalogItemTypesRepository,
  CatalogItemsRepository,
  CatalogAssemblyComponentsRepository,
  LookupsRepository,
} from '../../../database/repositories';
import { TenantContext } from '../../../tenant/tenant-context';
import { CatalogBootstrapService } from './catalog-bootstrap.service';
import { CatalogPricingService } from './catalog-pricing.service';
import { CatalogAssemblyService } from './catalog-assembly.service';
import type { CatalogItemKind, CatalogPricingMode } from '../catalog.utils';
import {
  DEFAULT_CATALOG_CATEGORIES,
  DEFAULT_UNIT_TYPES,
  coerceToRateString,
  defaultProviderCodesForImport,
  isCatalogBomParentKind,
} from '../catalog.utils';
import type { CatalogCategoryRow, CatalogItemRow } from '../../../database/repositories';
import type { CatalogType } from './catalogs.service';
import {
  detectImportFormat,
  parseCatalogItemKind,
  sortImportRowIndexes,
  validateBomParentChildKinds,
} from './catalog-import.utils';
import {
  catalogFilenameSlug,
  csvRow,
  formatCsvBool,
  formatCwMarkupType,
  formatMetadataCsvValue,
  formatRateForCsv,
  getNestedValue,
  kindSortRank,
  parseMetadataJson,
} from './catalog-export.utils';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface BomLineData {
  quantity: string;
  wasteFactor: string;
  sortIndex: number;
  isOptional: boolean;
  notes?: string;
}

// ── Column mapping profiles ─────────────────────────────────────

export interface ColumnMapping {
  csvHeader: string;
  aliases?: string[];
  target: 'column' | 'metadata' | 'bom';
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

/** Map CW export Type labels → internal type codes. */
const CW_TYPE_TO_CODE: Record<string, string> = {
  material: 'material',
  labour: 'labour',
  hire: 'equipment',
  equipment: 'equipment',
  vendor: 'vendor',
  other: 'other',
};

/** Map CW export Markup Type labels → internal markup codes. */
const CW_MARKUP_TO_CODE: Record<string, string> = {
  percentage: 'percent',
  percent: 'percent',
  absolute: 'fixed',
  fixed: 'fixed',
  none: 'none',
};

function normaliseImportTypeCode(raw: string): string {
  const key = raw.trim().toLowerCase();
  return CW_TYPE_TO_CODE[key] ?? key;
}

function normaliseImportMarkupType(raw: string): string {
  const key = raw.trim().toLowerCase();
  return CW_MARKUP_TO_CODE[key] ?? key;
}

const INTERNAL_PROFILE: ColumnMapping[] = [
  { csvHeader: 'id', target: 'column', field: 'itemId' },
  { csvHeader: 'code', target: 'column', field: 'code', required: true },
  { csvHeader: 'display_name', aliases: ['name'], target: 'column', field: 'name', required: true },
  { csvHeader: 'line_item_description', aliases: ['description'], target: 'column', field: 'description' },
  { csvHeader: 'kind', target: 'column', field: 'kind', required: true },
  { csvHeader: 'parent', aliases: ['parent_id', 'parent_code'], target: 'column', field: 'parentCode' },
  { csvHeader: 'parent_catalog', target: 'column', field: 'parentCatalog' },
  { csvHeader: 'type_code', target: 'column', field: 'type_code', required: true },
  { csvHeader: 'category_code', target: 'column', field: 'category_code' },
  { csvHeader: 'sub_category', aliases: ['sub_category_code'], target: 'column', field: 'sub_category_code' },
  { csvHeader: 'unit_type_ref', target: 'column', field: 'unit_type_ref' },
  { csvHeader: 'unit_cost', target: 'column', field: 'unitCost' },
  { csvHeader: 'buy_cost', target: 'column', field: 'buyCost' },
  { csvHeader: 'markup_type', target: 'column', field: 'markupType' },
  { csvHeader: 'markup_value', target: 'column', field: 'markupValue' },
  { csvHeader: 'tax_rate', target: 'column', field: 'taxRate' },
  { csvHeader: 'pricing_mode', target: 'column', field: 'pricingMode' },
  { csvHeader: 'fixed_unit_cost', target: 'column', field: 'fixedUnitCost' },
  { csvHeader: 'external_reference', target: 'column', field: 'externalReference' },
  { csvHeader: 'provider_codes', aliases: ['providers'], target: 'column', field: 'providerCodes', transform: toTagArray },
  { csvHeader: 'is_active', aliases: ['enabled'], target: 'column', field: 'isActive', transform: toBool },
  { csvHeader: 'archived', target: 'column', field: 'archived', transform: (v) => toBool(v) },
  { csvHeader: 'effective_from', target: 'column', field: 'effectiveFrom' },
  { csvHeader: 'effective_to', target: 'column', field: 'effectiveTo' },
  { csvHeader: 'source_catalog', target: 'column', field: 'sourceCatalog' },
  { csvHeader: 'source_code', target: 'column', field: 'sourceCode' },
  { csvHeader: 'quantity', target: 'bom', field: 'bomQuantity' },
  { csvHeader: 'waste_factor', target: 'bom', field: 'bomWasteFactor' },
  { csvHeader: 'sort_index', target: 'bom', field: 'bomSortIndex', transform: (v) => parseInt(v, 10) },
  { csvHeader: 'is_optional', target: 'bom', field: 'bomIsOptional', transform: toBool },
  { csvHeader: 'bom_notes', target: 'bom', field: 'bomNotes' },
  { csvHeader: 'metadata', target: 'column', field: 'metadataJson' },
];

const CRUNCHWORK_PROFILE: ColumnMapping[] = [
  { csvHeader: 'item_id', target: 'column', field: 'itemId' },
  { csvHeader: 'id', aliases: ['external_reference'], target: 'column', field: 'externalReference' },
  { csvHeader: 'code', target: 'column', field: 'code' },
  { csvHeader: 'name', aliases: ['display_name'], target: 'column', field: 'name', required: true },
  { csvHeader: 'description', aliases: ['line_item_description'], target: 'column', field: 'description' },
  { csvHeader: 'kind', target: 'column', field: 'kind' },
  { csvHeader: 'parent', aliases: ['parent_id', 'parent_code'], target: 'column', field: 'parentCode' },
  { csvHeader: 'parent_catalog', target: 'column', field: 'parentCatalog' },
  { csvHeader: 'type', aliases: ['type_code'], target: 'column', field: 'type_code', required: true },
  { csvHeader: 'category', aliases: ['category_code'], target: 'column', field: 'category_code' },
  { csvHeader: 'subcategory', aliases: ['sub_category_code'], target: 'column', field: 'sub_category_code' },
  { csvHeader: 'unit', aliases: ['unit_type_ref'], target: 'column', field: 'unit_type_ref' },
  { csvHeader: 'markup type', aliases: ['markup_type'], target: 'column', field: 'markupType' },
  { csvHeader: 'markup', aliases: ['markup_value'], target: 'column', field: 'markupValue' },
  { csvHeader: 'buy cost', aliases: ['buy_cost'], target: 'column', field: 'buyCost' },
  { csvHeader: 'unit cost', aliases: ['unit_cost'], target: 'column', field: 'unitCost' },
  { csvHeader: 'tax %', aliases: ['tax_rate'], target: 'column', field: 'taxRate' },
  { csvHeader: 'pricing_mode', target: 'column', field: 'pricingMode' },
  { csvHeader: 'fixed_unit_cost', target: 'column', field: 'fixedUnitCost' },
  { csvHeader: 'enabled', target: 'column', field: 'isActive', transform: (v) => toBool(v) },
  { csvHeader: 'archived', target: 'column', field: 'archived', transform: (v) => toBool(v) },
  { csvHeader: 'effective_from', target: 'column', field: 'effectiveFrom' },
  { csvHeader: 'effective_to', target: 'column', field: 'effectiveTo' },
  { csvHeader: 'source_catalog', target: 'column', field: 'sourceCatalog' },
  { csvHeader: 'source_code', target: 'column', field: 'sourceCode' },
  { csvHeader: 'quantity', target: 'bom', field: 'bomQuantity' },
  { csvHeader: 'waste_factor', target: 'bom', field: 'bomWasteFactor' },
  { csvHeader: 'sort_index', target: 'bom', field: 'bomSortIndex', transform: (v) => parseInt(v, 10) },
  { csvHeader: 'is_optional', target: 'bom', field: 'bomIsOptional', transform: toBool },
  { csvHeader: 'bom_notes', target: 'bom', field: 'bomNotes' },
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
  { csvHeader: 'provider_codes', aliases: ['providers'], target: 'column', field: 'providerCodes', transform: toTagArray },
  { csvHeader: 'category id', target: 'metadata', field: 'cwCategoryId' },
  { csvHeader: 'subcategory id', target: 'metadata', field: 'cwSubcategoryId' },
  { csvHeader: 'Ensure Scope Line Item', target: 'metadata', field: 'ensureScopeLineItem' },
  { csvHeader: 'metadata', target: 'column', field: 'metadataJson' },
];

const COLUMN_PROFILES: Record<string, ColumnMapping[]> = {
  internal: INTERNAL_PROFILE,
  crunchwork: CRUNCHWORK_PROFILE,
};

export function getCatalogCsvProfile(catalogType: string): ColumnMapping[] {
  return COLUMN_PROFILES[catalogType] ?? INTERNAL_PROFILE;
}

function getProfile(catalogType: string): ColumnMapping[] {
  return getCatalogCsvProfile(catalogType);
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
  unitsToCreate: string[];
  rows: CatalogImportPreviewRow[];
}

interface ImportParseContext {
  tenantId: string;
  catalogId: string | undefined;
  catalogType: CatalogType;
  /** Column profile in use — detected from CSV headers when possible. */
  importFormat: 'internal' | 'crunchwork';
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
    private readonly bomRepo: CatalogAssemblyComponentsRepository,
    private readonly assemblyService: CatalogAssemblyService,
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
      csv: `${header}\nGYPROCK-10,Gyprock 10mm sheet,"Supply 10mm plasterboard sheet 2400×1200 for wall or ceiling lining",primitive, material,plastering,ea,45.00,32.00,percent,15,10, ,\n`,
    };
  }

  async exportCsv(params: {
    catalogId: string;
    format?: 'internal' | 'crunchwork';
  }): Promise<{
    csv: string;
    filename: string;
    format: 'internal' | 'crunchwork';
    itemCount: number;
  }> {
    const tenantId = this.tenantContext.getTenantId();
    const catalog = await this.catalogsRepo.findById({ tenantId, id: params.catalogId });
    if (!catalog) {
      throw new NotFoundException(`Catalogue ${params.catalogId} not found`);
    }

    const format: 'internal' | 'crunchwork' =
      params.format ?? (catalog.type === 'crunchwork' ? 'crunchwork' : 'internal');
    const profile = getCatalogCsvProfile(format);

    const items: CatalogItemRow[] = [];
    let page = 1;
    const limit = 500;
    for (;;) {
      const batch = await this.itemsRepo.findMany({
        tenantId,
        catalogId: catalog.id,
        includeInactive: true,
        page,
        limit,
        sort: 'code_asc',
      });
      items.push(...batch.data);
      if (items.length >= batch.total || batch.data.length === 0) break;
      page += 1;
    }

    const [types, categories, units, bomRows, allCatalogs] = await Promise.all([
      this.typesRepo.findAll({ tenantId, activeOnly: false }),
      this.categoriesRepo.findAll({ tenantId, activeOnly: false }),
      this.lookupsRepo.findByDomain({ tenantId, domain: 'unit_type' }),
      this.bomRepo.findByCatalogId({ tenantId, catalogId: catalog.id }),
      this.catalogsRepo.findAll({ tenantId, activeOnly: false }),
    ]);

    const itemById = new Map(items.map((item) => [item.id, item]));
    const catalogById = new Map(allCatalogs.map((c) => [c.id, c]));

    // Build multi-parent map: componentId → BomEdge[]
    const bomByComponentId = new Map<string, typeof bomRows>();
    for (const line of bomRows) {
      const existing = bomByComponentId.get(line.componentId);
      if (existing) {
        existing.push(line);
      } else {
        bomByComponentId.set(line.componentId, [line]);
      }
    }

    // Resolve source item catalogue names for provenance
    const sourceItemIds = items
      .map((i) => i.sourceItemId)
      .filter((id): id is string => !!id);
    const sourceItemMap = new Map<string, { code: string; catalogName: string }>();
    for (const sourceId of sourceItemIds) {
      const sourceItem = await this.itemsRepo.findById({ tenantId, id: sourceId, includeDeleted: true });
      if (sourceItem?.catalogId) {
        const sourceCatalog = catalogById.get(sourceItem.catalogId);
        if (sourceCatalog) {
          sourceItemMap.set(sourceId, { code: sourceItem.code, catalogName: sourceCatalog.name });
        }
      }
    }

    const typeById = new Map(types.map((row) => [row.id, row]));
    const categoryById = new Map(categories.map((row) => [row.id, row]));
    const unitById = new Map(units.map((row) => [row.id, row]));

    const ranked = [...items].sort((a, b) => {
      const rank = kindSortRank(a.kind) - kindSortRank(b.kind);
      if (rank !== 0) return rank;
      return a.code.localeCompare(b.code);
    });

    const lines = [csvRow(profile.map((mapping) => mapping.csvHeader))];

    for (const item of ranked) {
      const bomEdges = bomByComponentId.get(item.id) ?? [];
      const type = typeById.get(item.typeId);
      const category = item.categoryId ? categoryById.get(item.categoryId) : undefined;
      const subCategory = item.subCategoryId ? categoryById.get(item.subCategoryId) : undefined;
      const unit = item.unitTypeLookupId ? unitById.get(item.unitTypeLookupId) : undefined;
      const meta = (item.metadata ?? {}) as Record<string, unknown>;
      const sourceInfo = item.sourceItemId ? sourceItemMap.get(item.sourceItemId) : undefined;

      const buildRow = (
        parentItem: CatalogItemRow | undefined,
        bomEdge: (typeof bomRows)[number] | undefined,
      ) => {
        const parentCatalogName =
          parentItem?.catalogId && parentItem.catalogId !== catalog.id
            ? catalogById.get(parentItem.catalogId)?.name ?? ''
            : '';
        const ensureScope =
          (typeof meta.ensureScopeLineItem === 'string' && meta.ensureScopeLineItem) ||
          (parentItem?.kind === 'scope' ? parentItem.name : '');

        const fieldValues: Record<string, string> = {
          itemId: item.id,
          code: item.code,
          name: item.name,
          description: item.description ?? '',
          kind: item.kind,
          parentCode: parentItem?.code ?? '',
          parentCatalog: parentCatalogName,
          type_code: type?.code ?? '',
          category_code: category?.code ?? '',
          sub_category_code: subCategory?.code ?? '',
          unit_type_ref: unit?.externalReference || unit?.name || '',
          unitCost: item.unitCost ?? '',
          buyCost: item.buyCost ?? '',
          markupType: item.markupType ?? '',
          markupValue: item.markupValue ?? '',
          taxRate: item.taxRate ?? '',
          pricingMode: item.pricingMode ?? '',
          fixedUnitCost: item.fixedUnitCost ?? '',
          externalReference: item.externalReference ?? '',
          providerCodes: (item.providerCodes ?? []).join(','),
          isActive: formatCsvBool(item.isActive),
          archived: formatCsvBool(!item.isActive),
          effectiveFrom: item.effectiveFrom ?? '',
          effectiveTo: item.effectiveTo ?? '',
          sourceCatalog: sourceInfo?.catalogName ?? '',
          sourceCode: sourceInfo?.code ?? '',
          metadataJson: Object.keys(meta).length > 0 ? JSON.stringify(meta) : '',
          ensureScopeLineItem: ensureScope,
          bomQuantity: bomEdge?.quantity ?? '',
          bomWasteFactor: bomEdge?.wasteFactor ?? '',
          bomSortIndex: bomEdge?.sortIndex != null ? String(bomEdge.sortIndex) : '',
          bomIsOptional: bomEdge ? formatCsvBool(bomEdge.isOptional) : '',
          bomNotes: bomEdge?.notes ?? '',
        };

        return profile.map((mapping) => {
          if (mapping.target === 'metadata') {
            if (mapping.field === 'ensureScopeLineItem') return fieldValues.ensureScopeLineItem;
            return formatMetadataCsvValue(getNestedValue(meta, mapping.field));
          }
          if (mapping.target === 'bom') {
            return fieldValues[mapping.field] ?? '';
          }
          if (mapping.field === 'externalReference' && format === 'crunchwork') {
            return item.externalReference || item.code;
          }
          if (mapping.field === 'markupType' && format === 'crunchwork') {
            return formatCwMarkupType(item.markupType);
          }
          if (mapping.field === 'type_code' && format === 'crunchwork') {
            return type?.name || type?.code || '';
          }
          if (mapping.field === 'markupValue') {
            return formatRateForCsv({
              value: item.markupValue,
              format,
              markupType: item.markupType,
              asPercentPoints: true,
            });
          }
          if (mapping.field === 'taxRate' && format === 'crunchwork') {
            return formatRateForCsv({
              value: item.taxRate,
              format,
              asPercentPoints: true,
            });
          }
          return fieldValues[mapping.field] ?? '';
        });
      };

      if (bomEdges.length === 0) {
        lines.push(csvRow(buildRow(undefined, undefined)));
      } else {
        for (const edge of bomEdges) {
          const parentItem = itemById.get(edge.assemblyId);
          lines.push(csvRow(buildRow(parentItem, edge)));
        }
      }
    }

    const filename = `${catalogFilenameSlug(catalog.name)}-${format}.csv`;
    this.logger.log(
      `CatalogImportService.exportCsv — catalogId=${catalog.id} format=${format} items=${ranked.length}`,
    );
    return { csv: `${lines.join('\n')}\n`, filename, format, itemCount: ranked.length };
  }

  async previewCsv(params: {
    csv: string;
    catalogId?: string;
  }): Promise<CatalogImportPreviewResult> {
    const ctx = await this.buildImportContext(params.csv, params.catalogId);
    const categoriesToCreate = new Set<string>();
    const unitsToCreate = new Set<string>();
    const previewRows: CatalogImportPreviewRow[] = [];
    const codesInFile = this.collectCodesInFile(ctx);

    for (let i = 1; i < ctx.rows.length; i++) {
      const preview = await this.previewRow(ctx, i, categoriesToCreate, unitsToCreate, codesInFile);
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
      unitsToCreate: [...unitsToCreate],
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

    const dataIndexes = Array.from({ length: ctx.rows.length - 1 }, (_, i) => i + 1);
    const orderedIndexes = sortImportRowIndexes({
      dataRowIndexes: dataIndexes,
      getCode: (rowIndex) => this.resolveCode(ctx, ctx.rows[rowIndex]),
      getParentCode: (rowIndex) => cellByField(ctx, ctx.rows[rowIndex], 'parentCode'),
    });

    const upsertedByCode = new Map<string, { id: string; kind: string; code: string }>();
    const parentsToRefresh = new Set<string>();

    for (const i of orderedIndexes) {
      const cells = ctx.rows[i];
      const code = this.resolveCode(ctx, cells);
      if (!code) {
        results.push({ row: i + 1, code: '', status: 'skipped', message: 'Empty code' });
        skipped++;
        continue;
      }

      try {
        const parentCode = cellByField(ctx, cells, 'parentCode');
        const alreadyUpserted = upsertedByCode.get(code.toLowerCase());

        // Multi-parent dedup: if this code was already upserted, skip item upsert and only create BOM edge
        if (alreadyUpserted && parentCode) {
          const bomData = this.extractBomData(ctx, cells);
          const link = await this.ensureBomParentLink({
            ctx,
            childCode: code,
            childId: alreadyUpserted.id,
            childKind: alreadyUpserted.kind,
            parentCode,
            upsertedByCode,
            bomData,
          });
          if (link.error) {
            results.push({ row: i + 1, code, status: 'error', message: link.error });
            errors++;
          } else {
            const msg = link.created ? `BOM edge to parent ${parentCode}` : `Already linked under ${parentCode}`;
            results.push({ row: i + 1, code, status: 'skipped', message: msg });
            skipped++;
            if (link.parentId) parentsToRefresh.add(link.parentId);
          }
          continue;
        }

        const rowData = await this.buildRowData(ctx, i, categoryByCode);

        // UUID preservation: only reuse id when it belongs to this catalogue (or is free).
        // Reusing an id from another catalogue in the same tenant would update the wrong
        // catalogue and break chunked imports (parents never appear in the target).
        const csvItemId = cellByField(ctx, cells, 'itemId');
        let preserveId = csvItemId && UUID_RE.test(csvItemId) ? csvItemId : undefined;

        let existing: CatalogItemRow | null = null;

        if (preserveId) {
          const byId = await this.itemsRepo.findById({
            tenantId: ctx.tenantId,
            id: preserveId,
            includeDeleted: true,
          });
          if (byId) {
            if (!ctx.catalogId || byId.catalogId === ctx.catalogId) {
              existing = byId;
            } else {
              // PK already used by another catalogue — create a new row in the target.
              preserveId = undefined;
            }
          }
        }
        if (!existing) {
          existing = await this.itemsRepo.findByCode({
            tenantId: ctx.tenantId,
            code,
            catalogId: ctx.catalogId,
          });
        }
        if (!existing) {
          const extRef = cellByField(ctx, cells, 'externalReference');
          if (extRef) {
            existing = await this.itemsRepo.findByExternalReference({
              tenantId: ctx.tenantId,
              externalReference: extRef,
              catalogId: ctx.catalogId,
            }) ?? null;
            if (existing) {
              await this.itemsRepo.update({ tenantId: ctx.tenantId, id: existing.id, data: { code } });
            }
          }
        }

        let itemId: string;
        let itemKind: string;

        if (existing) {
          await this.itemsRepo.update({ tenantId: ctx.tenantId, id: existing.id, data: rowData });
          itemId = existing.id;
          itemKind = rowData.kind;
          results.push({ row: i + 1, code, status: 'updated' });
          updated++;
        } else {
          const finalCode = await this.resolveUniqueImportCode({
            tenantId: ctx.tenantId,
            catalogId: ctx.catalogId,
            baseCode: code,
          });
          const insertData: Record<string, unknown> = {
            ...rowData,
            code: finalCode,
            catalogId: ctx.catalogId,
            isActive: true,
          };
          if (preserveId) {
            insertData.id = preserveId;
          }
          const row = await this.itemsRepo.create({
            tenantId: ctx.tenantId,
            data: insertData as Parameters<typeof this.itemsRepo.create>[0]['data'],
          });
          itemId = row.id;
          itemKind = row.kind;
          results.push({ row: i + 1, code: finalCode, status: 'created' });
          created++;
        }

        upsertedByCode.set(code.toLowerCase(), { id: itemId, kind: itemKind, code });

        if (parentCode) {
          const bomData = this.extractBomData(ctx, cells);
          const link = await this.ensureBomParentLink({
            ctx,
            childCode: code,
            childId: itemId,
            childKind: itemKind,
            parentCode,
            upsertedByCode,
            bomData,
          });
          if (link.error) {
            const last = results[results.length - 1];
            last.message = [last.message, link.error].filter(Boolean).join('; ');
            if (last.status === 'created') created--;
            else if (last.status === 'updated') updated--;
            last.status = 'error';
            errors++;
          } else if (link.parentId) {
            parentsToRefresh.add(link.parentId);
            if (link.created) {
              const last = results[results.length - 1];
              last.message = [last.message, `Linked under parent ${parentCode}`]
                .filter(Boolean)
                .join('; ');
            }
          }
        } else if (isCatalogBomParentKind(itemKind)) {
          parentsToRefresh.add(itemId);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`CatalogImportService.importCsv — row ${i + 1} failed: ${message}`);
        results.push({ row: i + 1, code, status: 'error', message });
        errors++;
      }
    }

    for (const assemblyId of parentsToRefresh) {
      try {
        await this.pricingService.refreshComputedCost({
          tenantId: ctx.tenantId,
          assemblyId,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `CatalogImportService.importCsv — refreshComputedCost failed for ${assemblyId}: ${message}`,
        );
      }
    }

    results.sort((a, b) => a.row - b.row);

    return { created, updated, skipped, errors, results };
  }

  private extractBomData(
    ctx: ImportParseContext,
    cells: string[],
  ): BomLineData {
    return {
      quantity: cellByField(ctx, cells, 'bomQuantity') || '1',
      wasteFactor: cellByField(ctx, cells, 'bomWasteFactor') || '1',
      sortIndex: (() => {
        const raw = cellByField(ctx, cells, 'bomSortIndex');
        const n = parseInt(raw, 10);
        return isNaN(n) ? 0 : n;
      })(),
      isOptional: (() => {
        const raw = cellByField(ctx, cells, 'bomIsOptional');
        return raw ? toBool(raw) : false;
      })(),
      notes: cellByField(ctx, cells, 'bomNotes') || undefined,
    };
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

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      throw new BadRequestException('CSV must include a header row and at least one data row');
    }

    const header = rows[0].map((h) => h.replace(/^\uFEFF/, '').trim().toLowerCase());
    const importFormat = detectImportFormat(header, catalogType);
    const profile = getProfile(importFormat);
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
        const alternatives = req.aliases?.length
          ? ` (or ${req.aliases.join(', ')})`
          : '';
        throw new BadRequestException(
          `CSV missing required column: ${req.csvHeader}${alternatives}`,
        );
      }
    }

    // Crunchwork CSVs identify rows by id (external ref) or code
    if (importFormat === 'crunchwork') {
      if (!colIndex.has('externalReference') && !colIndex.has('code')) {
        throw new BadRequestException(
          'CSV missing required column: id (or code)',
        );
      }
    }

    const types = await this.typesRepo.findAll({ tenantId, activeOnly: false });
    const categories = await this.categoriesRepo.findAll({ tenantId, activeOnly: false });
    const units = await this.lookupsRepo.findByDomain({ tenantId, domain: 'unit_type' });

    const unitByRef = new Map<string, { id: string }>();
    for (const u of units) {
      if (u.externalReference) unitByRef.set(u.externalReference.toLowerCase(), u);
      if (u.name) unitByRef.set(u.name.toLowerCase(), u);
    }

    this.logger.log(
      `CatalogImportService.buildImportContext — catalogType=${catalogType} importFormat=${importFormat} rows=${rows.length - 1} units=${units.length}`,
    );

    return {
      tenantId,
      catalogId,
      catalogType,
      importFormat,
      profile,
      header,
      colIndex,
      typeByCode: new Map(types.map((t) => [t.code.toLowerCase(), t])),
      categoryByCode: new Map(categories.map((c) => [c.code.toLowerCase(), c])),
      unitByRef,
      rows,
    };
  }

  private resolveCode(ctx: ImportParseContext, cells: string[]): string {
    if (ctx.importFormat === 'crunchwork') {
      const explicitCode = cellByField(ctx, cells, 'code');
      if (explicitCode) return explicitCode;

      const name = cellByField(ctx, cells, 'name');
      return name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || '';
    }
    return cellByField(ctx, cells, 'code');
  }

  private async resolveUniqueImportCode(params: {
    tenantId: string;
    catalogId?: string;
    baseCode: string;
  }): Promise<string> {
    const { tenantId, catalogId, baseCode } = params;
    const existing = await this.itemsRepo.findByCode({ tenantId, code: baseCode, catalogId });
    if (!existing) return baseCode;

    for (let i = 2; i <= 100; i++) {
      const candidate = `${baseCode}-${i}`;
      const dup = await this.itemsRepo.findByCode({ tenantId, code: candidate, catalogId });
      if (!dup) return candidate;
    }
    return `${baseCode}-${Date.now()}`;
  }

  private collectCodesInFile(ctx: ImportParseContext): Map<string, { kind: string }> {
    const codes = new Map<string, { kind: string }>();
    for (let i = 1; i < ctx.rows.length; i++) {
      const cells = ctx.rows[i];
      const code = this.resolveCode(ctx, cells);
      if (!code) continue;
      const kind =
        parseCatalogItemKind(cellByField(ctx, cells, 'kind'), ctx.importFormat) || 'primitive';
      codes.set(code.toLowerCase(), { kind });
    }
    return codes;
  }

  private async resolveItemByCodeOrExternalRef(params: {
    tenantId: string;
    catalogId?: string;
    code: string;
  }) {
    const byCode = await this.itemsRepo.findByCode({
      tenantId: params.tenantId,
      code: params.code,
      catalogId: params.catalogId,
    });
    if (byCode) return byCode;
    return this.itemsRepo.findByExternalReference({
      tenantId: params.tenantId,
      externalReference: params.code,
      catalogId: params.catalogId,
    });
  }

  private async ensureBomParentLink(params: {
    ctx: ImportParseContext;
    childCode: string;
    childId: string;
    childKind: string;
    parentCode: string;
    upsertedByCode: Map<string, { id: string; kind: string; code: string }>;
    bomData?: BomLineData;
  }): Promise<{ parentId?: string; created?: boolean; error?: string }> {
    const parentKey = params.parentCode.toLowerCase();
    let parent = params.upsertedByCode.get(parentKey) ?? null;

    if (!parent) {
      const row = await this.resolveItemByCodeOrExternalRef({
        tenantId: params.ctx.tenantId,
        catalogId: params.ctx.catalogId,
        code: params.parentCode,
      });
      if (row) {
        parent = { id: row.id, kind: row.kind, code: row.code };
        params.upsertedByCode.set(parentKey, parent);
        params.upsertedByCode.set(row.code.toLowerCase(), parent);
      }
    }

    if (!parent) {
      return { error: `Unknown parent: ${params.parentCode}` };
    }

    const kindError = validateBomParentChildKinds({
      parentKind: parent.kind,
      childKind: params.childKind,
    });
    if (kindError) return { error: kindError };

    const existingLines = await this.bomRepo.findByAssemblyId({
      tenantId: params.ctx.tenantId,
      assemblyId: parent.id,
    });
    if (existingLines.some((line) => line.componentId === params.childId)) {
      return { parentId: parent.id, created: false };
    }

    const bom = params.bomData ?? { quantity: '1', wasteFactor: '1', sortIndex: 0, isOptional: false };

    try {
      await this.assemblyService.addComponent({
        assemblyId: parent.id,
        componentId: params.childId,
        quantity: bom.quantity,
        wasteFactor: bom.wasteFactor,
        sortIndex: bom.sortIndex,
        isOptional: bom.isOptional,
        notes: bom.notes,
      });
      return { parentId: parent.id, created: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  }

  private async previewRow(
    ctx: ImportParseContext,
    rowIndex: number,
    categoriesToCreate: Set<string>,
    unitsToCreate: Set<string>,
    codesInFile: Map<string, { kind: string }>,
  ): Promise<CatalogImportPreviewRow> {
    const cells = ctx.rows[rowIndex];
    const rowNum = rowIndex + 1;

    const code = this.resolveCode(ctx, cells);
    const displayName = cellByField(ctx, cells, 'name');
    const description = cellByField(ctx, cells, 'description') || null;
    const typeCode = normaliseImportTypeCode(cellByField(ctx, cells, 'type_code'));
    const categoryCode = cellByField(ctx, cells, 'category_code') || null;
    const unitTypeRef = cellByField(ctx, cells, 'unit_type_ref') || null;
    const parentCode = cellByField(ctx, cells, 'parentCode') || null;

    const kind = parseCatalogItemKind(cellByField(ctx, cells, 'kind'), ctx.importFormat);

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

    if (kind !== 'primitive' && kind !== 'assembly' && kind !== 'scope') {
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
        unitsToCreate.add(unitTypeRef);
        warnings.push(`Unit type "${unitTypeRef}" will be created on import`);
      }
    }

    if (parentCode) {
      const parentInFile = codesInFile.get(parentCode.toLowerCase());
      const parentInDb = parentInFile
        ? null
        : await this.resolveItemByCodeOrExternalRef({
            tenantId: ctx.tenantId,
            catalogId: ctx.catalogId,
            code: parentCode,
          });
      const parentKind = parentInFile?.kind ?? parentInDb?.kind ?? '';
      if (!parentInFile && !parentInDb) {
        issues.push(`Unknown parent: ${parentCode}`);
      } else if (kind) {
        const kindError = validateBomParentChildKinds({
          parentKind,
          childKind: kind,
        });
        if (kindError) issues.push(kindError);
        else warnings.push(`Will link under parent ${parentCode}`);
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

    const kindRaw = cellByField(ctx, cells, 'kind');
    const kind: CatalogItemKind =
      parseCatalogItemKind(kindRaw, ctx.importFormat) || (kindRaw as CatalogItemKind);
    if (kind !== 'primitive' && kind !== 'assembly' && kind !== 'scope') {
      throw new Error(`Invalid kind: ${kind || '(missing)'}`);
    }

    const typeCode = normaliseImportTypeCode(cellByField(ctx, cells, 'type_code'));
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
    const unit = unitRef
      ? await this.resolveOrCreateUnit({
          tenantId: ctx.tenantId,
          unitRef,
          unitByRef: ctx.unitByRef,
        })
      : undefined;
    if (kind === 'primitive' && !unit) {
      throw new Error(`Primitive requires valid unit type: ${unitRef || '(missing)'}`);
    }

    const displayName = cellByField(ctx, cells, 'name');
    if (!displayName) throw new Error('Name is required');

    const metadata = this.buildMetadata(ctx, cells);

    const isActiveRaw = cellByField(ctx, cells, 'isActive');
    const archivedRaw = cellByField(ctx, cells, 'archived');
    const isActive = archivedRaw ? !toBool(archivedRaw) : (isActiveRaw ? toBool(isActiveRaw) : true);

    // Resolve source provenance
    const sourceCatalog = cellByField(ctx, cells, 'sourceCatalog');
    const sourceCode = cellByField(ctx, cells, 'sourceCode');
    let sourceItemId: string | undefined;
    if (sourceCatalog && sourceCode) {
      const srcCatalog = await this.catalogsRepo.findByName({
        tenantId: ctx.tenantId,
        name: sourceCatalog,
      });
      if (srcCatalog) {
        const srcItem = await this.itemsRepo.findByCode({
          tenantId: ctx.tenantId,
          code: sourceCode,
          catalogId: srcCatalog.id,
        });
        sourceItemId = srcItem?.id;
      }
    }

    const effectiveFrom = cellByField(ctx, cells, 'effectiveFrom') || undefined;
    const effectiveTo = cellByField(ctx, cells, 'effectiveTo') || undefined;

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
      markupType: (() => {
        const raw = cellByField(ctx, cells, 'markupType');
        return raw ? normaliseImportMarkupType(raw) : 'percent';
      })(),
      markupValue: (() => {
        const raw = cellByField(ctx, cells, 'markupValue');
        const markupType = (() => {
          const t = cellByField(ctx, cells, 'markupType');
          return t ? normaliseImportMarkupType(t) : 'percent';
        })();
        if (!raw) return '0.19';
        if (markupType === 'fixed' || markupType === 'absolute') return raw;
        return coerceToRateString(raw, 0.19);
      })(),
      taxRate: coerceToRateString(cellByField(ctx, cells, 'taxRate') || '10', 0.1),
      pricingMode: (cellByField(ctx, cells, 'pricingMode') ||
        (kind === 'assembly' || kind === 'scope' ? 'computed' : null)) as CatalogPricingMode | null,
      fixedUnitCost: cellByField(ctx, cells, 'fixedUnitCost') || undefined,
      externalReference: cellByField(ctx, cells, 'externalReference') || undefined,
      providerCodes: (() => {
        const raw = cellByField(ctx, cells, 'providerCodes');
        if (raw) {
          const tags = toTagArray(raw).map((c) => c.trim().toLowerCase()).filter(Boolean);
          return kind === 'scope' ? ['internal'] : tags;
        }
        return defaultProviderCodesForImport(ctx.importFormat, kind);
      })(),
      isActive,
      deletedAt: archivedRaw && toBool(archivedRaw) ? new Date() : undefined,
      sourceItemId,
      effectiveFrom,
      effectiveTo,
      metadata: Object.keys(metadata).length > 0 ? metadata : {},
    };
  }

  private buildMetadata(
    ctx: ImportParseContext,
    cells: string[],
  ): Record<string, unknown> {
    // Start with JSON metadata column if present (base layer)
    const jsonRaw = cellByField(ctx, cells, 'metadataJson');
    const base = parseMetadataJson(jsonRaw) ?? {};

    // Individual metadata columns override JSON blob values
    for (const mapping of ctx.profile) {
      if (mapping.target !== 'metadata') continue;
      const idx = ctx.colIndex.get(mapping.field);
      if (idx === undefined) continue;
      const raw = cellValue(cells, idx);
      if (!raw) continue;

      const value = mapping.transform ? mapping.transform(raw) : raw;
      setNestedValue(base, mapping.field, value);
    }

    return base;
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

  private async resolveOrCreateUnit(params: {
    tenantId: string;
    unitRef: string;
    unitByRef: Map<string, { id: string }>;
  }): Promise<{ id: string } | undefined> {
    const trimmed = params.unitRef.trim();
    if (!trimmed) return undefined;

    const key = trimmed.toLowerCase();
    const existing = params.unitByRef.get(key);
    if (existing) return existing;

    const known = DEFAULT_UNIT_TYPES.find(
      (u) =>
        u.externalReference.toLowerCase() === key || u.name.toLowerCase() === key,
    );

    const created = await this.lookupsRepo.create({
      tenantId: params.tenantId,
      data: {
        domain: 'unit_type',
        providerCode: 'crunchwork',
        name: known?.name ?? trimmed,
        externalReference: known?.externalReference ?? trimmed.toUpperCase(),
        isActive: true,
      },
    });

    params.unitByRef.set(key, created);
    if (created.externalReference) {
      params.unitByRef.set(created.externalReference.toLowerCase(), created);
    }
    if (created.name) {
      params.unitByRef.set(created.name.toLowerCase(), created);
    }

    this.logger.log(
      `CatalogImportService.resolveOrCreateUnit — auto-created unit_type ref=${trimmed}`,
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
  // Strip UTF-8 BOM (common in Excel / CW exports) so the first header matches
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

function cellValue(cells: string[], index: number): string {
  if (index < 0) return '';
  return (cells[index] ?? '').trim();
}
