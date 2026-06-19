import { BadRequestException, Injectable, NotFoundException, Inject } from '@nestjs/common';
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
  buildItemSnapshotFields,
  computeLineTotals,
  formatDecimal,
  parseDecimal,
} from '../catalog.utils';
import { CatalogPricingService } from './catalog-pricing.service';

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
  }) {
    const tenantId = this.getTenantId();
    return this.db.transaction(async (tx) => {
      const result = await this.explodeAssembly({
        tenantId,
        documentKind: 'quote',
        groupId: params.quoteGroupId,
        assemblyId: params.catalogAssemblyId,
        quantity: params.quantity,
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
      .select({ id: quoteCombos.id })
      .from(quoteCombos)
      .where(
        and(
          eq(quoteCombos.id, params.comboId),
          eq(quoteCombos.tenantId, tenantId),
          isNull(quoteCombos.deletedAt),
        ),
      );
    if (!combo) throw new NotFoundException('Quote assembly not found');

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

  async updateQuoteLineItems(params: {
    quoteId: string;
    items: Array<{
      id: string;
      name?: string;
      description?: string;
      quantity?: string;
      unitCost?: string;
      markupValue?: string;
      tax?: string;
    }>;
    combos: Array<{
      id: string;
      quantity?: string;
    }>;
  }) {
    const tenantId = this.getTenantId();

    await this.db.transaction(async (tx) => {
      for (const item of params.items) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (item.name !== undefined) updates.name = item.name;
        if (item.description !== undefined) updates.description = item.description;
        if (item.quantity !== undefined) updates.quantity = item.quantity;
        if (item.unitCost !== undefined) updates.unitCost = item.unitCost;
        if (item.markupValue !== undefined) updates.markupValue = item.markupValue;
        if (item.tax !== undefined) updates.tax = item.tax;

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
        if (combo.quantity !== undefined) updates.quantity = combo.quantity;

        if (Object.keys(updates).length > 0) {
          await tx
            .update(quoteCombos)
            .set(updates)
            .where(and(eq(quoteCombos.id, combo.id), eq(quoteCombos.tenantId, tenantId)));
        }
      }
    });

    return { updated: params.items.length + params.combos.length };
  }

  async getQuoteLineItems(params: { quoteId: string }) {
    const tenantId = this.getTenantId();
    const groups = await this.listQuoteGroups({ quoteId: params.quoteId });
    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.id);

    const lookupIds = new Set<string>();
    for (const g of groups) {
      if (g.groupLabelLookupId) lookupIds.add(g.groupLabelLookupId);
    }
    const lookupMap = await this.lookupsRepo.findByIds({ ids: [...lookupIds], tenantId });

    const combos = await this.db
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
    const directItems =
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

    const comboItems =
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

    return groups.map((group, index) => {
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

      return {
        id: group.id,
        groupLabel: groupLabelObj,
        description: group.description,
        length: asNumber(dimensions.length),
        width: asNumber(dimensions.width),
        height: asNumber(dimensions.height),
        index: group.sortIndex,
        subTotal: asNumber(groupTotals.subTotal),
        totalTax: asNumber(groupTotals.totalTax),
        total: asNumber(groupTotals.total),
        items: (directItemsByGroup.get(group.id) ?? []).map((item) =>
          this.mapQuoteItemRow(item),
        ),
        combos: groupCombos.map((combo) => {
          const comboTotals = (combo.totals as Record<string, unknown>) ?? {};
          return {
            id: combo.id,
            name: combo.name,
            description: combo.description,
            category: combo.category,
            subCategory: combo.subCategory,
            index: combo.sortIndex,
            quantity: combo.quantity ? parseDecimal(combo.quantity) : undefined,
            catalogComboId: combo.catalogComboId,
            subTotal: asNumber(comboTotals.subTotal),
            totalTax: asNumber(comboTotals.totalTax),
            total: asNumber(comboTotals.total),
            items: (comboItemsByCombo.get(combo.id) ?? []).map((item) =>
              this.mapQuoteItemRow(item),
            ),
          };
        }),
      };
    });
  }

  /**
   * Builds the `groups` array shaped for the Crunchwork POST /quotes body.
   * Resolves all lookup IDs to their external references.
   */
  async buildOutboundQuoteGroups(params: { quoteId: string }): Promise<Record<string, unknown>[]> {
    const tenantId = this.getTenantId();
    const groups = await this.listQuoteGroups({ quoteId: params.quoteId });
    if (groups.length === 0) return [];

    const groupIds = groups.map((g) => g.id);
    const combos = await this.db
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
    const directItems =
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

    const comboItems =
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

    const allItems = [...directItems, ...comboItems];
    const lookupIds = new Set<string>();
    for (const g of groups) {
      if (g.groupLabelLookupId) lookupIds.add(g.groupLabelLookupId);
    }
    for (const c of combos) {
      if (c.lineScopeStatusLookupId) lookupIds.add(c.lineScopeStatusLookupId);
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

    const catalogItemIds = new Set<string>();
    for (const item of allItems) {
      if (item.catalogItemId) catalogItemIds.add(item.catalogItemId);
    }
    for (const combo of combos) {
      if (combo.catalogComboId) catalogItemIds.add(combo.catalogComboId);
    }
    const catalogExtRefMap = await this.itemsRepo.findExternalReferences({
      tenantId,
      ids: [...catalogItemIds],
    });

    const mapItem = (row: typeof quoteItems.$inferSelect): Record<string, unknown> => {
      const result: Record<string, unknown> = {};
      if (row.externalReference) result.id = row.externalReference;
      if (row.catalogItemId) {
        const extRef = catalogExtRefMap.get(row.catalogItemId);
        if (extRef) result.catalogItemId = extRef;
      }
      if (row.name) result.name = row.name;
      if (row.description) result.description = row.description;
      if (row.itemType) result.type = normaliseCwItemType(row.itemType);
      if (row.category) result.category = row.category;
      if (row.subCategory) result.subCategory = row.subCategory;
      result.index = row.sortIndex;
      if (row.quantity) result.quantity = parseDecimal(row.quantity);
      if (row.tax) result.tax = parseDecimal(row.tax);
      if (row.unitCost) result.unitCost = parseDecimal(row.unitCost);
      if (row.buyCost) result.buyCost = parseDecimal(row.buyCost);
      const cwMarkup = normaliseCwMarkupType(row.markupType);
      if (cwMarkup) result.markupType = cwMarkup;
      if (row.markupValue) result.markupValue = parseDecimal(row.markupValue);
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

    return groups.map((group) => {
      const dims = (group.dimensions as Record<string, unknown>) ?? {};
      const groupCombos = combosByGroup.get(group.id) ?? [];
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
      result.index = group.sortIndex;

      const groupDirectItems = (directItemsByGroup.get(group.id) ?? []).map(mapItem);
      if (groupDirectItems.length > 0) result.items = groupDirectItems;

      if (groupCombos.length > 0) {
        result.combos = groupCombos.map((combo) => {
          const comboResult: Record<string, unknown> = {};
          if (combo.externalReference) comboResult.id = combo.externalReference;
          if (combo.catalogComboId) {
            const extRef = catalogExtRefMap.get(combo.catalogComboId);
            if (extRef) comboResult.catalogComboId = extRef;
          }
          if (combo.name) comboResult.name = combo.name;
          if (combo.description) comboResult.description = combo.description;
          if (combo.category) comboResult.category = combo.category;
          if (combo.subCategory) comboResult.subCategory = combo.subCategory;
          comboResult.index = combo.sortIndex;
          if (combo.quantity) comboResult.quantity = parseDecimal(combo.quantity);
          const lss = resolveLookup(combo.lineScopeStatusLookupId);
          if (lss) comboResult.lineScopeStatus = lss;
          const items = (comboItemsByCombo.get(combo.id) ?? []).map(mapItem);
          if (items.length > 0) comboResult.items = items;
          return comboResult;
        });
      }

      return result;
    });
  }

  private mapQuoteItemRow(row: typeof quoteItems.$inferSelect) {
    const totals = (row.totals as Record<string, unknown>) ?? {};
    const mismatches = Array.isArray(row.mismatches)
      ? (row.mismatches as Array<{ property?: string; catalogValue?: string }>)
      : [];

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
      catalogItemId: row.catalogItemId,
      internal: row.internal ?? undefined,
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
    tx: DrizzleDbOrTx;
  }) {
    const assembly = await this.itemsRepo.findById({
      tenantId: params.tenantId,
      id: params.assemblyId,
    });
    if (!assembly || assembly.kind !== 'assembly' || !assembly.isActive) {
      throw new NotFoundException('Active assembly not found');
    }

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

    if (bomLines.length === 0) {
      throw new BadRequestException('Assembly has no BOM components');
    }

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
          description: assembly.description,
          category: categoryName,
          subCategory: subCategoryName,
          quantity: comboQuantity,
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

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
