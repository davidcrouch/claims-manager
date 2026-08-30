import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  CatalogCategoriesRepository,
  CatalogItemTypesRepository,
  CatalogItemsRepository,
  CatalogAssemblyComponentsRepository,
  LookupsRepository,
} from '../../../database/repositories';
import {
  catalogAssemblyComponents,
  purchaseOrderCombos,
  purchaseOrderGroups,
  purchaseOrderItems,
  quoteCombos,
  quoteGroups,
  quoteItems,
  workOrderCombos,
  workOrderGroups,
  workOrderItems,
} from '../../../database/schema';
import { TenantContext } from '../../../tenant/tenant-context';
import {
  buildComboPayload,
  buildItemSnapshotFields,
  catalogItemAllowsProvider,
  computeLineTotals,
  copyUnitCostToBuyCostForCrunchwork,
  formatDecimal,
  hoistProviderCombos,
  isCatalogBomParentKind,
  isPercentMarkupType,
  isScopeComboPayload,
  parentComboIdFromPayload,
  parseDecimal,
  rateToPercentPoints,
  coerceToRateString,
} from '../catalog.utils';
import { CatalogPricingService } from './catalog-pricing.service';
import {
  emptyLineItemsPage,
  paginateAssembledLineItems,
  type LineItemsPageQuery,
} from '../line-items-page';

/** Crunchwork Insurance REST API requires catalogItemId / catalogComboId as UUIDs. */
const CW_CATALOG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DocumentKind = 'quote' | 'purchase_order' | 'work_order';

const MARKUP_TYPE_MAP: Record<string, string> = {
  percent: 'Percentage',
  percentage: 'Percentage',
  fixed: 'Absolute',
  absolute: 'Absolute',
};

const CW_ITEM_TYPE_MAP: Record<string, string> = {
  material: 'Material',
  labour: 'Labour',
  equipment: 'Hire',
  hire: 'Hire',
  vendor: 'Other',
  other: 'Other',
};

function normaliseCwItemType(value: string | null | undefined): string | null {
  if (!value) return null;
  return CW_ITEM_TYPE_MAP[value.toLowerCase()] ?? value;
}

function normaliseCwMarkupType(value: string | null | undefined): string | null {
  if (!value || value === 'none') return null;
  return MARKUP_TYPE_MAP[value.toLowerCase()] ?? null;
}

@Injectable()
export class CatalogSelectionService {
  private readonly logger = new Logger(CatalogSelectionService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly typesRepo: CatalogItemTypesRepository,
    private readonly categoriesRepo: CatalogCategoriesRepository,
    private readonly bomRepo: CatalogAssemblyComponentsRepository,
    private readonly pricingService: CatalogPricingService,
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async addPrimitiveToQuote(params: {
    quoteGroupId?: string;
    quoteComboId?: string;
    catalogItemId: string;
    quantity: string;
  }) {
    if (!params.quoteGroupId && !params.quoteComboId) {
      throw new BadRequestException('quoteGroupId or quoteComboId is required');
    }
    if (params.quoteGroupId && params.quoteComboId) {
      throw new BadRequestException('Provide only one of quoteGroupId or quoteComboId');
    }

    const tenantId = this.getTenantId();
    const catalogItem = await this.itemsRepo.findById({
      tenantId,
      id: params.catalogItemId,
    });
    if (catalogItem && isCatalogBomParentKind(catalogItem.kind)) {
      let quoteGroupId = params.quoteGroupId;
      if (params.quoteComboId) {
        const [parent] = await this.db
          .select({
            id: quoteCombos.id,
            quoteGroupId: quoteCombos.quoteGroupId,
            comboPayload: quoteCombos.comboPayload,
          })
          .from(quoteCombos)
          .where(
            and(
              eq(quoteCombos.id, params.quoteComboId),
              eq(quoteCombos.tenantId, tenantId),
              isNull(quoteCombos.deletedAt),
            ),
          )
          .limit(1);
        if (!parent) throw new NotFoundException('Parent scope not found');
        if (!isScopeComboPayload(parent.comboPayload)) {
          throw new BadRequestException('Assemblies can only be nested under a scope');
        }
        quoteGroupId = parent.quoteGroupId;
      }
      if (!quoteGroupId) {
        throw new BadRequestException('quoteGroupId is required when adding an assembly or scope');
      }
      return this.addAssemblyToQuote({
        quoteGroupId,
        catalogAssemblyId: catalogItem.id,
        quantity: params.quantity,
        parentComboId: params.quoteComboId,
      });
    }

    const snapshot = await this.buildSnapshot({ tenantId, catalogItemId: params.catalogItemId });
    const totals = computeLineTotals({
      quantity: params.quantity,
      unitCost: snapshot.unitCost,
      taxRate: snapshot.tax,
    });

    const [row] = await this.db
      .insert(quoteItems)
      .values({
        tenantId,
        quoteGroupId: params.quoteGroupId ?? null,
        quoteComboId: params.quoteComboId ?? null,
        ...snapshot,
        quantity: params.quantity,
        totals,
      })
      .returning();

    return row;
  }

  async addAssemblyToQuote(params: {
    quoteGroupId: string;
    catalogAssemblyId: string;
    quantity: string;
    parentComboId?: string;
  }) {
    const tenantId = this.getTenantId();
    if (params.parentComboId) {
      const [parent] = await this.db
        .select({
          id: quoteCombos.id,
          quoteGroupId: quoteCombos.quoteGroupId,
          comboPayload: quoteCombos.comboPayload,
        })
        .from(quoteCombos)
        .where(
          and(
            eq(quoteCombos.id, params.parentComboId),
            eq(quoteCombos.tenantId, tenantId),
            isNull(quoteCombos.deletedAt),
          ),
        )
        .limit(1);
      if (!parent) throw new NotFoundException('Parent scope not found');
      if (!isScopeComboPayload(parent.comboPayload)) {
        throw new BadRequestException('Assemblies can only be nested under a scope');
      }
      if (parent.quoteGroupId !== params.quoteGroupId) {
        throw new BadRequestException('Parent scope does not belong to this group');
      }
    }
    return this.db.transaction(async (tx) => {
      const result = await this.explodeAssembly({
        tenantId,
        documentKind: 'quote',
        groupId: params.quoteGroupId,
        assemblyId: params.catalogAssemblyId,
        quantity: params.quantity,
        parentComboId: params.parentComboId,
        tx,
      });
      return result;
    });
  }

  async addPrimitiveToPurchaseOrder(params: {
    purchaseOrderGroupId?: string;
    purchaseOrderComboId?: string;
    catalogItemId: string;
    quantity: string;
  }) {
    if (!params.purchaseOrderGroupId && !params.purchaseOrderComboId) {
      throw new BadRequestException('purchaseOrderGroupId or purchaseOrderComboId is required');
    }

    const tenantId = this.getTenantId();
    const snapshot = await this.buildSnapshot({ tenantId, catalogItemId: params.catalogItemId });
    const totals = computeLineTotals({
      quantity: params.quantity,
      unitCost: snapshot.unitCost,
      taxRate: snapshot.tax,
    });

    const [row] = await this.db
      .insert(purchaseOrderItems)
      .values({
        tenantId,
        purchaseOrderGroupId: params.purchaseOrderGroupId ?? null,
        purchaseOrderComboId: params.purchaseOrderComboId ?? null,
        ...snapshot,
        quantity: params.quantity,
        totals,
      })
      .returning();

    return row;
  }

  async addAssemblyToPurchaseOrder(params: {
    purchaseOrderGroupId: string;
    catalogAssemblyId: string;
    quantity: string;
  }) {
    const tenantId = this.getTenantId();
    return this.db.transaction(async (tx) =>
      this.explodeAssembly({
        tenantId,
        documentKind: 'purchase_order',
        groupId: params.purchaseOrderGroupId,
        assemblyId: params.catalogAssemblyId,
        quantity: params.quantity,
        tx,
      }),
    );
  }

  async addPrimitiveToWorkOrder(params: {
    workOrderGroupId?: string;
    workOrderComboId?: string;
    catalogItemId: string;
    quantity: string;
  }) {
    if (!params.workOrderGroupId && !params.workOrderComboId) {
      throw new BadRequestException('workOrderGroupId or workOrderComboId is required');
    }

    const tenantId = this.getTenantId();
    const snapshot = await this.buildSnapshot({ tenantId, catalogItemId: params.catalogItemId });
    const totals = computeLineTotals({
      quantity: params.quantity,
      unitCost: snapshot.unitCost,
      taxRate: snapshot.tax,
    });

    const [row] = await this.db
      .insert(workOrderItems)
      .values({
        tenantId,
        workOrderGroupId: params.workOrderGroupId ?? null,
        workOrderComboId: params.workOrderComboId ?? null,
        ...snapshot,
        quantity: params.quantity,
        totals,
      })
      .returning();

    return row;
  }

  async addAssemblyToWorkOrder(params: {
    workOrderGroupId: string;
    catalogAssemblyId: string;
    quantity: string;
  }) {
    const tenantId = this.getTenantId();
    return this.db.transaction(async (tx) =>
      this.explodeAssembly({
        tenantId,
        documentKind: 'work_order',
        groupId: params.workOrderGroupId,
        assemblyId: params.catalogAssemblyId,
        quantity: params.quantity,
        tx,
      }),
    );
  }

  async listQuoteGroups(params: { quoteId: string }) {
    const tenantId = this.getTenantId();
    return this.db
      .select()
      .from(quoteGroups)
      .where(
        and(eq(quoteGroups.tenantId, tenantId), eq(quoteGroups.quoteId, params.quoteId)),
      )
      .orderBy(quoteGroups.sortIndex);
  }

  async ensureDefaultQuoteGroup(params: { quoteId: string; description?: string }) {
    const existing = await this.listQuoteGroups({ quoteId: params.quoteId });
    if (existing.length > 0) return existing[0];

    const tenantId = this.getTenantId();
    const [row] = await this.db
      .insert(quoteGroups)
      .values({
        tenantId,
        quoteId: params.quoteId,
        description: params.description ?? 'Default group',
        sortIndex: 0,
      })
      .returning();
    return row;
  }

  async createQuoteGroup(params: {
    quoteId: string;
    groupLabelLookupId?: string;
    description?: string;
  }) {
    const tenantId = this.getTenantId();
    const existing = await this.listQuoteGroups({ quoteId: params.quoteId });
    const nextIndex = existing.length > 0
      ? Math.max(...existing.map((g) => g.sortIndex)) + 1
      : 0;

    const [row] = await this.db
      .insert(quoteGroups)
      .values({
        tenantId,
        quoteId: params.quoteId,
        groupLabelLookupId: params.groupLabelLookupId ?? null,
        description: params.description ?? null,
        sortIndex: nextIndex,
      })
      .returning();
    return row;
  }

  async updateQuoteGroup(params: {
    quoteId: string;
    groupId: string;
    groupLabelLookupId?: string;
    description?: string;
    dimensions?: Record<string, unknown>;
  }) {
    const tenantId = this.getTenantId();
    const [existing] = await this.db
      .select()
      .from(quoteGroups)
      .where(
        and(
          eq(quoteGroups.id, params.groupId),
          eq(quoteGroups.quoteId, params.quoteId),
          eq(quoteGroups.tenantId, tenantId),
        ),
      );
    if (!existing) throw new NotFoundException('Quote group not found');

    const updates: Record<string, unknown> = {};
    if (params.groupLabelLookupId !== undefined) updates.groupLabelLookupId = params.groupLabelLookupId || null;
    if (params.description !== undefined) updates.description = params.description || null;
    if (params.dimensions !== undefined) updates.dimensions = params.dimensions;

    if (Object.keys(updates).length === 0) return existing;

    const [row] = await this.db
      .update(quoteGroups)
      .set(updates)
      .where(eq(quoteGroups.id, params.groupId))
      .returning();
    return row;
  }

  async deleteQuoteGroup(params: { quoteId: string; groupId: string }) {
    const tenantId = this.getTenantId();
    const allGroups = await this.listQuoteGroups({ quoteId: params.quoteId });
    const target = allGroups.find((g) => g.id === params.groupId);
    if (!target) throw new NotFoundException('Quote group not found');

    const itemCount = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(quoteItems)
      .where(
        and(
          eq(quoteItems.tenantId, tenantId),
          eq(quoteItems.quoteGroupId, params.groupId),
          isNull(quoteItems.deletedAt),
        ),
      );

    const comboCount = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(quoteCombos)
      .where(
        and(
          eq(quoteCombos.tenantId, tenantId),
          eq(quoteCombos.quoteGroupId, params.groupId),
          isNull(quoteCombos.deletedAt),
        ),
      );

    const totalChildren = (itemCount[0]?.count ?? 0) + (comboCount[0]?.count ?? 0);
    if (allGroups.length <= 1 && totalChildren > 0) {
      throw new BadRequestException(
        'Cannot delete the only group when it contains line items — move or delete items first',
      );
    }

    await this.db.delete(quoteGroups).where(eq(quoteGroups.id, params.groupId));
    return { deleted: true, childrenRemoved: totalChildren };
  }

  async deleteQuoteItem(params: { quoteId: string; itemId: string; removeFromCatalogAssembly?: boolean }) {
    const tenantId = this.getTenantId();
    const [item] = await this.db
      .select({
        id: quoteItems.id,
        quoteComboId: quoteItems.quoteComboId,
        catalogItemId: quoteItems.catalogItemId,
      })
      .from(quoteItems)
      .where(
        and(
          eq(quoteItems.id, params.itemId),
          eq(quoteItems.tenantId, tenantId),
          isNull(quoteItems.deletedAt),
        ),
      );
    if (!item) throw new NotFoundException('Quote item not found');

    await this.db
      .update(quoteItems)
      .set({ deletedAt: new Date() })
      .where(eq(quoteItems.id, params.itemId));

    let removedFromCatalog = false;
    if (params.removeFromCatalogAssembly && item.quoteComboId && item.catalogItemId) {
      const [combo] = await this.db
        .select({ catalogComboId: quoteCombos.catalogComboId })
        .from(quoteCombos)
        .where(eq(quoteCombos.id, item.quoteComboId));

      if (combo?.catalogComboId) {
        const deleted = await this.db
          .delete(catalogAssemblyComponents)
          .where(
            and(
              eq(catalogAssemblyComponents.tenantId, tenantId),
              eq(catalogAssemblyComponents.assemblyId, combo.catalogComboId),
              eq(catalogAssemblyComponents.componentId, item.catalogItemId),
            ),
          )
          .returning({ id: catalogAssemblyComponents.id });
        removedFromCatalog = deleted.length > 0;
      }
    }

    return { deleted: true, removedFromCatalog };
  }

  async deleteQuoteCombo(params: { quoteId: string; comboId: string }) {
    const tenantId = this.getTenantId();
    const [combo] = await this.db
      .select({ id: quoteCombos.id, quoteGroupId: quoteCombos.quoteGroupId })
      .from(quoteCombos)
      .where(
        and(
          eq(quoteCombos.id, params.comboId),
          eq(quoteCombos.tenantId, tenantId),
          isNull(quoteCombos.deletedAt),
        ),
      );
    if (!combo) throw new NotFoundException('Quote assembly not found');

    const siblingCombos = await this.db
      .select({ id: quoteCombos.id, comboPayload: quoteCombos.comboPayload })
      .from(quoteCombos)
      .where(
        and(
          eq(quoteCombos.tenantId, tenantId),
          eq(quoteCombos.quoteGroupId, combo.quoteGroupId),
          isNull(quoteCombos.deletedAt),
        ),
      );
    for (const child of siblingCombos) {
      if (child.id === params.comboId) continue;
      if (parentComboIdFromPayload(child.comboPayload) !== params.comboId) continue;
      await this.deleteQuoteCombo({ quoteId: params.quoteId, comboId: child.id });
    }

    await this.db
      .update(quoteCombos)
      .set({ deletedAt: new Date() })
      .where(eq(quoteCombos.id, params.comboId));

    await this.db
      .update(quoteItems)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(quoteItems.quoteComboId, params.comboId),
          eq(quoteItems.tenantId, tenantId),
          isNull(quoteItems.deletedAt),
        ),
      );

    return { deleted: true };
  }

  async reorderQuoteGroups(params: { quoteId: string; groupIds: string[] }) {
    const tenantId = this.getTenantId();
    const existing = await this.listQuoteGroups({ quoteId: params.quoteId });
    const existingIds = new Set(existing.map((g) => g.id));

    for (const id of params.groupIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(`Group ${id} does not belong to this quote`);
      }
    }

    await Promise.all(
      params.groupIds.map((id, index) =>
        this.db
          .update(quoteGroups)
          .set({ sortIndex: index })
          .where(
            and(
              eq(quoteGroups.id, id),
              eq(quoteGroups.tenantId, tenantId),
            ),
          ),
      ),
    );

    return this.listQuoteGroups({ quoteId: params.quoteId });
  }

  async reorderQuoteLineItems(params: {
    quoteId: string;
    items?: Array<{ id: string; sortIndex: number }>;
    combos?: Array<{ id: string; sortIndex: number }>;
  }) {
    const tenantId = this.getTenantId();
    const logPrefix = 'CatalogSelectionService.reorderQuoteLineItems';

    await this.db.transaction(async (tx) => {
      if (params.items && params.items.length > 0) {
        for (const entry of params.items) {
          await tx
            .update(quoteItems)
            .set({ sortIndex: entry.sortIndex, updatedAt: new Date() })
            .where(
              and(eq(quoteItems.id, entry.id), eq(quoteItems.tenantId, tenantId), isNull(quoteItems.deletedAt)),
            );
        }
        this.logger.debug(`${logPrefix} — reordered ${params.items.length} items`);
      }

      if (params.combos && params.combos.length > 0) {
        for (const entry of params.combos) {
          await tx
            .update(quoteCombos)
            .set({ sortIndex: entry.sortIndex, updatedAt: new Date() })
            .where(
              and(eq(quoteCombos.id, entry.id), eq(quoteCombos.tenantId, tenantId), isNull(quoteCombos.deletedAt)),
            );
        }
        this.logger.debug(`${logPrefix} — reordered ${params.combos.length} combos`);
      }
    });

    return { success: true };
  }

  async moveQuoteLineItem(params: {
    quoteId: string;
    itemId?: string;
    comboId?: string;
    targetGroupId: string;
    targetComboId?: string;
    insertAtIndex?: number;
  }) {
    const tenantId = this.getTenantId();
    const logPrefix = 'CatalogSelectionService.moveQuoteLineItem';

    if (!params.itemId && !params.comboId) {
      throw new BadRequestException('Either itemId or comboId must be provided');
    }

    const [targetGroup] = await this.db
      .select({ id: quoteGroups.id })
      .from(quoteGroups)
      .where(
        and(
          eq(quoteGroups.id, params.targetGroupId),
          eq(quoteGroups.tenantId, tenantId),
          eq(quoteGroups.quoteId, params.quoteId),
        ),
      )
      .limit(1);
    if (!targetGroup) throw new NotFoundException('Target group not found');

    if (params.targetComboId) {
      const [targetCombo] = await this.db
        .select({ id: quoteCombos.id, comboPayload: quoteCombos.comboPayload })
        .from(quoteCombos)
        .where(
          and(
            eq(quoteCombos.id, params.targetComboId),
            eq(quoteCombos.tenantId, tenantId),
            isNull(quoteCombos.deletedAt),
          ),
        )
        .limit(1);
      if (!targetCombo) throw new NotFoundException('Target combo not found');
    }

    await this.db.transaction(async (tx) => {
      if (params.itemId) {
        const [item] = await tx
          .select({ id: quoteItems.id, quoteGroupId: quoteItems.quoteGroupId, quoteComboId: quoteItems.quoteComboId })
          .from(quoteItems)
          .where(and(eq(quoteItems.id, params.itemId), eq(quoteItems.tenantId, tenantId), isNull(quoteItems.deletedAt)))
          .limit(1);
        if (!item) throw new NotFoundException('Item not found');

        if (params.insertAtIndex !== undefined) {
          const parentFilter = params.targetComboId
            ? eq(quoteItems.quoteComboId, params.targetComboId)
            : and(eq(quoteItems.quoteGroupId, params.targetGroupId), isNull(quoteItems.quoteComboId));
          await tx
            .update(quoteItems)
            .set({ sortIndex: sql`${quoteItems.sortIndex} + 1` })
            .where(and(parentFilter, eq(quoteItems.tenantId, tenantId), isNull(quoteItems.deletedAt), sql`${quoteItems.sortIndex} >= ${params.insertAtIndex}`));
        }

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (params.targetComboId) {
          updates.quoteGroupId = null;
          updates.quoteComboId = params.targetComboId;
        } else {
          updates.quoteGroupId = params.targetGroupId;
          updates.quoteComboId = null;
        }
        if (params.insertAtIndex !== undefined) {
          updates.sortIndex = params.insertAtIndex;
        }
        await tx.update(quoteItems).set(updates).where(eq(quoteItems.id, params.itemId));
        this.logger.debug(`${logPrefix} — moved item ${params.itemId} to group=${params.targetGroupId} combo=${params.targetComboId ?? 'none'} at=${params.insertAtIndex ?? 'end'}`);
      }

      if (params.comboId) {
        const [combo] = await tx
          .select({ id: quoteCombos.id, quoteGroupId: quoteCombos.quoteGroupId, comboPayload: quoteCombos.comboPayload })
          .from(quoteCombos)
          .where(and(eq(quoteCombos.id, params.comboId), eq(quoteCombos.tenantId, tenantId), isNull(quoteCombos.deletedAt)))
          .limit(1);
        if (!combo) throw new NotFoundException('Combo not found');

        const isScope = isScopeComboPayload(combo.comboPayload);
        if (isScope && params.targetComboId) {
          throw new BadRequestException('Scopes cannot be placed inside another combo');
        }

        if (params.insertAtIndex !== undefined) {
          await tx
            .update(quoteCombos)
            .set({ sortIndex: sql`${quoteCombos.sortIndex} + 1` })
            .where(
              and(
                eq(quoteCombos.quoteGroupId, params.targetGroupId),
                eq(quoteCombos.tenantId, tenantId),
                isNull(quoteCombos.deletedAt),
                sql`${quoteCombos.sortIndex} >= ${params.insertAtIndex}`,
              ),
            );
        }

        const updates: Record<string, unknown> = {
          quoteGroupId: params.targetGroupId,
          updatedAt: new Date(),
        };
        if (params.targetComboId) {
          updates.comboPayload = buildComboPayload({
            kind: 'assembly',
            parentComboId: params.targetComboId,
          });
        } else {
          const currentParent = parentComboIdFromPayload(combo.comboPayload);
          if (currentParent) {
            updates.comboPayload = buildComboPayload({
              kind: isScope ? 'scope' : 'assembly',
              parentComboId: undefined,
            });
          }
        }
        if (params.insertAtIndex !== undefined) {
          updates.sortIndex = params.insertAtIndex;
        }
        await tx.update(quoteCombos).set(updates).where(eq(quoteCombos.id, params.comboId));
        this.logger.debug(`${logPrefix} — moved combo ${params.comboId} to group=${params.targetGroupId} combo=${params.targetComboId ?? 'none'} at=${params.insertAtIndex ?? 'end'}`);
      }
    });

    return { success: true };
  }

  async duplicateQuoteLineItem(params: {
    quoteId: string;
    itemId?: string;
    comboId?: string;
    targetGroupId: string;
    targetComboId?: string;
    insertAtIndex?: number;
  }) {
    const tenantId = this.getTenantId();
    const logPrefix = 'CatalogSelectionService.duplicateQuoteLineItem';

    if (!params.itemId && !params.comboId) {
      throw new BadRequestException('Either itemId or comboId must be provided');
    }

    const [targetGroup] = await this.db
      .select({ id: quoteGroups.id })
      .from(quoteGroups)
      .where(
        and(
          eq(quoteGroups.id, params.targetGroupId),
          eq(quoteGroups.tenantId, tenantId),
          eq(quoteGroups.quoteId, params.quoteId),
        ),
      )
      .limit(1);
    if (!targetGroup) throw new NotFoundException('Target group not found');

    return this.db.transaction(async (tx) => {
      if (params.itemId) {
        const [source] = await tx
          .select()
          .from(quoteItems)
          .where(and(eq(quoteItems.id, params.itemId), eq(quoteItems.tenantId, tenantId), isNull(quoteItems.deletedAt)))
          .limit(1);
        if (!source) throw new NotFoundException('Source item not found');

        const insertIdx = params.insertAtIndex ?? (source.sortIndex + 1);
        const parentFilter = params.targetComboId
          ? eq(quoteItems.quoteComboId, params.targetComboId)
          : and(eq(quoteItems.quoteGroupId, params.targetGroupId), isNull(quoteItems.quoteComboId));
        await tx
          .update(quoteItems)
          .set({ sortIndex: sql`${quoteItems.sortIndex} + 1` })
          .where(and(parentFilter, eq(quoteItems.tenantId, tenantId), isNull(quoteItems.deletedAt), sql`${quoteItems.sortIndex} >= ${insertIdx}`));

        const { id, createdAt, updatedAt, deletedAt, externalReference, ...fields } = source;
        const [copy] = await tx
          .insert(quoteItems)
          .values({
            ...fields,
            quoteGroupId: params.targetComboId ? null : params.targetGroupId,
            quoteComboId: params.targetComboId ?? null,
            sortIndex: insertIdx,
            externalReference: null,
          })
          .returning({ id: quoteItems.id });
        this.logger.debug(`${logPrefix} — duplicated item ${params.itemId} → ${copy.id}`);
        return { success: true, newId: copy.id };
      }

      if (params.comboId) {
        const [source] = await tx
          .select()
          .from(quoteCombos)
          .where(and(eq(quoteCombos.id, params.comboId), eq(quoteCombos.tenantId, tenantId), isNull(quoteCombos.deletedAt)))
          .limit(1);
        if (!source) throw new NotFoundException('Source combo not found');

        const isScope = isScopeComboPayload(source.comboPayload);
        if (isScope && params.targetComboId) {
          throw new BadRequestException('Scopes cannot be placed inside another combo');
        }

        const insertIdx = params.insertAtIndex ?? (source.sortIndex + 1);
        await tx
          .update(quoteCombos)
          .set({ sortIndex: sql`${quoteCombos.sortIndex} + 1` })
          .where(
            and(
              eq(quoteCombos.quoteGroupId, params.targetGroupId),
              eq(quoteCombos.tenantId, tenantId),
              isNull(quoteCombos.deletedAt),
              sql`${quoteCombos.sortIndex} >= ${insertIdx}`,
            ),
          );

        const newPayload = params.targetComboId
          ? buildComboPayload({ kind: 'assembly', parentComboId: params.targetComboId })
          : buildComboPayload({ kind: isScope ? 'scope' : 'assembly' });

        const { id: _id, createdAt: _ca, updatedAt: _ua, deletedAt: _da, externalReference: _er, ...comboFields } = source;
        const [comboCopy] = await tx
          .insert(quoteCombos)
          .values({
            ...comboFields,
            quoteGroupId: params.targetGroupId,
            comboPayload: newPayload,
            sortIndex: insertIdx,
            externalReference: null,
          })
          .returning({ id: quoteCombos.id });

        const childItems = await tx
          .select()
          .from(quoteItems)
          .where(and(eq(quoteItems.quoteComboId, params.comboId), eq(quoteItems.tenantId, tenantId), isNull(quoteItems.deletedAt)));

        for (const childItem of childItems) {
          const { id: _cid, createdAt: _cca, updatedAt: _cua, deletedAt: _cda, externalReference: _cer, ...itemFields } = childItem;
          await tx.insert(quoteItems).values({
            ...itemFields,
            quoteGroupId: null,
            quoteComboId: comboCopy.id,
            externalReference: null,
          });
        }

        const childCombos = await tx
          .select()
          .from(quoteCombos)
          .where(and(eq(quoteCombos.quoteGroupId, source.quoteGroupId), eq(quoteCombos.tenantId, tenantId), isNull(quoteCombos.deletedAt)));
        const nestedCombos = childCombos.filter((c) => parentComboIdFromPayload(c.comboPayload) === params.comboId);

        for (const nested of nestedCombos) {
          const { id: _nid, createdAt: _nca, updatedAt: _nua, deletedAt: _nda, externalReference: _ner, ...nestedFields } = nested;
          const nestedPayload = buildComboPayload({
            kind: isScopeComboPayload(nested.comboPayload) ? 'scope' : 'assembly',
            parentComboId: comboCopy.id,
          });
          const [nestedCopy] = await tx
            .insert(quoteCombos)
            .values({
              ...nestedFields,
              quoteGroupId: params.targetGroupId,
              comboPayload: nestedPayload,
              externalReference: null,
            })
            .returning({ id: quoteCombos.id });

          const nestedItems = await tx
            .select()
            .from(quoteItems)
            .where(and(eq(quoteItems.quoteComboId, nested.id), eq(quoteItems.tenantId, tenantId), isNull(quoteItems.deletedAt)));
          for (const ni of nestedItems) {
            const { id: _niid, createdAt: _nica, updatedAt: _niua, deletedAt: _nida, externalReference: _nier, ...niFields } = ni;
            await tx.insert(quoteItems).values({
              ...niFields,
              quoteGroupId: null,
              quoteComboId: nestedCopy.id,
              externalReference: null,
            });
          }
        }

        this.logger.debug(`${logPrefix} — duplicated combo ${params.comboId} → ${comboCopy.id} (${childItems.length} items, ${nestedCombos.length} nested combos)`);
        return { success: true, newId: comboCopy.id };
      }

      return { success: true };
    });
  }

  async updateQuoteLineItems(params: {
    quoteId: string;
    items: Array<{
      id: string;
      name?: string;
      component?: string;
      description?: string;
      quantity?: string;
      unitCost?: string;
      markupValue?: string;
      tax?: string;
      unitType?: string;
    }>;
    combos: Array<{
      id: string;
      name?: string;
      component?: string;
      description?: string;
      quantity?: string;
    }>;
  }) {
    const tenantId = this.getTenantId();

    const unitTypeRefs = params.items
      .map((i) => i.unitType)
      .filter((v): v is string => !!v);
    let unitLookupMap = new Map<string, string>();
    if (unitTypeRefs.length > 0) {
      const units = await this.lookupsRepo.findByDomain({ tenantId, domain: 'unit_type' });
      unitLookupMap = new Map(
        units.map((u) => [(u.externalReference ?? u.name ?? '').toUpperCase(), u.id]),
      );
    }

    await this.db.transaction(async (tx) => {
      for (const item of params.items) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (item.name !== undefined) updates.name = item.name;
        if (item.component !== undefined) updates.component = item.component;
        if (item.description !== undefined) updates.description = item.description;
        if (item.quantity !== undefined) updates.quantity = item.quantity;
        if (item.unitCost !== undefined) updates.unitCost = item.unitCost;
        if (item.markupValue !== undefined) updates.markupValue = item.markupValue;
        if (item.tax !== undefined) updates.tax = coerceToRateString(item.tax);
        if (item.unitType !== undefined) {
          const lookupId = item.unitType ? unitLookupMap.get(item.unitType.toUpperCase()) : null;
          updates.unitTypeLookupId = lookupId ?? null;
        }

        const totals = computeLineTotals({
          quantity: item.quantity ?? '0',
          unitCost: item.unitCost ?? '0',
          taxRate: item.tax,
        });
        updates.totals = totals;

        await tx
          .update(quoteItems)
          .set(updates)
          .where(and(eq(quoteItems.id, item.id), eq(quoteItems.tenantId, tenantId)));
      }

      for (const combo of params.combos) {
        const updates: Record<string, unknown> = {};
        if (combo.name !== undefined) updates.name = combo.name;
        if (combo.component !== undefined) updates.component = combo.component;
        if (combo.description !== undefined) updates.description = combo.description;
        if (combo.quantity !== undefined) updates.quantity = combo.quantity;

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date();
          await tx
            .update(quoteCombos)
            .set(updates)
            .where(and(eq(quoteCombos.id, combo.id), eq(quoteCombos.tenantId, tenantId)));
        }
      }
    });

    return { updated: params.items.length + params.combos.length };
  }

  async getQuoteLineItems(params: { quoteId: string } & LineItemsPageQuery) {
    const tenantId = this.getTenantId();
    const groups = await this.listQuoteGroups({ quoteId: params.quoteId });
    if (groups.length === 0) {
      return emptyLineItemsPage(params);
    }

    const groupIds = groups.map((g) => g.id);

    const lookupIds = new Set<string>();
    for (const g of groups) {
      if (g.groupLabelLookupId) lookupIds.add(g.groupLabelLookupId);
    }

    let combos = await this.db
      .select()
      .from(quoteCombos)
      .where(
        and(
          eq(quoteCombos.tenantId, tenantId),
          inArray(quoteCombos.quoteGroupId, groupIds),
          isNull(quoteCombos.deletedAt),
        ),
      )
      .orderBy(quoteCombos.sortIndex);

    const comboIds = combos.map((c) => c.id);
    let directItems =
      groupIds.length > 0
        ? await this.db
            .select()
            .from(quoteItems)
            .where(
              and(
                eq(quoteItems.tenantId, tenantId),
                inArray(quoteItems.quoteGroupId, groupIds),
                isNull(quoteItems.deletedAt),
              ),
            )
            .orderBy(quoteItems.sortIndex)
        : [];

    let comboItems =
      comboIds.length > 0
        ? await this.db
            .select()
            .from(quoteItems)
            .where(
              and(
                eq(quoteItems.tenantId, tenantId),
                inArray(quoteItems.quoteComboId, comboIds),
                isNull(quoteItems.deletedAt),
              ),
            )
            .orderBy(quoteItems.sortIndex)
        : [];

    for (const item of [...directItems, ...comboItems]) {
      if (item.unitTypeLookupId) lookupIds.add(item.unitTypeLookupId);
    }
    const lookupMap = await this.lookupsRepo.findByIds({ ids: [...lookupIds], tenantId });

    const combosByGroup = new Map<string, typeof combos>();
    for (const combo of combos) {
      const list = combosByGroup.get(combo.quoteGroupId) ?? [];
      list.push(combo);
      combosByGroup.set(combo.quoteGroupId, list);
    }

    const directItemsByGroup = new Map<string, typeof directItems>();
    for (const item of directItems) {
      if (!item.quoteGroupId) continue;
      const list = directItemsByGroup.get(item.quoteGroupId) ?? [];
      list.push(item);
      directItemsByGroup.set(item.quoteGroupId, list);
    }

    const comboItemsByCombo = new Map<string, typeof comboItems>();
    for (const item of comboItems) {
      if (!item.quoteComboId) continue;
      const list = comboItemsByCombo.get(item.quoteComboId) ?? [];
      list.push(item);
      comboItemsByCombo.set(item.quoteComboId, list);
    }

    const assembled = groups.map((group, index) => {
      const dimensions = (group.dimensions as Record<string, unknown>) ?? {};
      const groupTotals = (group.totals as Record<string, unknown>) ?? {};
      const groupCombos = combosByGroup.get(group.id) ?? [];

      const lookupValue = group.groupLabelLookupId
        ? lookupMap.get(group.groupLabelLookupId)
        : null;
      const groupLabelObj = lookupValue
        ? { id: lookupValue.id, name: lookupValue.name, externalReference: lookupValue.externalReference }
        : group.description
          ? { name: group.description }
          : { name: `Group ${index + 1}` };

      const mapCombo = (combo: (typeof groupCombos)[number]) => {
        const comboTotals = (combo.totals as Record<string, unknown>) ?? {};
        const kind = isScopeComboPayload(combo.comboPayload) ? 'scope' : 'assembly';
        return {
          id: combo.id,
          kind,
          name: combo.name,
          component: combo.component,
          description: combo.description,
          category: combo.category,
          subCategory: combo.subCategory,
          index: combo.sortIndex,
          quantity: combo.quantity ? parseDecimal(combo.quantity) : undefined,
          catalogComboId: combo.catalogComboId,
          catalogScopeId: combo.catalogComboId,
          publishStatus: combo.publishStatus ?? undefined,
          subTotal: asNumber(comboTotals.subTotal),
          totalTax: asNumber(comboTotals.totalTax),
          total: asNumber(comboTotals.total),
          items: (comboItemsByCombo.get(combo.id) ?? []).map((item) =>
            this.mapQuoteItemRow(item, lookupMap),
          ),
        };
      };

      const nested = nestCombosUnderScopes(groupCombos, mapCombo);

      return {
        id: group.id,
        groupLabel: groupLabelObj,
        description: group.description,
        length: asNumber(dimensions.length),
        width: asNumber(dimensions.width),
        height: asNumber(dimensions.height),
        perimeter: asNumber(dimensions.perimeter),
        index: group.sortIndex,
        subTotal: asNumber(groupTotals.subTotal),
        totalTax: asNumber(groupTotals.totalTax),
        total: asNumber(groupTotals.total),
        items: (directItemsByGroup.get(group.id) ?? []).map((item) =>
          this.mapQuoteItemRow(item, lookupMap),
        ),
        combos: nested.combos,
        scopes: nested.scopes,
      };
    });
    return paginateAssembledLineItems(assembled, params);
  }

  async getPurchaseOrderLineItems(params: { purchaseOrderId: string } & LineItemsPageQuery) {
    const tenantId = this.getTenantId();
    const groups = await this.db
      .select()
      .from(purchaseOrderGroups)
      .where(
        and(
          eq(purchaseOrderGroups.tenantId, tenantId),
          eq(purchaseOrderGroups.purchaseOrderId, params.purchaseOrderId),
          isNull(purchaseOrderGroups.deletedAt),
        ),
      )
      .orderBy(purchaseOrderGroups.sortIndex);

    if (groups.length === 0) {
      return emptyLineItemsPage(params);
    }

    const groupIds = groups.map((g) => g.id);

    const lookupIds = new Set<string>();
    for (const g of groups) {
      if (g.groupLabelLookupId) lookupIds.add(g.groupLabelLookupId);
    }

    const combos = await this.db
      .select()
      .from(purchaseOrderCombos)
      .where(
        and(
          eq(purchaseOrderCombos.tenantId, tenantId),
          inArray(purchaseOrderCombos.purchaseOrderGroupId, groupIds),
          isNull(purchaseOrderCombos.deletedAt),
        ),
      )
      .orderBy(purchaseOrderCombos.sortIndex);

    const comboIds = combos.map((c) => c.id);
    const directItems =
      groupIds.length > 0
        ? await this.db
            .select()
            .from(purchaseOrderItems)
            .where(
              and(
                eq(purchaseOrderItems.tenantId, tenantId),
                inArray(purchaseOrderItems.purchaseOrderGroupId, groupIds),
                isNull(purchaseOrderItems.deletedAt),
              ),
            )
            .orderBy(purchaseOrderItems.sortIndex)
        : [];

    const comboItems =
      comboIds.length > 0
        ? await this.db
            .select()
            .from(purchaseOrderItems)
            .where(
              and(
                eq(purchaseOrderItems.tenantId, tenantId),
                inArray(purchaseOrderItems.purchaseOrderComboId, comboIds),
                isNull(purchaseOrderItems.deletedAt),
              ),
            )
            .orderBy(purchaseOrderItems.sortIndex)
        : [];

    for (const item of [...directItems, ...comboItems]) {
      if (item.unitTypeLookupId) lookupIds.add(item.unitTypeLookupId);
    }
    const lookupMap = await this.lookupsRepo.findByIds({ ids: [...lookupIds], tenantId });

    const combosByGroup = new Map<string, typeof combos>();
    for (const combo of combos) {
      const list = combosByGroup.get(combo.purchaseOrderGroupId) ?? [];
      list.push(combo);
      combosByGroup.set(combo.purchaseOrderGroupId, list);
    }

    const directItemsByGroup = new Map<string, typeof directItems>();
    for (const item of directItems) {
      if (!item.purchaseOrderGroupId) continue;
      const list = directItemsByGroup.get(item.purchaseOrderGroupId) ?? [];
      list.push(item);
      directItemsByGroup.set(item.purchaseOrderGroupId, list);
    }

    const comboItemsByCombo = new Map<string, typeof comboItems>();
    for (const item of comboItems) {
      if (!item.purchaseOrderComboId) continue;
      const list = comboItemsByCombo.get(item.purchaseOrderComboId) ?? [];
      list.push(item);
      comboItemsByCombo.set(item.purchaseOrderComboId, list);
    }

    const assembled = groups.map((group, index) => {
      const dimensions = (group.dimensions as Record<string, unknown>) ?? {};
      const groupTotals = (group.totals as Record<string, unknown>) ?? {};
      const groupCombos = combosByGroup.get(group.id) ?? [];

      const lookupValue = group.groupLabelLookupId
        ? lookupMap.get(group.groupLabelLookupId)
        : null;
      const groupLabelObj = lookupValue
        ? { id: lookupValue.id, name: lookupValue.name, externalReference: lookupValue.externalReference }
        : group.description
          ? { name: group.description }
          : { name: `Group ${index + 1}` };

      const mapCombo = (combo: (typeof groupCombos)[number]) => {
        const comboTotals = (combo.totals as Record<string, unknown>) ?? {};
        const kind = isScopeComboPayload(combo.comboPayload) ? 'scope' : 'assembly';
        return {
          id: combo.id,
          kind,
          name: combo.name,
          description: combo.description,
          category: combo.category,
          subCategory: combo.subCategory,
          index: combo.sortIndex,
          quantity: combo.quantity ? parseDecimal(combo.quantity) : undefined,
          catalogComboId: combo.catalogComboId,
          catalogScopeId: combo.catalogComboId,
          subTotal: asNumber(comboTotals.subTotal),
          totalTax: asNumber(comboTotals.totalTax),
          total: asNumber(comboTotals.total),
          items: (comboItemsByCombo.get(combo.id) ?? []).map((item) =>
            this.mapPurchaseOrderItemRow(item, lookupMap),
          ),
        };
      };

      const nested = nestCombosUnderScopes(groupCombos, mapCombo);

      return {
        id: group.id,
        groupLabel: groupLabelObj,
        description: group.description,
        length: asNumber(dimensions.length),
        width: asNumber(dimensions.width),
        height: asNumber(dimensions.height),
        perimeter: asNumber(dimensions.perimeter),
        index: group.sortIndex,
        subTotal: asNumber(groupTotals.subTotal),
        totalTax: asNumber(groupTotals.totalTax),
        total: asNumber(groupTotals.total),
        items: (directItemsByGroup.get(group.id) ?? []).map((item) =>
          this.mapPurchaseOrderItemRow(item, lookupMap),
        ),
        combos: nested.combos,
        scopes: nested.scopes,
      };
    });
    return paginateAssembledLineItems(assembled, params);
  }

  async getWorkOrderLineItems(params: { workOrderId: string } & LineItemsPageQuery) {
    const tenantId = this.getTenantId();
    const groups = await this.db
      .select()
      .from(workOrderGroups)
      .where(
        and(
          eq(workOrderGroups.tenantId, tenantId),
          eq(workOrderGroups.workOrderId, params.workOrderId),
          isNull(workOrderGroups.deletedAt),
        ),
      )
      .orderBy(workOrderGroups.sortIndex);

    if (groups.length === 0) {
      return emptyLineItemsPage(params);
    }

    const groupIds = groups.map((g) => g.id);

    const lookupIds = new Set<string>();
    for (const g of groups) {
      if (g.groupLabelLookupId) lookupIds.add(g.groupLabelLookupId);
    }

    const combos = await this.db
      .select()
      .from(workOrderCombos)
      .where(
        and(
          eq(workOrderCombos.tenantId, tenantId),
          inArray(workOrderCombos.workOrderGroupId, groupIds),
          isNull(workOrderCombos.deletedAt),
        ),
      )
      .orderBy(workOrderCombos.sortIndex);

    const comboIds = combos.map((c) => c.id);
    const directItems =
      groupIds.length > 0
        ? await this.db
            .select()
            .from(workOrderItems)
            .where(
              and(
                eq(workOrderItems.tenantId, tenantId),
                inArray(workOrderItems.workOrderGroupId, groupIds),
                isNull(workOrderItems.deletedAt),
              ),
            )
            .orderBy(workOrderItems.sortIndex)
        : [];

    const comboItems =
      comboIds.length > 0
        ? await this.db
            .select()
            .from(workOrderItems)
            .where(
              and(
                eq(workOrderItems.tenantId, tenantId),
                inArray(workOrderItems.workOrderComboId, comboIds),
                isNull(workOrderItems.deletedAt),
              ),
            )
            .orderBy(workOrderItems.sortIndex)
        : [];

    for (const item of [...directItems, ...comboItems]) {
      if (item.unitTypeLookupId) lookupIds.add(item.unitTypeLookupId);
    }
    const lookupMap = await this.lookupsRepo.findByIds({ ids: [...lookupIds], tenantId });

    const combosByGroup = new Map<string, typeof combos>();
    for (const combo of combos) {
      const list = combosByGroup.get(combo.workOrderGroupId) ?? [];
      list.push(combo);
      combosByGroup.set(combo.workOrderGroupId, list);
    }

    const directItemsByGroup = new Map<string, typeof directItems>();
    for (const item of directItems) {
      if (!item.workOrderGroupId) continue;
      const list = directItemsByGroup.get(item.workOrderGroupId) ?? [];
      list.push(item);
      directItemsByGroup.set(item.workOrderGroupId, list);
    }

    const comboItemsByCombo = new Map<string, typeof comboItems>();
    for (const item of comboItems) {
      if (!item.workOrderComboId) continue;
      const list = comboItemsByCombo.get(item.workOrderComboId) ?? [];
      list.push(item);
      comboItemsByCombo.set(item.workOrderComboId, list);
    }

    const assembled = groups.map((group, index) => {
      const dimensions = (group.dimensions as Record<string, unknown>) ?? {};
      const groupTotals = (group.totals as Record<string, unknown>) ?? {};
      const groupCombos = combosByGroup.get(group.id) ?? [];

      const lookupValue = group.groupLabelLookupId
        ? lookupMap.get(group.groupLabelLookupId)
        : null;
      const groupLabelObj = lookupValue
        ? { id: lookupValue.id, name: lookupValue.name, externalReference: lookupValue.externalReference }
        : group.description
          ? { name: group.description }
          : { name: `Group ${index + 1}` };

      const mapCombo = (combo: (typeof groupCombos)[number]) => {
        const comboTotals = (combo.totals as Record<string, unknown>) ?? {};
        const kind = isScopeComboPayload(combo.comboPayload) ? 'scope' : 'assembly';
        return {
          id: combo.id,
          kind,
          name: combo.name,
          description: combo.description,
          category: combo.category,
          subCategory: combo.subCategory,
          index: combo.sortIndex,
          quantity: combo.quantity ? parseDecimal(combo.quantity) : undefined,
          catalogComboId: combo.catalogComboId,
          catalogScopeId: combo.catalogComboId,
          subTotal: asNumber(comboTotals.subTotal),
          totalTax: asNumber(comboTotals.totalTax),
          total: asNumber(comboTotals.total),
          items: (comboItemsByCombo.get(combo.id) ?? []).map((item) =>
            this.mapWorkOrderItemRow(item, lookupMap),
          ),
        };
      };

      const nested = nestCombosUnderScopes(groupCombos, mapCombo);

      return {
        id: group.id,
        groupLabel: groupLabelObj,
        description: group.description,
        length: asNumber(dimensions.length),
        width: asNumber(dimensions.width),
        height: asNumber(dimensions.height),
        perimeter: asNumber(dimensions.perimeter),
        index: group.sortIndex,
        subTotal: asNumber(groupTotals.subTotal),
        totalTax: asNumber(groupTotals.totalTax),
        total: asNumber(groupTotals.total),
        items: (directItemsByGroup.get(group.id) ?? []).map((item) =>
          this.mapWorkOrderItemRow(item, lookupMap),
        ),
        combos: nested.combos,
        scopes: nested.scopes,
      };
    });
    return paginateAssembledLineItems(assembled, params);
  }

  private mapWorkOrderItemRow(
    row: typeof workOrderItems.$inferSelect,
    lookupMap?: Map<string, { id: string; name: string | null; externalReference: string | null; [k: string]: unknown }>,
  ) {
    const totals = (row.totals as Record<string, unknown>) ?? {};

    const unitTypeLookup = row.unitTypeLookupId && lookupMap
      ? lookupMap.get(row.unitTypeLookupId)
      : undefined;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.itemType,
      category: row.category,
      subCategory: row.subCategory,
      index: row.sortIndex,
      quantity: row.quantity ? parseDecimal(row.quantity) : 0,
      tax: row.tax ? parseDecimal(row.tax) : undefined,
      unitCost: row.unitCost ? parseDecimal(row.unitCost) : undefined,
      buyCost: row.buyCost ? parseDecimal(row.buyCost) : undefined,
      markupType: row.markupType,
      markupValue: row.markupValue ? parseDecimal(row.markupValue) : undefined,
      unitType: unitTypeLookup
        ? { id: unitTypeLookup.id, name: unitTypeLookup.name, externalReference: unitTypeLookup.externalReference }
        : undefined,
      catalogItemId: row.catalogItemId,
      catalogMissing: hasMissingCatalogRef(row) || undefined,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      note: row.note,
      subTotal: asNumber(totals.subTotal),
      totalTax: asNumber(totals.totalTax),
      total: asNumber(totals.total),
    };
  }

  private mapPurchaseOrderItemRow(
    row: typeof purchaseOrderItems.$inferSelect,
    lookupMap?: Map<string, { id: string; name: string | null; externalReference: string | null; [k: string]: unknown }>,
  ) {
    const totals = (row.totals as Record<string, unknown>) ?? {};

    const unitTypeLookup = row.unitTypeLookupId && lookupMap
      ? lookupMap.get(row.unitTypeLookupId)
      : undefined;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.itemType,
      category: row.category,
      subCategory: row.subCategory,
      index: row.sortIndex,
      quantity: row.quantity ? parseDecimal(row.quantity) : 0,
      tax: row.tax ? parseDecimal(row.tax) : undefined,
      unitCost: row.unitCost ? parseDecimal(row.unitCost) : undefined,
      buyCost: row.buyCost ? parseDecimal(row.buyCost) : undefined,
      markupType: row.markupType,
      markupValue: row.markupValue ? parseDecimal(row.markupValue) : undefined,
      unitType: unitTypeLookup
        ? { id: unitTypeLookup.id, name: unitTypeLookup.name, externalReference: unitTypeLookup.externalReference }
        : undefined,
      catalogItemId: row.catalogItemId,
      catalogMissing: hasMissingCatalogRef(row) || undefined,
      reconciliation: row.reconciliation ? parseDecimal(row.reconciliation) : undefined,
      manualAllocation: row.manualAllocation ?? undefined,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      note: row.note,
      subTotal: asNumber(totals.subTotal),
      totalTax: asNumber(totals.totalTax),
      total: asNumber(totals.total),
    };
  }

  /**
   * Builds the `groups` array shaped for the Crunchwork POST /quotes body.
   * Resolves all lookup IDs to their external references.
   * Returns the outbound payload along with metadata about which items were sent vs excluded.
   */
  async buildOutboundQuoteGroups(params: { quoteId: string; providerCode?: string }): Promise<{
    groups: Record<string, unknown>[];
    sentItemIds: string[];
    sentComboIds: string[];
    excludedItemIds: string[];
    excludedComboIds: string[];
    excludedItemNames: string[];
    excludedComboNames: Array<{ name: string; kind: 'assembly' | 'scope' }>;
  }> {
    const tenantId = this.getTenantId();
    const groups = await this.listQuoteGroups({ quoteId: params.quoteId });
    if (groups.length === 0) {
      return { groups: [], sentItemIds: [], sentComboIds: [], excludedItemIds: [], excludedComboIds: [], excludedItemNames: [], excludedComboNames: [] };
    }

    const groupIds = groups.map((g) => g.id);
    let combos = await this.db
      .select()
      .from(quoteCombos)
      .where(
        and(
          eq(quoteCombos.tenantId, tenantId),
          inArray(quoteCombos.quoteGroupId, groupIds),
          isNull(quoteCombos.deletedAt),
        ),
      )
      .orderBy(quoteCombos.sortIndex);

    const comboIds = combos.map((c) => c.id);
    let directItems =
      groupIds.length > 0
        ? await this.db
            .select()
            .from(quoteItems)
            .where(
              and(
                eq(quoteItems.tenantId, tenantId),
                inArray(quoteItems.quoteGroupId, groupIds),
                isNull(quoteItems.deletedAt),
              ),
            )
            .orderBy(quoteItems.sortIndex)
        : [];

    let comboItems =
      comboIds.length > 0
        ? await this.db
            .select()
            .from(quoteItems)
            .where(
              and(
                eq(quoteItems.tenantId, tenantId),
                inArray(quoteItems.quoteComboId, comboIds),
                isNull(quoteItems.deletedAt),
              ),
            )
            .orderBy(quoteItems.sortIndex)
        : [];

    const catalogIdsForProvider = new Set<string>();
    for (const item of [...directItems, ...comboItems]) {
      if (item.catalogItemId) catalogIdsForProvider.add(item.catalogItemId);
    }
    for (const combo of combos) {
      if (combo.catalogComboId) catalogIdsForProvider.add(combo.catalogComboId);
    }
    const catalogProviderMap = await this.itemsRepo.findProviderCodes({
      tenantId,
      ids: [...catalogIdsForProvider],
    });

    const allowsCatalogLink = (localCatalogItemId: string | null | undefined): boolean => {
      if (!params.providerCode) return true;
      if (!localCatalogItemId) return true;
      return catalogItemAllowsProvider(
        catalogProviderMap.get(localCatalogItemId),
        params.providerCode,
      );
    };

    let strippedCount = 0;
    let keptCount = 0;
    const excludedItemIds: string[] = [];
    const excludedItemNames: string[] = [];
    const filterLinked = <T extends { id: string; name?: string | null; catalogItemId?: string | null }>(rows: T[]): T[] => {
      const out: T[] = [];
      for (const row of rows) {
        if (allowsCatalogLink(row.catalogItemId)) {
          out.push(row);
          keptCount += 1;
        } else {
          strippedCount += 1;
          excludedItemIds.push(row.id);
          excludedItemNames.push(row.name ?? '(unnamed)');
        }
      }
      return out;
    };

    directItems = filterLinked(directItems);
    comboItems = filterLinked(comboItems);

    const comboItemsByComboId = new Map<string, typeof comboItems>();
    for (const item of comboItems) {
      if (!item.quoteComboId) continue;
      const list = comboItemsByComboId.get(item.quoteComboId) ?? [];
      list.push(item);
      comboItemsByComboId.set(item.quoteComboId, list);
    }

    // Provider combos must themselves be tagged for the provider. Scopes / untagged
    // shells are stripped and their children recursively hoisted to the parent
    // (group or kept ancestor combo) so CW never receives empty combo shells.
    const keepComboForProvider = (combo: (typeof combos)[number]): boolean => {
      if (!params.providerCode) return true;
      if (!combo.catalogComboId) return false;
      return allowsCatalogLink(combo.catalogComboId);
    };

    const combosByGroup = new Map<string, typeof combos>();
    for (const combo of combos) {
      const list = combosByGroup.get(combo.quoteGroupId) ?? [];
      list.push(combo);
      combosByGroup.set(combo.quoteGroupId, list);
    }
    const directItemsByGroup = new Map<string, typeof directItems>();
    for (const item of directItems) {
      if (!item.quoteGroupId) continue;
      const list = directItemsByGroup.get(item.quoteGroupId) ?? [];
      list.push(item);
      directItemsByGroup.set(item.quoteGroupId, list);
    }

    type KeptCombo = {
      combo: (typeof combos)[number];
      items: typeof comboItems;
    };
    const keptCombosByGroup = new Map<string, KeptCombo[]>();
    let strippedComboCount = 0;
    const excludedComboIds: string[] = [];
    const excludedComboNames: Array<{ name: string; kind: 'assembly' | 'scope' }> = [];

    for (const [groupId, groupCombos] of combosByGroup) {
      const hoisted = hoistProviderCombos({
        combos: groupCombos,
        itemsByComboId: comboItemsByComboId,
        keepCombo: keepComboForProvider,
      });
      strippedComboCount += hoisted.strippedComboCount;
      excludedComboIds.push(...hoisted.strippedComboIds);
      excludedComboNames.push(...hoisted.strippedComboMeta);
      keptCombosByGroup.set(groupId, hoisted.kept);
      if (hoisted.groupItems.length > 0) {
        const existing = directItemsByGroup.get(groupId) ?? [];
        directItemsByGroup.set(groupId, [...existing, ...hoisted.groupItems]);
      }
    }

    if (params.providerCode) {
      const keptComboCount = [...keptCombosByGroup.values()].reduce((n, list) => n + list.length, 0);
      this.logger.log(
        `CatalogSelectionService.buildOutboundQuoteGroups — provider=${params.providerCode} ` +
          `keptItems=${keptCount} strippedItems=${strippedCount} ` +
          `keptCombos=${keptComboCount} strippedCombos=${strippedComboCount}`,
      );
    }

    const allItems = [
      ...[...directItemsByGroup.values()].flat(),
      ...[...keptCombosByGroup.values()].flatMap((list) => list.flatMap((k) => k.items)),
    ];
    const lookupIds = new Set<string>();
    for (const g of groups) {
      if (g.groupLabelLookupId) lookupIds.add(g.groupLabelLookupId);
    }
    for (const kept of [...keptCombosByGroup.values()].flat()) {
      if (kept.combo.lineScopeStatusLookupId) lookupIds.add(kept.combo.lineScopeStatusLookupId);
    }
    for (const item of allItems) {
      if (item.lineScopeStatusLookupId) lookupIds.add(item.lineScopeStatusLookupId);
      if (item.unitTypeLookupId) lookupIds.add(item.unitTypeLookupId);
    }

    const lookupMap = await this.lookupsRepo.findByIds({
      ids: [...lookupIds],
      tenantId,
    });

    const resolveLookup = (id: string | null) => {
      if (!id) return undefined;
      const lv = lookupMap.get(id);
      if (!lv) return undefined;
      return { name: lv.name, externalReference: lv.externalReference };
    };

    const catalogItemIds = new Set<string>();
    for (const item of allItems) {
      if (item.catalogItemId) catalogItemIds.add(item.catalogItemId);
    }
    for (const kept of [...keptCombosByGroup.values()].flat()) {
      if (kept.combo.catalogComboId && keepComboForProvider(kept.combo)) {
        catalogItemIds.add(kept.combo.catalogComboId);
      }
    }
    const catalogExtRefMap = await this.itemsRepo.findExternalReferences({
      tenantId,
      ids: [...catalogItemIds],
    });

    const resolveCwCatalogId = (
      localCatalogItemId: string | null,
      field: 'catalogItemId' | 'catalogComboId',
    ): string | undefined => {
      if (!localCatalogItemId) return undefined;
      const extRef = catalogExtRefMap.get(localCatalogItemId);
      if (!extRef) return undefined;
      if (!CW_CATALOG_UUID_RE.test(extRef)) {
        this.logger.warn(
          `CatalogSelectionService.buildOutboundQuoteGroups — omitting ${field}=${extRef} ` +
            `(not a Crunchwork catalog UUID; set catalog_items.external_reference to the CW catalog item id)`,
        );
        return undefined;
      }
      // Same CW catalogue UUID may appear on multiple lines (e.g. cornice in
      // Bathroom and Kitchen). Always keep catalogItemId — uniqueness is per
      // quote line, not per catalogue product.
      return extRef;
    };

    const mapItem = (row: typeof quoteItems.$inferSelect): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      if (row.externalReference) result.id = row.externalReference;
      const cwCatalogItemId = resolveCwCatalogId(row.catalogItemId, 'catalogItemId');
      if (cwCatalogItemId) {
        result.catalogItemId = cwCatalogItemId;
      }
      if (row.name) result.name = row.name;
      if (row.description) result.description = row.description;
      if (row.itemType) result.type = normaliseCwItemType(row.itemType);
      // When linked to a CW catalogue item, omit category/subCategory — CW silently
      // drops lines if these conflict with the catalogue item's own category
      // (observed for e.g. "Heating and cooling" + air-con catalogue UUIDs).
      if (!cwCatalogItemId) {
        if (row.category) result.category = row.category;
        if (row.subCategory) result.subCategory = row.subCategory;
      }
      result.index = row.sortIndex;
      if (row.quantity) result.quantity = parseDecimal(row.quantity);
      if (row.tax) result.tax = rateToPercentPoints(parseDecimal(row.tax));
      if (row.unitCost) result.unitCost = parseDecimal(row.unitCost);
      copyUnitCostToBuyCostForCrunchwork(result);
      const cwMarkup = normaliseCwMarkupType(row.markupType);
      if (cwMarkup) result.markupType = cwMarkup;
      if (row.markupValue) {
        const mk = parseDecimal(row.markupValue);
        result.markupValue =
          cwMarkup === 'Percentage' || (!cwMarkup && isPercentMarkupType(row.markupType))
            ? rateToPercentPoints(mk)
            : mk;
      }
      if (row.internal != null) result.internal = row.internal;
      if (row.note) result.note = row.note;
      const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
      if (tags.length > 0) result.tags = tags;
      const lss = resolveLookup(row.lineScopeStatusLookupId);
      if (lss) result.lineScopeStatus = lss;
      const ut = resolveLookup(row.unitTypeLookupId);
      if (ut) result.unitType = ut;
      return result;
    };

    const sentItemIds: string[] = [];
    const sentComboIds: string[] = [];

    for (const items of directItemsByGroup.values()) {
      for (const item of items) sentItemIds.push(item.id);
    }
    for (const keptList of keptCombosByGroup.values()) {
      for (const { combo, items } of keptList) {
        sentComboIds.push(combo.id);
        for (const item of items) sentItemIds.push(item.id);
      }
    }

    const outboundGroups = groups
      .map((group) => {
        const dims = (group.dimensions as Record<string, unknown>) ?? {};
        const groupKeptCombos = keptCombosByGroup.get(group.id) ?? [];
        const groupDirectItems = (directItemsByGroup.get(group.id) ?? []).map(mapItem);
        // CW treats `index` as unique within a group. After stripping internal scopes,
        // hoisted children often all still have sortIndex 0 — resequence so none collide.
        groupDirectItems.forEach((item, i) => {
          item.index = i;
        });

        if (groupDirectItems.length === 0 && groupKeptCombos.length === 0) {
          return null;
        }

        const groupLabel = resolveLookup(group.groupLabelLookupId);
        if (!groupLabel?.externalReference) {
          throw new BadRequestException(
            `Quote group "${group.description || group.id}" has no group label with an external reference — ` +
            `assign a group label lookup before publishing`,
          );
        }

        const result: Record<string, unknown> = {};
        if (group.externalReference) result.id = group.externalReference;
        result.groupLabel = groupLabel;
        if (group.description) result.description = group.description;
        if (dims.length) result.length = dims.length;
        if (dims.width) result.width = dims.width;
        if (dims.height) result.height = dims.height;
        if (dims.perimeter) result.perimeter = dims.perimeter;
        result.index = group.sortIndex;

        if (groupDirectItems.length > 0) result.items = groupDirectItems;

        if (groupKeptCombos.length > 0) {
          const mappedCombos = groupKeptCombos
            .map(({ combo, items: comboItemRows }, comboIndex) => {
              const comboResult: Record<string, unknown> = {};
              if (combo.externalReference) comboResult.id = combo.externalReference;
              const cwCatalogComboId = resolveCwCatalogId(
                combo.catalogComboId,
                'catalogComboId',
              );
              if (cwCatalogComboId) {
                comboResult.catalogComboId = cwCatalogComboId;
              }
              if (combo.name) comboResult.name = combo.name;
              if (combo.description) comboResult.description = combo.description;
              if (!cwCatalogComboId) {
                if (combo.category) comboResult.category = combo.category;
                if (combo.subCategory) comboResult.subCategory = combo.subCategory;
              }
              comboResult.index = comboIndex;
              if (combo.quantity) comboResult.quantity = parseDecimal(combo.quantity);
              const lss = resolveLookup(combo.lineScopeStatusLookupId);
              if (lss) comboResult.lineScopeStatus = lss;
              const items = comboItemRows.map(mapItem);
              items.forEach((item, i) => {
                item.index = i;
              });
              if (items.length > 0) comboResult.items = items;
              return comboResult;
            })
            .filter((comboResult) => {
              const items = comboResult.items;
              if (Array.isArray(items) && items.length > 0) return true;
              return typeof comboResult.catalogComboId === 'string' && !!comboResult.catalogComboId;
            });
          if (mappedCombos.length > 0) result.combos = mappedCombos;
        }

        if (!result.items && !result.combos) return null;
        return result;
      })
      .filter((g): g is Record<string, unknown> => g !== null);

    return {
      groups: outboundGroups,
      sentItemIds,
      sentComboIds,
      excludedItemIds,
      excludedComboIds,
      excludedItemNames,
      excludedComboNames,
    };
  }

  /**
   * Map PO (preferred) or work-order line items into CW invoice group shape
   * (quantity, unitCost, tax as percentage points). Used to overlay pricing
   * onto a vendor-tax invoice cloned from the purchase order.
   */
  async buildOutboundInvoiceGroups(params: {
    purchaseOrderId?: string | null;
    workOrderId?: string | null;
  }): Promise<Record<string, unknown>[]> {
    const tenantId = this.getTenantId();
    if (params.purchaseOrderId) {
      const fromPo = await this.buildOutboundInvoiceGroupsFromPurchaseOrder({
        tenantId,
        purchaseOrderId: params.purchaseOrderId,
      });
      if (fromPo.length > 0) return fromPo;
    }
    if (params.workOrderId) {
      return this.buildOutboundInvoiceGroupsFromWorkOrder({
        tenantId,
        workOrderId: params.workOrderId,
      });
    }
    return [];
  }

  private async buildOutboundInvoiceGroupsFromPurchaseOrder(params: {
    tenantId: string;
    purchaseOrderId: string;
  }): Promise<Record<string, unknown>[]> {
    const groups = await this.db
      .select()
      .from(purchaseOrderGroups)
      .where(
        and(
          eq(purchaseOrderGroups.tenantId, params.tenantId),
          eq(purchaseOrderGroups.purchaseOrderId, params.purchaseOrderId),
          isNull(purchaseOrderGroups.deletedAt),
        ),
      )
      .orderBy(purchaseOrderGroups.sortIndex);
    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.id);
    const combos = await this.db
      .select()
      .from(purchaseOrderCombos)
      .where(
        and(
          eq(purchaseOrderCombos.tenantId, params.tenantId),
          inArray(purchaseOrderCombos.purchaseOrderGroupId, groupIds),
          isNull(purchaseOrderCombos.deletedAt),
        ),
      )
      .orderBy(purchaseOrderCombos.sortIndex);

    const comboIds = combos.map((c) => c.id);
    const directItems =
      groupIds.length > 0
        ? await this.db
            .select()
            .from(purchaseOrderItems)
            .where(
              and(
                eq(purchaseOrderItems.tenantId, params.tenantId),
                inArray(purchaseOrderItems.purchaseOrderGroupId, groupIds),
                isNull(purchaseOrderItems.deletedAt),
              ),
            )
            .orderBy(purchaseOrderItems.sortIndex)
        : [];
    const comboItems =
      comboIds.length > 0
        ? await this.db
            .select()
            .from(purchaseOrderItems)
            .where(
              and(
                eq(purchaseOrderItems.tenantId, params.tenantId),
                inArray(purchaseOrderItems.purchaseOrderComboId, comboIds),
                isNull(purchaseOrderItems.deletedAt),
              ),
            )
            .orderBy(purchaseOrderItems.sortIndex)
        : [];

    return this.assembleOutboundInvoiceGroups({
      tenantId: params.tenantId,
      groups,
      combos,
      directItems,
      comboItems,
      comboGroupId: (combo) => combo.purchaseOrderGroupId,
      itemGroupId: (item) => item.purchaseOrderGroupId,
      itemComboId: (item) => item.purchaseOrderComboId,
    });
  }

  private async buildOutboundInvoiceGroupsFromWorkOrder(params: {
    tenantId: string;
    workOrderId: string;
  }): Promise<Record<string, unknown>[]> {
    const groups = await this.db
      .select()
      .from(workOrderGroups)
      .where(
        and(
          eq(workOrderGroups.tenantId, params.tenantId),
          eq(workOrderGroups.workOrderId, params.workOrderId),
          isNull(workOrderGroups.deletedAt),
        ),
      )
      .orderBy(workOrderGroups.sortIndex);
    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.id);
    const combos = await this.db
      .select()
      .from(workOrderCombos)
      .where(
        and(
          eq(workOrderCombos.tenantId, params.tenantId),
          inArray(workOrderCombos.workOrderGroupId, groupIds),
          isNull(workOrderCombos.deletedAt),
        ),
      )
      .orderBy(workOrderCombos.sortIndex);

    const comboIds = combos.map((c) => c.id);
    const directItems =
      groupIds.length > 0
        ? await this.db
            .select()
            .from(workOrderItems)
            .where(
              and(
                eq(workOrderItems.tenantId, params.tenantId),
                inArray(workOrderItems.workOrderGroupId, groupIds),
                isNull(workOrderItems.deletedAt),
              ),
            )
            .orderBy(workOrderItems.sortIndex)
        : [];
    const comboItems =
      comboIds.length > 0
        ? await this.db
            .select()
            .from(workOrderItems)
            .where(
              and(
                eq(workOrderItems.tenantId, params.tenantId),
                inArray(workOrderItems.workOrderComboId, comboIds),
                isNull(workOrderItems.deletedAt),
              ),
            )
            .orderBy(workOrderItems.sortIndex)
        : [];

    return this.assembleOutboundInvoiceGroups({
      tenantId: params.tenantId,
      groups,
      combos,
      directItems,
      comboItems,
      comboGroupId: (combo) => combo.workOrderGroupId,
      itemGroupId: (item) => item.workOrderGroupId,
      itemComboId: (item) => item.workOrderComboId,
    });
  }

  private async assembleOutboundInvoiceGroups<
    TGroup extends {
      id: string;
      description: string | null;
      groupLabelLookupId: string | null;
      sortIndex: number;
    },
    TCombo extends {
      id: string;
      name: string | null;
      description: string | null;
      catalogComboId: string | null;
      quantity: string | null;
      sortIndex: number;
    },
    TItem extends {
      id: string;
      name: string | null;
      description: string | null;
      itemType: string | null;
      quantity: string | null;
      tax: string | null;
      unitCost: string | null;
      buyCost: string | null;
      markupType: string | null;
      markupValue: string | null;
      unitTypeLookupId: string | null;
      catalogItemId: string | null;
      note: string | null;
      sortIndex: number;
    },
  >(params: {
    tenantId: string;
    groups: TGroup[];
    combos: TCombo[];
    directItems: TItem[];
    comboItems: TItem[];
    comboGroupId: (combo: TCombo) => string;
    itemGroupId: (item: TItem) => string | null;
    itemComboId: (item: TItem) => string | null;
  }): Promise<Record<string, unknown>[]> {
    const lookupIds = new Set<string>();
    for (const group of params.groups) {
      if (group.groupLabelLookupId) lookupIds.add(group.groupLabelLookupId);
    }
    for (const item of [...params.directItems, ...params.comboItems]) {
      if (item.unitTypeLookupId) lookupIds.add(item.unitTypeLookupId);
    }
    const lookupMap = await this.lookupsRepo.findByIds({
      ids: [...lookupIds],
      tenantId: params.tenantId,
    });
    const resolveLookup = (id: string | null) => {
      if (!id) return undefined;
      const lv = lookupMap.get(id);
      if (!lv) return undefined;
      return { name: lv.name, externalReference: lv.externalReference };
    };

    const catalogItemIds = new Set<string>();
    for (const item of [...params.directItems, ...params.comboItems]) {
      if (item.catalogItemId) catalogItemIds.add(item.catalogItemId);
    }
    for (const combo of params.combos) {
      if (combo.catalogComboId) catalogItemIds.add(combo.catalogComboId);
    }
    const catalogExtRefMap = await this.itemsRepo.findExternalReferences({
      tenantId: params.tenantId,
      ids: [...catalogItemIds],
    });

    const resolveCwCatalogId = (
      localCatalogItemId: string | null,
      field: 'catalogItemId' | 'catalogComboId',
    ): string | undefined => {
      if (!localCatalogItemId) return undefined;
      const extRef = catalogExtRefMap.get(localCatalogItemId);
      if (!extRef) return undefined;
      if (!CW_CATALOG_UUID_RE.test(extRef)) {
        this.logger.warn(
          `CatalogSelectionService.buildOutboundInvoiceGroups — omitting ${field}=${extRef} ` +
            `(not a Crunchwork catalog UUID)`,
        );
        return undefined;
      }
      return extRef;
    };

    const mapItem = (row: TItem): Record<string, unknown> => {
      const result: Record<string, unknown> = { completed: true };
      const cwCatalogItemId = resolveCwCatalogId(row.catalogItemId, 'catalogItemId');
      if (cwCatalogItemId) result.catalogItemId = cwCatalogItemId;
      if (row.name) result.name = row.name;
      if (row.description) result.description = row.description;
      if (row.itemType) result.type = normaliseCwItemType(row.itemType);
      result.index = row.sortIndex;
      if (row.quantity != null && row.quantity !== '') {
        result.quantity = parseDecimal(row.quantity);
      }
      if (row.tax != null && row.tax !== '') {
        result.tax = rateToPercentPoints(parseDecimal(row.tax));
      }
      if (row.unitCost != null && row.unitCost !== '') {
        result.unitCost = parseDecimal(row.unitCost);
      }
      copyUnitCostToBuyCostForCrunchwork(result);
      const cwMarkup = normaliseCwMarkupType(row.markupType);
      if (cwMarkup) result.markupType = cwMarkup;
      if (row.markupValue != null && row.markupValue !== '') {
        const mk = parseDecimal(row.markupValue);
        result.markupValue =
          cwMarkup === 'Percentage' || (!cwMarkup && isPercentMarkupType(row.markupType))
            ? rateToPercentPoints(mk)
            : mk;
      }
      if (row.note) result.note = row.note;
      const ut = resolveLookup(row.unitTypeLookupId);
      if (ut?.externalReference) result.unitType = ut;
      return result;
    };

    const combosByGroup = new Map<string, TCombo[]>();
    for (const combo of params.combos) {
      const gid = params.comboGroupId(combo);
      const list = combosByGroup.get(gid) ?? [];
      list.push(combo);
      combosByGroup.set(gid, list);
    }
    const directByGroup = new Map<string, TItem[]>();
    for (const item of params.directItems) {
      const gid = params.itemGroupId(item);
      if (!gid) continue;
      const list = directByGroup.get(gid) ?? [];
      list.push(item);
      directByGroup.set(gid, list);
    }
    const itemsByCombo = new Map<string, TItem[]>();
    for (const item of params.comboItems) {
      const cid = params.itemComboId(item);
      if (!cid) continue;
      const list = itemsByCombo.get(cid) ?? [];
      list.push(item);
      itemsByCombo.set(cid, list);
    }

    const outbound: Record<string, unknown>[] = [];
    for (const group of params.groups) {
      const groupItems = (directByGroup.get(group.id) ?? []).map(mapItem);
      const groupCombos = (combosByGroup.get(group.id) ?? [])
        .map((combo) => {
          const comboResult: Record<string, unknown> = {};
          const cwCatalogComboId = resolveCwCatalogId(combo.catalogComboId, 'catalogComboId');
          if (cwCatalogComboId) comboResult.catalogComboId = cwCatalogComboId;
          if (combo.name) comboResult.name = combo.name;
          if (combo.description) comboResult.description = combo.description;
          comboResult.index = combo.sortIndex;
          if (combo.quantity != null && combo.quantity !== '') {
            comboResult.quantity = parseDecimal(combo.quantity);
          }
          const items = (itemsByCombo.get(combo.id) ?? []).map(mapItem);
          if (items.length > 0) comboResult.items = items;
          if (!comboResult.items && !comboResult.catalogComboId && !comboResult.name) {
            return null;
          }
          return comboResult;
        })
        .filter((c): c is Record<string, unknown> => c !== null);

      if (groupItems.length === 0 && groupCombos.length === 0) continue;

      const label = resolveLookup(group.groupLabelLookupId);
      const result: Record<string, unknown> = {
        index: group.sortIndex,
      };
      const name = label?.name ?? group.description;
      if (name) result.name = name;
      if (group.description) result.description = group.description;
      if (groupItems.length > 0) result.items = groupItems;
      if (groupCombos.length > 0) result.combos = groupCombos;
      outbound.push(result);
    }

    this.logger.log(
      `CatalogSelectionService.buildOutboundInvoiceGroups — groups=${outbound.length} ` +
        `items=${outbound.reduce((n, g) => n + (Array.isArray(g.items) ? g.items.length : 0), 0)} ` +
        `combos=${outbound.reduce((n, g) => n + (Array.isArray(g.combos) ? g.combos.length : 0), 0)}`,
    );
    return outbound;
  }

  private mapQuoteItemRow(
    row: typeof quoteItems.$inferSelect,
    lookupMap?: Map<string, { id: string; name: string | null; externalReference: string | null; [k: string]: unknown }>,
  ) {
    const totals = (row.totals as Record<string, unknown>) ?? {};
    const mismatches = Array.isArray(row.mismatches)
      ? (row.mismatches as Array<{ property?: string; catalogValue?: string }>)
      : [];

    const unitTypeLookup = row.unitTypeLookupId && lookupMap
      ? lookupMap.get(row.unitTypeLookupId)
      : undefined;

    return {
      id: row.id,
      name: row.name,
      component: row.component,
      description: row.description,
      type: row.itemType,
      category: row.category,
      subCategory: row.subCategory,
      index: row.sortIndex,
      quantity: row.quantity ? parseDecimal(row.quantity) : 0,
      tax: row.tax ? parseDecimal(row.tax) : undefined,
      unitCost: row.unitCost ? parseDecimal(row.unitCost) : undefined,
      buyCost: row.buyCost ? parseDecimal(row.buyCost) : undefined,
      markupType: row.markupType,
      markupValue: row.markupValue ? parseDecimal(row.markupValue) : undefined,
      unitType: unitTypeLookup
        ? { id: unitTypeLookup.id, name: unitTypeLookup.name, externalReference: unitTypeLookup.externalReference }
        : undefined,
      catalogItemId: row.catalogItemId,
      catalogMissing: hasMissingCatalogRef(row) || undefined,
      internal: row.internal ?? undefined,
      publishStatus: row.publishStatus ?? undefined,
      mismatches,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      note: row.note,
      subTotal: asNumber(totals.subTotal),
      totalTax: asNumber(totals.totalTax),
      total: asNumber(totals.total),
      allocatedCost: row.allocatedCost ? parseDecimal(row.allocatedCost) : undefined,
      committedCost: row.committedCost ? parseDecimal(row.committedCost) : undefined,
    };
  }

  private async explodeAssembly(params: {
    tenantId: string;
    documentKind: DocumentKind;
    groupId: string;
    assemblyId: string;
    quantity: string;
    parentComboId?: string;
    tx: DrizzleDbOrTx;
  }) {
    const assembly = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.assemblyId,
    });
    if (!assembly || (assembly.kind !== 'assembly' && assembly.kind !== 'scope') || !assembly.isActive) {
      throw new NotFoundException('Active assembly or scope not found');
    }
    if (assembly.kind === 'scope' && params.parentComboId) {
      throw new BadRequestException('Scopes cannot be nested inside assemblies or scopes');
    }

    const comboPayload = buildComboPayload({
      kind: assembly.kind,
      parentComboId: params.parentComboId,
    });

    const categoryName = assembly.categoryId
      ? (await this.categoriesRepo.findById({ tenantId: params.tenantId, id: assembly.categoryId }))
          ?.name ?? null
      : null;
    const subCategoryName = assembly.subCategoryId
      ? (await this.categoriesRepo.findById({
          tenantId: params.tenantId,
          id: assembly.subCategoryId,
        }))?.name ?? null
      : null;

    const bomLines = await this.bomRepo.findByAssemblyId({
      tenantId: params.tenantId,
      assemblyId: params.assemblyId,
      tx: params.tx,
    });

    const comboQuantity = params.quantity;
    let comboRecord: Record<string, unknown>;

    if (params.documentKind === 'quote') {
      const [group] = await params.tx
        .select()
        .from(quoteGroups)
        .where(
          and(eq(quoteGroups.id, params.groupId), eq(quoteGroups.tenantId, params.tenantId)),
        )
        .limit(1);
      if (!group) throw new NotFoundException('Quote group not found');

      const [combo] = await params.tx
        .insert(quoteCombos)
        .values({
          tenantId: params.tenantId,
          quoteGroupId: params.groupId,
          catalogComboId: assembly.id,
          name: assembly.name,
          component: assembly.code,
          description: assembly.description,
          category: categoryName,
          subCategory: subCategoryName,
          quantity: comboQuantity,
          comboPayload,
        })
        .returning();
      comboRecord = combo;
    } else if (params.documentKind === 'purchase_order') {
      const [group] = await params.tx
        .select()
        .from(purchaseOrderGroups)
        .where(
          and(
            eq(purchaseOrderGroups.id, params.groupId),
            eq(purchaseOrderGroups.tenantId, params.tenantId),
          ),
        )
        .limit(1);
      if (!group) throw new NotFoundException('Purchase order group not found');

      const [combo] = await params.tx
        .insert(purchaseOrderCombos)
        .values({
          tenantId: params.tenantId,
          purchaseOrderGroupId: params.groupId,
          catalogComboId: assembly.id,
          name: assembly.name,
          description: assembly.description,
          category: categoryName,
          subCategory: subCategoryName,
          quantity: comboQuantity,
          comboPayload,
        })
        .returning();
      comboRecord = combo;
    } else {
      const [group] = await params.tx
        .select()
        .from(workOrderGroups)
        .where(
          and(
            eq(workOrderGroups.id, params.groupId),
            eq(workOrderGroups.tenantId, params.tenantId),
          ),
        )
        .limit(1);
      if (!group) throw new NotFoundException('Work order group not found');

      const [combo] = await params.tx
        .insert(workOrderCombos)
        .values({
          tenantId: params.tenantId,
          workOrderGroupId: params.groupId,
          catalogComboId: assembly.id,
          name: assembly.name,
          description: assembly.description,
          category: categoryName,
          subCategory: subCategoryName,
          quantity: comboQuantity,
          comboPayload,
        })
        .returning();
      comboRecord = combo;
    }

    const itemRows: Record<string, unknown>[] = [];
    let comboSubTotal = 0;
    let comboTax = 0;

    for (let i = 0; i < bomLines.length; i++) {
      const line = bomLines[i];
      const lineQty = formatDecimal(
        parseDecimal(line.quantity) *
          parseDecimal(line.wasteFactor) *
          parseDecimal(comboQuantity),
      );

      if (assembly.kind === 'scope') {
        const component = await this.itemsRepo.findById({
          tenantId: params.tenantId,
          id: line.componentId,
        });
        if (component?.kind === 'assembly') {
          const nested = await this.explodeAssembly({
            tenantId: params.tenantId,
            documentKind: params.documentKind,
            groupId: params.groupId,
            assemblyId: line.componentId,
            quantity: lineQty,
            parentComboId: comboRecord.id as string,
            tx: params.tx,
          });
          const nestedTotals = (nested.combo.totals as Record<string, unknown> | undefined) ?? {};
          comboSubTotal += parseDecimal(String(nestedTotals.subTotal ?? 0));
          comboTax += parseDecimal(String(nestedTotals.totalTax ?? 0));
          continue;
        }
      }

      const snapshot = await this.buildSnapshot({
        tenantId: params.tenantId,
        catalogItemId: line.componentId,
      });
      const totals = computeLineTotals({
        quantity: lineQty,
        unitCost: snapshot.unitCost,
        taxRate: snapshot.tax,
      });
      comboSubTotal += parseDecimal(totals.subTotal);
      comboTax += parseDecimal(totals.totalTax);

      if (params.documentKind === 'quote') {
        const [item] = await params.tx
          .insert(quoteItems)
          .values({
            tenantId: params.tenantId,
            quoteComboId: comboRecord.id as string,
            ...snapshot,
            quantity: lineQty,
            sortIndex: i,
            totals,
          })
          .returning();
        itemRows.push(item);
      } else if (params.documentKind === 'purchase_order') {
        const [item] = await params.tx
          .insert(purchaseOrderItems)
          .values({
            tenantId: params.tenantId,
            purchaseOrderComboId: comboRecord.id as string,
            ...snapshot,
            quantity: lineQty,
            sortIndex: i,
            totals,
          })
          .returning();
        itemRows.push(item);
      } else {
        const [item] = await params.tx
          .insert(workOrderItems)
          .values({
            tenantId: params.tenantId,
            workOrderComboId: comboRecord.id as string,
            ...snapshot,
            quantity: lineQty,
            sortIndex: i,
            totals,
          })
          .returning();
        itemRows.push(item);
      }
    }

    const comboTotals = {
      subTotal: formatDecimal(comboSubTotal),
      totalTax: formatDecimal(comboTax),
      total: formatDecimal(comboSubTotal + comboTax),
    };

    if (params.documentKind === 'quote') {
      await params.tx
        .update(quoteCombos)
        .set({ totals: comboTotals })
        .where(eq(quoteCombos.id, comboRecord.id as string));
    } else if (params.documentKind === 'purchase_order') {
      await params.tx
        .update(purchaseOrderCombos)
        .set({ totals: comboTotals })
        .where(eq(purchaseOrderCombos.id, comboRecord.id as string));
    } else {
      await params.tx
        .update(workOrderCombos)
        .set({ totals: comboTotals })
        .where(eq(workOrderCombos.id, comboRecord.id as string));
    }

    return { combo: { ...comboRecord, totals: comboTotals }, items: itemRows };
  }

  private async buildSnapshot(params: { tenantId: string; catalogItemId: string }) {
    const item = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.catalogItemId,
    });
    if (!item || !item.isActive) {
      throw new NotFoundException('Active catalog item not found');
    }

    const type = await this.typesRepo.findById({ tenantId: params.tenantId, id: item.typeId });
    const categoryName = item.categoryId
      ? (await this.categoriesRepo.findById({ tenantId: params.tenantId, id: item.categoryId }))
          ?.name ?? null
      : null;
    const subCategoryName = item.subCategoryId
      ? (await this.categoriesRepo.findById({
          tenantId: params.tenantId,
          id: item.subCategoryId,
        }))?.name ?? null
      : null;

    const price = await this.pricingService.resolveUnitCost({
      tenantId: params.tenantId,
      itemId: item.id,
    });

    return buildItemSnapshotFields({
      item,
      typeCode: type?.code ?? 'other',
      categoryName,
      subCategoryName,
      unitCost: price.unitCost,
    });
  }
}

function hasMissingCatalogRef(row: { catalogItemId: string | null; itemPayload: unknown }): boolean {
  if (row.catalogItemId) return false;
  const payload = row.itemPayload;
  if (typeof payload !== 'object' || payload === null) return false;
  const id = (payload as Record<string, unknown>).catalogItemId;
  return typeof id === 'string' && id.length > 0;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function nestCombosUnderScopes<TCombo extends { id: string; comboPayload: unknown }>(
  groupCombos: TCombo[],
  mapCombo: (combo: TCombo) => Record<string, unknown>,
): { combos: Record<string, unknown>[]; scopes: Record<string, unknown>[] } {
  const assemblyCombos = groupCombos.filter((c) => !isScopeComboPayload(c.comboPayload));
  const scopeCombos = groupCombos.filter((c) => isScopeComboPayload(c.comboPayload));
  const nestedByParent = new Map<string, TCombo[]>();
  const topLevelAssemblies: TCombo[] = [];

  for (const combo of assemblyCombos) {
    const parentId = parentComboIdFromPayload(combo.comboPayload);
    if (parentId) {
      const list = nestedByParent.get(parentId) ?? [];
      list.push(combo);
      nestedByParent.set(parentId, list);
    } else {
      topLevelAssemblies.push(combo);
    }
  }

  return {
    combos: topLevelAssemblies.map(mapCombo),
    scopes: scopeCombos.map((combo) => ({
      ...mapCombo(combo),
      combos: (nestedByParent.get(combo.id) ?? []).map(mapCombo),
    })),
  };
}
