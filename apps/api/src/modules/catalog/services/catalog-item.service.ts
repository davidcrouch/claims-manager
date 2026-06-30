import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogCategoriesRepository,
  CatalogItemTypesRepository,
  CatalogItemsRepository,
} from '../../../database/repositories';
import { TenantContext } from '../../../tenant/tenant-context';
import type { CatalogItemKind, CatalogPricingMode } from '../catalog.utils';
import { CatalogPricingService } from './catalog-pricing.service';
import { CatalogAssemblyService } from './catalog-assembly.service';

@Injectable()
export class CatalogItemService {
  constructor(
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly typesRepo: CatalogItemTypesRepository,
    private readonly categoriesRepo: CatalogCategoriesRepository,
    private readonly pricingService: CatalogPricingService,
    private readonly assemblyService: CatalogAssemblyService,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async findMany(params: {
    catalogId?: string;
    kind?: CatalogItemKind;
    typeId?: string;
    categoryId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }) {
    const tenantId = this.getTenantId();
    let categoryIds: string[] | undefined;
    if (params.categoryId) {
      categoryIds = await this.categoriesRepo.findDescendantIds({
        tenantId,
        categoryId: params.categoryId,
      });
    }

    return this.itemsRepo.findMany({
      tenantId,
      catalogId: params.catalogId,
      kind: params.kind,
      typeId: params.typeId,
      categoryIds,
      search: params.search,
      page: params.page,
      limit: params.limit,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.getTenantId();
    const item = await this.itemsRepo.findById({ tenantId, id: params.id });
    if (!item) throw new NotFoundException('Catalog item not found');

    const components =
      item.kind === 'assembly'
        ? await this.assemblyService.findComponents({ assemblyId: item.id })
        : [];

    return { ...item, components };
  }

  async create(params: {
    code: string;
    name: string;
    description?: string;
    kind: CatalogItemKind;
    typeId: string;
    catalogId?: string;
    categoryId?: string;
    subCategoryId?: string;
    unitTypeLookupId?: string;
    unitCost?: string;
    buyCost?: string;
    markupType?: string;
    markupValue?: string;
    taxRate?: string;
    pricingMode?: CatalogPricingMode;
    fixedUnitCost?: string;
    externalReference?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    metadata?: Record<string, unknown>;
  }) {
    const tenantId = this.getTenantId();
    await this.validateTypeAndCategories(tenantId, params.typeId, params.categoryId, params.subCategoryId);

    if (params.kind === 'primitive' && !params.unitTypeLookupId) {
      throw new BadRequestException('Primitive items require a unit type');
    }
    if (params.kind === 'assembly' && !params.pricingMode) {
      params.pricingMode = 'computed';
    }

    const existing = await this.itemsRepo.findByCode({
      tenantId,
      code: params.code,
      catalogId: params.catalogId,
    });
    if (existing) throw new BadRequestException(`Catalog code already exists: ${params.code}`);

    const item = await this.itemsRepo.create({
      tenantId,
      data: {
        code: params.code,
        name: params.name,
        description: params.description,
        kind: params.kind,
        typeId: params.typeId,
        catalogId: params.catalogId,
        categoryId: params.categoryId,
        subCategoryId: params.subCategoryId,
        unitTypeLookupId: params.unitTypeLookupId,
        unitCost: params.unitCost,
        buyCost: params.buyCost,
        markupType: params.markupType,
        markupValue: params.markupValue,
        taxRate: params.taxRate,
        pricingMode: params.kind === 'assembly' ? (params.pricingMode ?? 'computed') : null,
        fixedUnitCost: params.fixedUnitCost,
        externalReference: params.externalReference,
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo,
        metadata: params.metadata ?? {},
        isActive: true,
      },
    });

    if (item.kind === 'assembly') {
      await this.pricingService.refreshComputedCost({ tenantId, assemblyId: item.id });
    }

    return this.findOne({ id: item.id });
  }

  async update(params: {
    id: string;
    code?: string;
    name?: string;
    description?: string;
    typeId?: string;
    categoryId?: string | null;
    subCategoryId?: string | null;
    unitTypeLookupId?: string;
    unitCost?: string;
    buyCost?: string;
    markupType?: string;
    markupValue?: string;
    taxRate?: string;
    pricingMode?: CatalogPricingMode;
    fixedUnitCost?: string;
    externalReference?: string;
    isActive?: boolean;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }) {
    const tenantId = this.getTenantId();
    const existing = await this.itemsRepo.findById({ tenantId, id: params.id });
    if (!existing) throw new NotFoundException('Catalog item not found');

    if (params.code && params.code !== existing.code) {
      const dup = await this.itemsRepo.findByCode({ tenantId, code: params.code });
      if (dup) throw new BadRequestException(`Catalog code already exists: ${params.code}`);
    }

    if (params.typeId || params.categoryId !== undefined || params.subCategoryId !== undefined) {
      await this.validateTypeAndCategories(
        tenantId,
        params.typeId ?? existing.typeId,
        params.categoryId ?? existing.categoryId ?? undefined,
        params.subCategoryId ?? existing.subCategoryId ?? undefined,
      );
    }

    const row = await this.itemsRepo.update({
      tenantId,
      id: params.id,
      data: {
        code: params.code,
        name: params.name,
        description: params.description,
        typeId: params.typeId,
        categoryId: params.categoryId,
        subCategoryId: params.subCategoryId,
        unitTypeLookupId: params.unitTypeLookupId,
        unitCost: params.unitCost,
        buyCost: params.buyCost,
        markupType: params.markupType,
        markupValue: params.markupValue,
        taxRate: params.taxRate,
        pricingMode: params.pricingMode,
        fixedUnitCost: params.fixedUnitCost,
        externalReference: params.externalReference,
        isActive: params.isActive,
        effectiveFrom: params.effectiveFrom,
        effectiveTo: params.effectiveTo,
      },
    });

    if (row?.kind === 'assembly') {
      await this.pricingService.refreshComputedCost({ tenantId, assemblyId: row.id });
      await this.assemblyService.refreshParentAssemblyCosts({ componentId: row.id });
    } else if (row) {
      await this.assemblyService.refreshParentAssemblyCosts({ componentId: row.id });
    }

    return this.findOne({ id: params.id });
  }

  async softDelete(params: { id: string }) {
    const tenantId = this.getTenantId();
    const row = await this.itemsRepo.softDelete({ tenantId, id: params.id });
    if (!row) throw new NotFoundException('Catalog item not found');
    return row;
  }

  async refreshCost(params: { id: string }) {
    const tenantId = this.getTenantId();
    const item = await this.itemsRepo.findById({ tenantId, id: params.id });
    if (!item) throw new NotFoundException('Catalog item not found');
    if (item.kind !== 'assembly') {
      throw new BadRequestException('Only assemblies support cost refresh');
    }
    return this.pricingService.refreshComputedCost({ tenantId, assemblyId: params.id });
  }

  private async validateTypeAndCategories(
    tenantId: string,
    typeId: string,
    categoryId?: string,
    subCategoryId?: string,
  ): Promise<void> {
    const type = await this.typesRepo.findById({ tenantId, id: typeId });
    if (!type) throw new BadRequestException('Invalid catalog item type');

    if (categoryId) {
      const category = await this.categoriesRepo.findById({ tenantId, id: categoryId });
      if (!category) throw new BadRequestException('Invalid category');
    }
    if (subCategoryId) {
      const sub = await this.categoriesRepo.findById({ tenantId, id: subCategoryId });
      if (!sub) throw new BadRequestException('Invalid sub-category');
    }
  }
}
