import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  CatalogItemsRepository,
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

const PREFIX = 'CatalogStructureService';
const UNCATEGORIZED = '__uncategorized__';

@Injectable()
export class CatalogStructureService {
  private readonly logger = new Logger(CatalogStructureService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly bomRepo: CatalogAssemblyComponentsRepository,
    private readonly pricingService: CatalogPricingService,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  private normalizeCategoryId(groupId: string): string | null {
    if (!groupId || groupId === UNCATEGORIZED) return null;
    return groupId;
  }

  /**
   * Move a catalogue line item between category / scope / assembly parents.
   * Follows the same hierarchy rules as estimate Take Off:
   * - scopes → category only
   * - assemblies → category or scope
   * - primitives → category, scope, or assembly
   */
  async moveLineItem(params: {
    itemId?: string;
    comboId?: string;
    targetGroupId: string;
    targetComboId?: string;
    insertAtIndex?: number;
  }) {
    const tenantId = this.getTenantId();
    if (!params.itemId && !params.comboId) {
      throw new BadRequestException('Either itemId or comboId must be provided');
    }

    const targetCategoryId = this.normalizeCategoryId(params.targetGroupId);
    const sortIndex = params.insertAtIndex ?? 0;

    if (params.itemId) {
      return this.moveItem({
        tenantId,
        itemOrLineId: params.itemId,
        targetCategoryId,
        targetComboId: params.targetComboId,
        sortIndex,
      });
    }

    return this.moveCombo({
      tenantId,
      comboId: params.comboId!,
      targetCategoryId,
      targetComboId: params.targetComboId,
      sortIndex,
    });
  }

  /**
   * Reorder siblings under the same parent. BOM parents persist sortIndex;
   * category-root reorder is a no-op for persistence (items have no sort column).
   */
  async reorderLineItems(params: {
    groupId: string;
    parentComboId?: string;
    items?: Array<{ id: string; sortIndex: number }>;
    combos?: Array<{ id: string; sortIndex: number }>;
    scopes?: Array<{ id: string; sortIndex: number }>;
  }) {
    const tenantId = this.getTenantId();

    if (params.parentComboId && params.items?.length) {
      for (const entry of params.items) {
        await this.bomRepo.update({
          tenantId,
          id: entry.id,
          data: { sortIndex: entry.sortIndex },
        });
      }
      await this.pricingService.refreshComputedCost({
        tenantId,
        assemblyId: params.parentComboId,
      });
      this.logger.debug(
        `${PREFIX}.reorderLineItems — reordered ${params.items.length} BOM lines under ${params.parentComboId}`,
      );
      return { success: true };
    }

    if (params.parentComboId && params.combos?.length) {
      // Nested assemblies under a scope — reorder by BOM line of the assembly component.
      for (const entry of params.combos) {
        await this.updateBomSortForComponent({
          tenantId,
          assemblyId: params.parentComboId,
          componentId: entry.id,
          sortIndex: entry.sortIndex,
        });
      }
      await this.pricingService.refreshComputedCost({
        tenantId,
        assemblyId: params.parentComboId,
      });
      return { success: true };
    }

    // Category-level reorder has no persisted sort on catalog_items.
    this.logger.debug(
      `${PREFIX}.reorderLineItems — category-level reorder ignored (no sort column)`,
    );
    return { success: true };
  }

  private async moveItem(params: {
    tenantId: string;
    itemOrLineId: string;
    targetCategoryId: string | null;
    targetComboId?: string;
    sortIndex: number;
  }) {
    const { tenantId, itemOrLineId, targetCategoryId, targetComboId, sortIndex } = params;

    // Nested BOM line?
    const [bomLine] = await this.db
      .select()
      .from(catalogAssemblyComponents)
      .where(
        and(
          eq(catalogAssemblyComponents.id, itemOrLineId),
          eq(catalogAssemblyComponents.tenantId, tenantId),
        ),
      )
      .limit(1);

    let catalogItemId: string;
    let sourceAssemblyId: string | null = null;
    let sourceLineId: string | null = null;

    if (bomLine) {
      catalogItemId = bomLine.componentId;
      sourceAssemblyId = bomLine.assemblyId;
      sourceLineId = bomLine.id;
    } else {
      const item = await this.itemsRepo.findById({ tenantId, id: itemOrLineId });
      if (!item) throw new NotFoundException('Catalogue item not found');
      if (item.kind !== 'primitive') {
        throw new BadRequestException('Use comboId when moving an assembly or scope');
      }
      catalogItemId = item.id;
      // May also be nested under a BOM with a different line id — find parents.
      const parentLines = await this.db
        .select()
        .from(catalogAssemblyComponents)
        .where(
          and(
            eq(catalogAssemblyComponents.tenantId, tenantId),
            eq(catalogAssemblyComponents.componentId, catalogItemId),
          ),
        );
      if (parentLines.length === 1) {
        sourceAssemblyId = parentLines[0].assemblyId;
        sourceLineId = parentLines[0].id;
      }
    }

    const item = await this.itemsRepo.findById({ tenantId, id: catalogItemId });
    if (!item) throw new NotFoundException('Catalogue item not found');

    if (targetComboId) {
      if (sourceLineId && sourceAssemblyId === targetComboId) {
        await this.bomRepo.update({
          tenantId,
          id: sourceLineId,
          data: { sortIndex },
        });
      } else {
        await this.assertCanNest({
          tenantId,
          parentId: targetComboId,
          componentId: catalogItemId,
          componentKind: item.kind,
        });
        if (sourceLineId && sourceAssemblyId) {
          await this.bomRepo.delete({ tenantId, id: sourceLineId });
          await this.pricingService.refreshComputedCost({
            tenantId,
            assemblyId: sourceAssemblyId,
          });
        }
        await this.bomRepo.create({
          tenantId,
          data: {
            assemblyId: targetComboId,
            componentId: catalogItemId,
            quantity: '1',
            wasteFactor: '1',
            sortIndex,
            isOptional: false,
          },
        });
        await this.pricingService.refreshComputedCost({
          tenantId,
          assemblyId: targetComboId,
        });
      }
    } else {
      // Move to category root — detach from any BOM parent.
      if (sourceLineId && sourceAssemblyId) {
        await this.bomRepo.delete({ tenantId, id: sourceLineId });
        await this.pricingService.refreshComputedCost({
          tenantId,
          assemblyId: sourceAssemblyId,
        });
      }
      await this.db
        .update(catalogItems)
        .set({ categoryId: targetCategoryId, updatedAt: new Date() })
        .where(and(eq(catalogItems.id, catalogItemId), eq(catalogItems.tenantId, tenantId)));
    }

    this.logger.log(
      `${PREFIX}.moveItem — moved ${catalogItemId} → category=${targetCategoryId ?? 'uncategorized'} combo=${targetComboId ?? 'none'}`,
    );
    return { success: true };
  }

  private async moveCombo(params: {
    tenantId: string;
    comboId: string;
    targetCategoryId: string | null;
    targetComboId?: string;
    sortIndex: number;
  }) {
    const { tenantId, comboId, targetCategoryId, targetComboId, sortIndex } = params;
    const combo = await this.itemsRepo.findById({ tenantId, id: comboId });
    if (!combo || !isCatalogBomParentKind(combo.kind)) {
      throw new NotFoundException('Assembly or scope not found');
    }

    if (combo.kind === 'scope' && targetComboId) {
      throw new BadRequestException('Scopes cannot be placed inside another combo');
    }

    // Find existing BOM membership (e.g. assembly under a scope).
    const parentLines = await this.db
      .select()
      .from(catalogAssemblyComponents)
      .where(
        and(
          eq(catalogAssemblyComponents.tenantId, tenantId),
          eq(catalogAssemblyComponents.componentId, comboId),
        ),
      );
    const sourceLine = parentLines[0] ?? null;

    if (targetComboId) {
      if (combo.kind !== 'assembly') {
        throw new BadRequestException('Only assemblies can be nested under a scope');
      }

      if (sourceLine?.assemblyId === targetComboId) {
        await this.bomRepo.update({
          tenantId,
          id: sourceLine.id,
          data: { sortIndex },
        });
      } else {
        await this.assertCanNest({
          tenantId,
          parentId: targetComboId,
          componentId: comboId,
          componentKind: combo.kind,
        });
        if (sourceLine) {
          await this.bomRepo.delete({ tenantId, id: sourceLine.id });
          await this.pricingService.refreshComputedCost({
            tenantId,
            assemblyId: sourceLine.assemblyId,
          });
        }
        await this.bomRepo.create({
          tenantId,
          data: {
            assemblyId: targetComboId,
            componentId: comboId,
            quantity: '1',
            wasteFactor: '1',
            sortIndex,
            isOptional: false,
          },
        });
        await this.pricingService.refreshComputedCost({
          tenantId,
          assemblyId: targetComboId,
        });
      }
    } else {
      if (sourceLine) {
        await this.bomRepo.delete({ tenantId, id: sourceLine.id });
        await this.pricingService.refreshComputedCost({
          tenantId,
          assemblyId: sourceLine.assemblyId,
        });
      }
      await this.db
        .update(catalogItems)
        .set({ categoryId: targetCategoryId, updatedAt: new Date() })
        .where(and(eq(catalogItems.id, comboId), eq(catalogItems.tenantId, tenantId)));
    }

    this.logger.log(
      `${PREFIX}.moveCombo — moved ${combo.kind} ${comboId} → category=${targetCategoryId ?? 'uncategorized'} combo=${targetComboId ?? 'none'}`,
    );
    return { success: true };
  }

  private async assertCanNest(params: {
    tenantId: string;
    parentId: string;
    componentId: string;
    componentKind: string;
  }) {
    const parent = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.parentId,
    });
    if (!parent || !isCatalogBomParentKind(parent.kind)) {
      throw new BadRequestException('Nest target must be an assembly or scope');
    }
    if (!isAllowedBomComponent(parent.kind, params.componentKind)) {
      throw new BadRequestException(
        bomComponentRuleMessage(parent.kind, params.componentKind),
      );
    }

    const [existing] = await this.db
      .select({ id: catalogAssemblyComponents.id })
      .from(catalogAssemblyComponents)
      .where(
        and(
          eq(catalogAssemblyComponents.tenantId, params.tenantId),
          eq(catalogAssemblyComponents.assemblyId, params.parentId),
          eq(catalogAssemblyComponents.componentId, params.componentId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        'This item already exists under the same parent in this catalogue',
      );
    }

    const cycle = await this.bomRepo.wouldCreateCycle({
      tenantId: params.tenantId,
      assemblyId: params.parentId,
      componentId: params.componentId,
    });
    if (cycle) {
      throw new BadRequestException('BOM change would create a circular reference');
    }
  }

  private async updateBomSortForComponent(params: {
    tenantId: string;
    assemblyId: string;
    componentId: string;
    sortIndex: number;
  }) {
    await this.db
      .update(catalogAssemblyComponents)
      .set({ sortIndex: params.sortIndex, updatedAt: new Date() })
      .where(
        and(
          eq(catalogAssemblyComponents.tenantId, params.tenantId),
          eq(catalogAssemblyComponents.assemblyId, params.assemblyId),
          eq(catalogAssemblyComponents.componentId, params.componentId),
        ),
      );
  }
}
