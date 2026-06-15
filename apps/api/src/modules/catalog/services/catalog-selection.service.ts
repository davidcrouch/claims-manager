import { BadRequestException, Injectable, NotFoundException, Inject } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  CatalogCategoriesRepository,
  CatalogItemTypesRepository,
  CatalogItemsRepository,
  CatalogAssemblyComponentsRepository,
} from '../../../database/repositories';
import {
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

@Injectable()
export class CatalogSelectionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly itemsRepo: CatalogItemsRepository,
    private readonly typesRepo: CatalogItemTypesRepository,
    private readonly categoriesRepo: CatalogCategoriesRepository,
    private readonly bomRepo: CatalogAssemblyComponentsRepository,
    private readonly pricingService: CatalogPricingService,
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

  async getQuoteLineItems(params: { quoteId: string }) {
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

      return {
        id: group.id,
        groupLabel: group.description
          ? { name: group.description }
          : { name: `Group ${index + 1}` },
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
