import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  CatalogItemsRepository,
  CatalogsRepository,
  CatalogAssemblyComponentsRepository,
} from '../../../database/repositories';
import { catalogItems, catalogAssemblyComponents } from '../../../database/schema';
import { TenantContext } from '../../../tenant/tenant-context';
import {
  bomComponentRuleMessage,
  isAllowedBomComponent,
  isCatalogBomParentKind,
} from '../catalog.utils';
import { CatalogPricingService } from './catalog-pricing.service';

const PREFIX = 'CatalogCopyService';
const UNCATEGORIZED = '__uncategorized__';

@Injectable()
export class CatalogCopyService {
  private readonly logger = new Logger(CatalogCopyService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly catalogsRepo: CatalogsRepository,
    private readonly bomRepo: CatalogAssemblyComponentsRepository,
    private readonly pricingService: CatalogPricingService,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async copyItemToCatalog(params: {
    targetCatalogId: string;
    catalogItemId: string;
    parentId?: string;
    nestUnderId?: string;
  }) {
    const tenantId = this.getTenantId();

    const targetCatalog = await this.catalogsRepo.findById({
      tenantId,
      id: params.targetCatalogId,
    });
    if (!targetCatalog || !targetCatalog.isActive) {
      throw new NotFoundException('Target catalogue not found');
    }

    const sourceItem = await this.itemsRepo.findById({
      tenantId,
      id: params.catalogItemId,
    });
    if (!sourceItem || !sourceItem.isActive) {
      throw new NotFoundException('Source catalogue item not found');
    }

    const categoryId = this.normalizeCategoryId(params.parentId);
    const nestUnderId = params.nestUnderId;

    if (nestUnderId) {
      await this.assertNestTarget({
        tenantId,
        nestUnderId,
        componentKind: sourceItem.kind,
        sourceItemId: params.catalogItemId,
      });
    } else {
      await this.checkDuplicateAtCategory({
        tenantId,
        targetCatalogId: params.targetCatalogId,
        sourceItemId: params.catalogItemId,
        categoryId,
      });
    }

    const newItem = isCatalogBomParentKind(sourceItem.kind)
      ? await this.copyAssemblyOrScope({
          tenantId,
          sourceItem,
          targetCatalogId: params.targetCatalogId,
          categoryId,
        })
      : await this.copyPrimitive({
          tenantId,
          sourceItem,
          targetCatalogId: params.targetCatalogId,
          categoryId,
        });

    if (nestUnderId) {
      await this.bomRepo.create({
        tenantId,
        data: {
          assemblyId: nestUnderId,
          componentId: newItem.id,
          quantity: '1',
          wasteFactor: '1',
          sortIndex: 0,
          isOptional: false,
        },
      });
      await this.pricingService.refreshComputedCost({
        tenantId,
        assemblyId: nestUnderId,
      });
      this.logger.log(
        `${PREFIX}.copyItemToCatalog — nested ${newItem.id} under ${nestUnderId}`,
      );
    }

    return newItem;
  }

  private normalizeCategoryId(parentId?: string): string | null {
    if (!parentId || parentId === UNCATEGORIZED) return null;
    return parentId;
  }

  private async assertNestTarget(params: {
    tenantId: string;
    nestUnderId: string;
    componentKind: string;
    sourceItemId: string;
  }) {
    const parent = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.nestUnderId,
    });
    if (!parent || !isCatalogBomParentKind(parent.kind)) {
      throw new BadRequestException('Nest target must be an assembly or scope');
    }
    if (!isAllowedBomComponent(parent.kind, params.componentKind)) {
      throw new BadRequestException(
        bomComponentRuleMessage(parent.kind, params.componentKind),
      );
    }

    const bomLines = await this.bomRepo.findByAssemblyId({
      tenantId: params.tenantId,
      assemblyId: params.nestUnderId,
    });
    for (const line of bomLines) {
      if (line.componentId === params.sourceItemId) {
        throw new ConflictException(
          'This item already exists under the same parent in this catalogue',
        );
      }
      const component = await this.itemsRepo.findById({
        tenantId: params.tenantId,
        id: line.componentId,
      });
      if (component?.sourceItemId === params.sourceItemId) {
        throw new ConflictException(
          'This item already exists under the same parent in this catalogue',
        );
      }
    }
  }

  private async checkDuplicateAtCategory(params: {
    tenantId: string;
    targetCatalogId: string;
    sourceItemId: string;
    categoryId: string | null;
  }) {
    const conditions = [
      eq(catalogItems.tenantId, params.tenantId),
      eq(catalogItems.catalogId, params.targetCatalogId),
      eq(catalogItems.sourceItemId, params.sourceItemId),
      isNull(catalogItems.deletedAt),
    ];

    if (params.categoryId) {
      conditions.push(eq(catalogItems.categoryId, params.categoryId));
    } else {
      conditions.push(isNull(catalogItems.categoryId));
    }

    const [existing] = await this.db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      throw new ConflictException(
        'This item already exists under the same parent in this catalogue',
      );
    }
  }

  private async copyPrimitive(params: {
    tenantId: string;
    sourceItem: typeof catalogItems.$inferSelect;
    targetCatalogId: string;
    categoryId: string | null;
  }) {
    const { sourceItem, tenantId, targetCatalogId, categoryId } = params;
    const code = await this.resolveUniqueCode({
      tenantId,
      catalogId: targetCatalogId,
      baseCode: sourceItem.code,
    });

    const [newItem] = await this.db
      .insert(catalogItems)
      .values({
        tenantId,
        catalogId: targetCatalogId,
        code,
        name: sourceItem.name,
        description: sourceItem.description,
        kind: sourceItem.kind,
        typeId: sourceItem.typeId,
        categoryId: categoryId ?? sourceItem.categoryId,
        subCategoryId: sourceItem.subCategoryId,
        unitTypeLookupId: sourceItem.unitTypeLookupId,
        unitCost: sourceItem.unitCost,
        buyCost: sourceItem.buyCost,
        markupType: sourceItem.markupType,
        markupValue: sourceItem.markupValue,
        taxRate: sourceItem.taxRate,
        pricingMode: sourceItem.pricingMode,
        fixedUnitCost: sourceItem.fixedUnitCost,
        computedUnitCost: sourceItem.computedUnitCost,
        externalReference: sourceItem.externalReference,
        providerCodes: sourceItem.providerCodes,
        sourceItemId: sourceItem.id,
        effectiveFrom: sourceItem.effectiveFrom,
        effectiveTo: sourceItem.effectiveTo,
        metadata: sourceItem.metadata ?? {},
      })
      .returning();

    this.logger.log(
      `${PREFIX}.copyPrimitive — copied ${sourceItem.id} → ${newItem.id} into catalogue ${targetCatalogId}`,
    );

    return newItem;
  }

  private async copyAssemblyOrScope(params: {
    tenantId: string;
    sourceItem: typeof catalogItems.$inferSelect;
    targetCatalogId: string;
    categoryId: string | null;
  }) {
    const { sourceItem, tenantId, targetCatalogId, categoryId } = params;

    return this.db.transaction(async (tx) => {
      const code = await this.resolveUniqueCode({
        tenantId,
        catalogId: targetCatalogId,
        baseCode: sourceItem.code,
      });

      const [newItem] = await tx
        .insert(catalogItems)
        .values({
          tenantId,
          catalogId: targetCatalogId,
          code,
          name: sourceItem.name,
          description: sourceItem.description,
          kind: sourceItem.kind,
          typeId: sourceItem.typeId,
          categoryId: categoryId ?? sourceItem.categoryId,
          subCategoryId: sourceItem.subCategoryId,
          unitTypeLookupId: sourceItem.unitTypeLookupId,
          unitCost: sourceItem.unitCost,
          buyCost: sourceItem.buyCost,
          markupType: sourceItem.markupType,
          markupValue: sourceItem.markupValue,
          taxRate: sourceItem.taxRate,
          pricingMode: sourceItem.pricingMode,
          fixedUnitCost: sourceItem.fixedUnitCost,
          computedUnitCost: sourceItem.computedUnitCost,
          externalReference: sourceItem.externalReference,
          providerCodes: sourceItem.providerCodes,
          sourceItemId: sourceItem.id,
          effectiveFrom: sourceItem.effectiveFrom,
          effectiveTo: sourceItem.effectiveTo,
          metadata: sourceItem.metadata ?? {},
        })
        .returning();

      const bomLines = await this.bomRepo.findByAssemblyId({
        tenantId,
        assemblyId: sourceItem.id,
      });

      if (bomLines.length > 0) {
        await tx
          .insert(catalogAssemblyComponents)
          .values(
            bomLines.map((line) => ({
              tenantId,
              assemblyId: newItem.id,
              componentId: line.componentId,
              quantity: line.quantity,
              wasteFactor: line.wasteFactor,
              sortIndex: line.sortIndex,
              isOptional: line.isOptional,
              notes: line.notes,
            })),
          );
      }

      this.logger.log(
        `${PREFIX}.copyAssemblyOrScope — copied ${sourceItem.kind} ${sourceItem.id} → ${newItem.id} with ${bomLines.length} BOM lines into catalogue ${targetCatalogId}`,
      );

      return newItem;
    });
  }

  private async resolveUniqueCode(params: {
    tenantId: string;
    catalogId: string;
    baseCode: string;
  }): Promise<string> {
    const { tenantId, catalogId, baseCode } = params;

    const [existing] = await this.db
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(
        and(
          eq(catalogItems.tenantId, tenantId),
          eq(catalogItems.catalogId, catalogId),
          eq(catalogItems.code, baseCode),
          isNull(catalogItems.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) return baseCode;

    for (let i = 2; i <= 100; i++) {
      const candidate = `${baseCode}-${i}`;
      const [dup] = await this.db
        .select({ id: catalogItems.id })
        .from(catalogItems)
        .where(
          and(
            eq(catalogItems.tenantId, tenantId),
            eq(catalogItems.catalogId, catalogId),
            eq(catalogItems.code, candidate),
            isNull(catalogItems.deletedAt),
          ),
        )
        .limit(1);
      if (!dup) return candidate;
    }

    throw new BadRequestException(
      `Could not generate a unique code for "${baseCode}" in the target catalogue`,
    );
  }
}
