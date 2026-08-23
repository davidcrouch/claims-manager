import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  purchaseOrderGroups,
  purchaseOrderCombos,
  purchaseOrderItems,
  workOrderGroups,
  workOrderCombos,
  workOrderItems,
  quoteGroups,
  quoteCombos,
  quoteItems,
  catalogItems,
} from '../../../database/schema';
import {
  coerceToRateString,
} from '../../../common/rates';
import { LookupResolutionService } from './lookup-resolution.service';

export interface CatalogWarning {
  itemName: string | undefined;
  catalogItemId: string;
}

export interface SyncResult {
  warnings: CatalogWarning[];
}

function cwTaxToStored(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  return coerceToRateString(value as string | number);
}

function cwGroupLabelName(group: Record<string, unknown>): string | null {
  const label = group.groupLabel;
  if (label && typeof label === 'object') {
    const rec = label as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    if (name) return name;
    const ext = typeof rec.externalReference === 'string' ? rec.externalReference.trim() : '';
    if (ext) return ext;
  }
  const description = typeof group.description === 'string' ? group.description.trim() : '';
  return description || null;
}

function asStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

function asNumStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v.toString();
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return v;
  return undefined;
}

function asBoolVal(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  return undefined;
}

function extractGroupDimensions(group: Record<string, unknown>): Record<string, unknown> {
  const dims: Record<string, unknown> = {};
  if (group.length != null) dims.length = group.length;
  if (group.width != null) dims.width = group.width;
  if (group.height != null) dims.height = group.height;
  if (group.perimeter != null) dims.perimeter = group.perimeter;
  return dims;
}

function extractGroupTotals(group: Record<string, unknown>): Record<string, unknown> {
  const totals: Record<string, unknown> = {};
  if (group.subTotal != null) totals.subTotal = group.subTotal;
  if (group.totalTax != null) totals.totalTax = group.totalTax;
  if (group.total != null) totals.total = group.total;
  return totals;
}

function extractComboTotals(combo: Record<string, unknown>): Record<string, unknown> {
  const totals: Record<string, unknown> = {};
  if (combo.total != null) totals.total = combo.total;
  return totals;
}

function extractQuoteComboTotals(combo: Record<string, unknown>): Record<string, unknown> {
  const totals: Record<string, unknown> = {};
  if (combo.unitCost != null) totals.unitCost = combo.unitCost;
  if (combo.markupValue != null) totals.markupValue = combo.markupValue;
  if (combo.subTotal != null) totals.subTotal = combo.subTotal;
  if (combo.totalTax != null) totals.totalTax = combo.totalTax;
  if (combo.total != null) totals.total = combo.total;
  if (combo.allocatedCost != null) totals.allocatedCost = combo.allocatedCost;
  if (combo.committedCost != null) totals.committedCost = combo.committedCost;
  return totals;
}

function extractItemTotals(item: Record<string, unknown>): Record<string, unknown> {
  const totals: Record<string, unknown> = {};
  if (item.subTotal != null) totals.subTotal = item.subTotal;
  if (item.totalTax != null) totals.totalTax = item.totalTax;
  if (item.total != null) totals.total = item.total;
  return totals;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cwSortIndex(obj: Record<string, unknown>, fallback: number): number {
  const idx = obj.index;
  if (typeof idx === 'number' && Number.isFinite(idx)) return idx;
  if (typeof idx === 'string' && !Number.isNaN(Number(idx))) return Number(idx);
  return fallback;
}

/**
 * Synchronises the three-level line-item hierarchy
 * (groups → combos → items) for a parent entity.
 *
 * Currently supports purchase_order. The service is designed to be
 * extended for quotes and other document types that share the same
 * group/combo/item structure.
 */
@Injectable()
export class LineItemSyncService {
  private readonly logger = new Logger('LineItemSyncService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly lookupResolution: LookupResolutionService,
  ) {}

  private collectCatalogItemIds(groups: Record<string, unknown>[]): string[] {
    const ids = new Set<string>();
    for (const group of groups) {
      for (const item of (group.items as Record<string, unknown>[]) ?? []) {
        const id = asStr(item.catalogItemId);
        if (id) ids.add(id);
      }
      for (const combo of combosFromGroup(group)) {
        for (const item of (combo.items as Record<string, unknown>[]) ?? []) {
          const id = asStr(item.catalogItemId);
          if (id) ids.add(id);
        }
      }
    }
    return [...ids];
  }

  private async resolveValidCatalogIds(params: {
    tenantId: string;
    groups: Record<string, unknown>[];
    tx: DrizzleDbOrTx;
  }): Promise<Set<string>> {
    const candidateIds = this.collectCatalogItemIds(params.groups);
    if (candidateIds.length === 0) return new Set();

    const rows = await params.tx
      .select({ id: catalogItems.id })
      .from(catalogItems)
      .where(inArray(catalogItems.id, candidateIds));

    return new Set(rows.map((r) => r.id));
  }

  private resolveCatalogItemId(
    item: Record<string, unknown>,
    validIds: Set<string>,
    warnings: CatalogWarning[],
  ): string | undefined {
    const id = asStr(item.catalogItemId);
    if (!id) return undefined;
    if (validIds.has(id)) return id;
    warnings.push({ itemName: asStr(item.name), catalogItemId: id });
    return undefined;
  }

  private async resolveGroupLabelLookupId(params: {
    tenantId: string;
    group: Record<string, unknown>;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    const name = cwGroupLabelName(params.group);
    if (!name) return null;
    const label = params.group.groupLabel;
    const extRef =
      label && typeof label === 'object'
        ? (typeof (label as Record<string, unknown>).externalReference === 'string'
            ? String((label as Record<string, unknown>).externalReference).trim()
            : '') || name
        : name;
    return this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: 'group_label',
      externalReference: extRef,
      name,
      autoCreate: true,
      tx: params.tx,
    });
  }

  async syncPurchaseOrderItems(params: {
    purchaseOrderId: string;
    tenantId: string;
    payload: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<SyncResult> {
    const db = params.tx ?? this.db;
    const logPrefix = 'LineItemSyncService.syncPurchaseOrderItems';
    const warnings: CatalogWarning[] = [];

    // Delete-and-recreate: cascading deletes on groups will remove combos and items
    await db
      .delete(purchaseOrderGroups)
      .where(eq(purchaseOrderGroups.purchaseOrderId, params.purchaseOrderId));

    const groups = (params.payload.groups as Record<string, unknown>[]) ?? [];
    const validCatalogIds = await this.resolveValidCatalogIds({ tenantId: params.tenantId, groups, tx: db });
    this.logger.debug(
      `${logPrefix} — PO=${params.purchaseOrderId} groups=${groups.length}`,
    );

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const groupLabelLookupId = await this.resolveGroupLabelLookupId({
        tenantId: params.tenantId,
        group,
        tx: db,
      });
      const labelName = cwGroupLabelName(group);
      const [createdGroup] = await db
        .insert(purchaseOrderGroups)
        .values({
          tenantId: params.tenantId,
          purchaseOrderId: params.purchaseOrderId,
          groupLabelLookupId: groupLabelLookupId ?? undefined,
          description:
            (typeof group.description === 'string' && group.description.trim()
              ? group.description
              : labelName) ?? undefined,
          dimensions: extractGroupDimensions(group),
          totals: extractGroupTotals(group),
          sortIndex: cwSortIndex(group, gi),
          groupPayload: group,
        })
        .returning();

      // Items directly on the group (flat structure from CW API)
      const directItems = (group.items as Record<string, unknown>[]) ?? [];
      for (let ii = 0; ii < directItems.length; ii++) {
        const item = directItems[ii];
        await db.insert(purchaseOrderItems).values({
          tenantId: params.tenantId,
          purchaseOrderGroupId: createdGroup.id,
          purchaseOrderComboId: null,
          catalogItemId: this.resolveCatalogItemId(item, validCatalogIds, warnings),
          quoteLineItemId: asStr(item.quoteLineItemId) ?? undefined,
          name: asStr(item.name),
          description: asStr(item.description),
          category: asStr(item.category),
          subCategory: asStr(item.subCategory),
          itemType: asStr(item.type) ?? asStr(item.itemType),
          quantity: asNumStr(item.quantity),
          tax: cwTaxToStored(item.tax),
          unitCost: asNumStr(item.unitCost),
          buyCost: asNumStr(item.buyCost),
          markupType: asStr(item.markupType),
          markupValue: asNumStr(item.markupValue),
          reconciliation: asNumStr(item.reconciliation),
          manualAllocation: asBoolVal(item.manualAllocation),
          note: asStr(item.note),
          tags: Array.isArray(item.tags) ? item.tags : [],
          sortIndex: cwSortIndex(item, ii),
          itemPayload: item,
        });
      }

      // Items nested within combos / scopes (hierarchical structure)
      const combos = combosFromGroup(group);
      for (let ci = 0; ci < combos.length; ci++) {
        const combo = combos[ci];
        const [createdCombo] = await db
          .insert(purchaseOrderCombos)
          .values({
            tenantId: params.tenantId,
            purchaseOrderGroupId: createdGroup.id,
            catalogComboId: asStr(combo.catalogComboId) ?? undefined,
            quoteComboId: asStr(combo.quoteComboId) ?? undefined,
            name: asStr(combo.name),
            description: asStr(combo.description),
            category: asStr(combo.category),
            subCategory: asStr(combo.subCategory),
            quantity: asNumStr(combo.quantity),
            totals: extractComboTotals(combo),
            sortIndex: cwSortIndex(combo, ci),
            comboPayload: comboPayloadWithKind(combo),
          })
          .returning();

        const items = (combo.items as Record<string, unknown>[]) ?? [];
        for (let ii = 0; ii < items.length; ii++) {
          const item = items[ii];
          await db.insert(purchaseOrderItems).values({
            tenantId: params.tenantId,
            purchaseOrderComboId: createdCombo.id,
            catalogItemId: this.resolveCatalogItemId(item, validCatalogIds, warnings),
            quoteLineItemId: asStr(item.quoteLineItemId) ?? undefined,
            name: asStr(item.name),
            description: asStr(item.description),
            category: asStr(item.category),
            subCategory: asStr(item.subCategory),
            itemType: asStr(item.type) ?? asStr(item.itemType),
            quantity: asNumStr(item.quantity),
            tax: cwTaxToStored(item.tax),
            unitCost: asNumStr(item.unitCost),
            buyCost: asNumStr(item.buyCost),
            markupType: asStr(item.markupType),
            markupValue: asNumStr(item.markupValue),
            reconciliation: asNumStr(item.reconciliation),
            manualAllocation: asBoolVal(item.manualAllocation),
            note: asStr(item.note),
            tags: Array.isArray(item.tags) ? item.tags : [],
            sortIndex: cwSortIndex(item, ii),
            itemPayload: item,
          });
        }
      }
    }

    if (warnings.length > 0) {
      this.logger.warn(
        `${logPrefix} — ${warnings.length} item(s) with unresolved catalog references for PO=${params.purchaseOrderId}: ${warnings.map((w) => `${w.itemName ?? '?'} (${w.catalogItemId})`).join(', ')}`,
      );
    }
    this.logger.log(
      `${logPrefix} — synced ${groups.length} groups for PO=${params.purchaseOrderId}`,
    );
    return { warnings };
  }

  async syncWorkOrderItems(params: {
    workOrderId: string;
    tenantId: string;
    payload: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<SyncResult> {
    const db = params.tx ?? this.db;
    const logPrefix = 'LineItemSyncService.syncWorkOrderItems';
    const warnings: CatalogWarning[] = [];

    await db
      .delete(workOrderGroups)
      .where(eq(workOrderGroups.workOrderId, params.workOrderId));

    const groups = (params.payload.groups as Record<string, unknown>[]) ?? [];
    const validCatalogIds = await this.resolveValidCatalogIds({ tenantId: params.tenantId, groups, tx: db });
    this.logger.debug(
      `${logPrefix} — WO=${params.workOrderId} groups=${groups.length}`,
    );

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const directItems = (group.items as Record<string, unknown>[]) ?? [];
      const groupLabelLookupId = await this.resolveGroupLabelLookupId({
        tenantId: params.tenantId,
        group,
        tx: db,
      });
      const labelName = cwGroupLabelName(group);

      const [createdGroup] = await db
        .insert(workOrderGroups)
        .values({
          tenantId: params.tenantId,
          workOrderId: params.workOrderId,
          groupLabelLookupId: groupLabelLookupId ?? undefined,
          description:
            (typeof group.description === 'string' && group.description.trim()
              ? group.description
              : labelName) ?? undefined,
          dimensions: extractGroupDimensions(group),
          totals: extractGroupTotals(group),
          sortIndex: cwSortIndex(group, gi),
          groupPayload: group,
        })
        .returning();

      // Items directly on the group (flat structure from CW API)
      for (let ii = 0; ii < directItems.length; ii++) {
        const item = directItems[ii];
        await db.insert(workOrderItems).values({
          tenantId: params.tenantId,
          workOrderGroupId: createdGroup.id,
          workOrderComboId: null,
          catalogItemId: this.resolveCatalogItemId(item, validCatalogIds, warnings),
          quoteLineItemId: asStr(item.quoteLineItemId) ?? undefined,
          name: asStr(item.name),
          description: asStr(item.description),
          category: asStr(item.category),
          subCategory: asStr(item.subCategory),
          itemType: asStr(item.type) ?? asStr(item.itemType),
          quantity: asNumStr(item.quantity),
          tax: cwTaxToStored(item.tax),
          unitCost: asNumStr(item.unitCost),
          buyCost: asNumStr(item.buyCost),
          markupType: asStr(item.markupType),
          markupValue: asNumStr(item.markupValue),
          reconciliation: asNumStr(item.reconciliation),
          manualAllocation: asBoolVal(item.manualAllocation),
          note: asStr(item.note),
          tags: Array.isArray(item.tags) ? item.tags : [],
          sortIndex: cwSortIndex(item, ii),
          itemPayload: item,
        });
      }

      // Items nested within combos / scopes (hierarchical structure)
      const nestedCombos = combosFromGroup(group);
      for (let ci = 0; ci < nestedCombos.length; ci++) {
        const combo = nestedCombos[ci];
        const [createdCombo] = await db
          .insert(workOrderCombos)
          .values({
            tenantId: params.tenantId,
            workOrderGroupId: createdGroup.id,
            catalogComboId: asStr(combo.catalogComboId) ?? undefined,
            quoteComboId: asStr(combo.quoteComboId) ?? undefined,
            name: asStr(combo.name),
            description: asStr(combo.description),
            category: asStr(combo.category),
            subCategory: asStr(combo.subCategory),
            quantity: asNumStr(combo.quantity),
            totals: extractComboTotals(combo),
            sortIndex: cwSortIndex(combo, ci),
            comboPayload: comboPayloadWithKind(combo),
          })
          .returning();

        const items = (combo.items as Record<string, unknown>[]) ?? [];
        for (let ii = 0; ii < items.length; ii++) {
          const item = items[ii];
          await db.insert(workOrderItems).values({
            tenantId: params.tenantId,
            workOrderComboId: createdCombo.id,
            catalogItemId: this.resolveCatalogItemId(item, validCatalogIds, warnings),
            quoteLineItemId: asStr(item.quoteLineItemId) ?? undefined,
            name: asStr(item.name),
            description: asStr(item.description),
            category: asStr(item.category),
            subCategory: asStr(item.subCategory),
            itemType: asStr(item.type) ?? asStr(item.itemType),
            quantity: asNumStr(item.quantity),
            tax: cwTaxToStored(item.tax),
            unitCost: asNumStr(item.unitCost),
            buyCost: asNumStr(item.buyCost),
            markupType: asStr(item.markupType),
            markupValue: asNumStr(item.markupValue),
            reconciliation: asNumStr(item.reconciliation),
            manualAllocation: asBoolVal(item.manualAllocation),
            note: asStr(item.note),
            tags: Array.isArray(item.tags) ? item.tags : [],
            sortIndex: cwSortIndex(item, ii),
            itemPayload: item,
          });
        }
      }
    }

    if (warnings.length > 0) {
      this.logger.warn(
        `${logPrefix} — ${warnings.length} item(s) with unresolved catalog references for WO=${params.workOrderId}: ${warnings.map((w) => `${w.itemName ?? '?'} (${w.catalogItemId})`).join(', ')}`,
      );
    }
    this.logger.log(
      `${logPrefix} — synced ${groups.length} groups for WO=${params.workOrderId}`,
    );
    return { warnings };
  }

  async syncQuoteItems(params: {
    quoteId: string;
    tenantId: string;
    payload: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<{ scopeChanges: Array<{ lineType: string; lineName?: string; newStatus?: string }>; warnings: CatalogWarning[] }> {
    const db = params.tx ?? this.db;
    const logPrefix = 'LineItemSyncService.syncQuoteItems';
    const scopeChanges: Array<{ lineType: string; lineName?: string; newStatus?: string }> = [];
    const warnings: CatalogWarning[] = [];

    await db
      .delete(quoteGroups)
      .where(eq(quoteGroups.quoteId, params.quoteId));

    const groups = (params.payload.groups as Record<string, unknown>[]) ?? [];
    const validCatalogIds = await this.resolveValidCatalogIds({ tenantId: params.tenantId, groups, tx: db });
    this.logger.debug(
      `${logPrefix} — Q=${params.quoteId} groups=${groups.length}`,
    );

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const groupLabelLookupId = await this.resolveGroupLabelLookupId({
        tenantId: params.tenantId,
        group,
        tx: db,
      });
      const labelName = cwGroupLabelName(group);
      const [createdGroup] = await db
        .insert(quoteGroups)
        .values({
          tenantId: params.tenantId,
          quoteId: params.quoteId,
          externalReference: asStr(group.id),
          groupLabelLookupId: groupLabelLookupId ?? undefined,
          description:
            (typeof group.description === 'string' && group.description.trim()
              ? group.description
              : labelName) ?? undefined,
          dimensions: extractGroupDimensions(group),
          totals: extractGroupTotals(group),
          sortIndex: cwSortIndex(group, gi),
          groupPayload: group,
        })
        .returning();

      // Items directly on the group (flat structure from CW API)
      const directItems = (group.items as Record<string, unknown>[]) ?? [];
      for (let ii = 0; ii < directItems.length; ii++) {
        const item = directItems[ii];
        const lineScopeId = await this.resolveLineScopeStatusLookupId({ tenantId: params.tenantId, obj: item, tx: db });
        if (lineScopeId) {
          const lss = item.lineScopeStatus as Record<string, unknown> | undefined;
          scopeChanges.push({ lineType: 'item', lineName: asStr(item.name), newStatus: asStr(lss?.name) ?? asStr(lss?.externalReference) });
        }
        const unitTypeId = await this.resolveUnitTypeLookupId({ tenantId: params.tenantId, obj: item, tx: db });
        await db.insert(quoteItems).values({
          tenantId: params.tenantId,
          quoteGroupId: createdGroup.id,
          quoteComboId: null,
          externalReference: asStr(item.id),
          catalogItemId: this.resolveCatalogItemId(item, validCatalogIds, warnings),
          lineScopeStatusLookupId: lineScopeId ?? undefined,
          unitTypeLookupId: unitTypeId ?? undefined,
          name: asStr(item.name),
          component: asStr(item.component),
          description: asStr(item.description),
          category: asStr(item.category),
          subCategory: asStr(item.subCategory),
          itemType: asStr(item.type) ?? asStr(item.itemType),
          quantity: asNumStr(item.quantity),
          tax: cwTaxToStored(item.tax),
          unitCost: asNumStr(item.unitCost),
          buyCost: asNumStr(item.buyCost),
          markupType: asStr(item.markupType),
          markupValue: asNumStr(item.markupValue),
          allocatedCost: asNumStr(item.allocatedCost),
          committedCost: asNumStr(item.committedCost),
          internal: asBoolVal(item.internal),
          note: asStr(item.note),
          tags: Array.isArray(item.tags) ? item.tags : [],
          mismatches: Array.isArray(item.mismatches) ? item.mismatches : [],
          totals: extractItemTotals(item),
          sortIndex: cwSortIndex(item, ii),
          itemPayload: item,
        });
      }

      // Items nested within combos / scopes (hierarchical structure)
      const combos = combosFromGroup(group);
      for (let ci = 0; ci < combos.length; ci++) {
        const combo = combos[ci];
        const comboScopeId = await this.resolveLineScopeStatusLookupId({ tenantId: params.tenantId, obj: combo, tx: db });
        if (comboScopeId) {
          const lss = combo.lineScopeStatus as Record<string, unknown> | undefined;
          scopeChanges.push({ lineType: 'combo', lineName: asStr(combo.name), newStatus: asStr(lss?.name) ?? asStr(lss?.externalReference) });
        }
        const [createdCombo] = await db
          .insert(quoteCombos)
          .values({
            tenantId: params.tenantId,
            quoteGroupId: createdGroup.id,
            externalReference: asStr(combo.id),
            catalogComboId: asStr(combo.catalogComboId) ?? undefined,
            lineScopeStatusLookupId: comboScopeId ?? undefined,
            name: asStr(combo.name),
            component: asStr(combo.component),
            description: asStr(combo.description),
            category: asStr(combo.category),
            subCategory: asStr(combo.subCategory),
            quantity: asNumStr(combo.quantity),
            totals: extractQuoteComboTotals(combo),
            sortIndex: cwSortIndex(combo, ci),
            comboPayload: comboPayloadWithKind(combo),
          })
          .returning();

        const items = (combo.items as Record<string, unknown>[]) ?? [];
        for (let ii = 0; ii < items.length; ii++) {
          const item = items[ii];
          const lineScopeId = await this.resolveLineScopeStatusLookupId({ tenantId: params.tenantId, obj: item, tx: db });
          if (lineScopeId) {
            const lss = item.lineScopeStatus as Record<string, unknown> | undefined;
            scopeChanges.push({ lineType: 'item', lineName: asStr(item.name), newStatus: asStr(lss?.name) ?? asStr(lss?.externalReference) });
          }
          const unitTypeId = await this.resolveUnitTypeLookupId({ tenantId: params.tenantId, obj: item, tx: db });
          await db.insert(quoteItems).values({
            tenantId: params.tenantId,
            quoteComboId: createdCombo.id,
            quoteGroupId: null,
            externalReference: asStr(item.id),
            catalogItemId: this.resolveCatalogItemId(item, validCatalogIds, warnings),
            lineScopeStatusLookupId: lineScopeId ?? undefined,
            unitTypeLookupId: unitTypeId ?? undefined,
            name: asStr(item.name),
            component: asStr(item.component),
            description: asStr(item.description),
            category: asStr(item.category),
            subCategory: asStr(item.subCategory),
            itemType: asStr(item.type) ?? asStr(item.itemType),
            quantity: asNumStr(item.quantity),
            tax: cwTaxToStored(item.tax),
            unitCost: asNumStr(item.unitCost),
            buyCost: asNumStr(item.buyCost),
            markupType: asStr(item.markupType),
            markupValue: asNumStr(item.markupValue),
            allocatedCost: asNumStr(item.allocatedCost),
            committedCost: asNumStr(item.committedCost),
            internal: asBoolVal(item.internal),
            note: asStr(item.note),
            tags: Array.isArray(item.tags) ? item.tags : [],
            mismatches: Array.isArray(item.mismatches) ? item.mismatches : [],
            totals: extractItemTotals(item),
            sortIndex: cwSortIndex(item, ii),
            itemPayload: item,
          });
        }
      }
    }

    if (warnings.length > 0) {
      this.logger.warn(
        `${logPrefix} — ${warnings.length} item(s) with unresolved catalog references for Q=${params.quoteId}: ${warnings.map((w) => `${w.itemName ?? '?'} (${w.catalogItemId})`).join(', ')}`,
      );
    }
    this.logger.log(
      `${logPrefix} — synced ${groups.length} groups for Q=${params.quoteId}, scopeChanges=${scopeChanges.length}`,
    );
    return { scopeChanges, warnings };
  }

  private async resolveLineScopeStatusLookupId(params: {
    tenantId: string;
    obj: Record<string, unknown>;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    const status = params.obj.lineScopeStatus;
    if (!isObj(status)) return null;
    const extRef = asStr(status.externalReference) ?? asStr(status.name);
    if (!extRef) return null;
    return this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: 'line_scope_status',
      externalReference: extRef,
      name: asStr(status.name),
      autoCreate: true,
      tx: params.tx,
    });
  }

  private async resolveUnitTypeLookupId(params: {
    tenantId: string;
    obj: Record<string, unknown>;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    const unitType = params.obj.unitType;
    if (!isObj(unitType)) return null;
    const extRef = asStr(unitType.externalReference) ?? asStr(unitType.name);
    if (!extRef) return null;
    return this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: 'unit_type',
      externalReference: extRef,
      name: asStr(unitType.name),
      autoCreate: true,
      tx: params.tx,
    });
  }
}

function combosFromGroup(group: Record<string, unknown>): Record<string, unknown>[] {
  const combos = Array.isArray(group.combos)
    ? [...(group.combos as Record<string, unknown>[])]
    : [];
  const scopes = Array.isArray(group.scopes) ? (group.scopes as Record<string, unknown>[]) : [];
  for (const scope of scopes) {
    combos.push({ ...scope, kind: 'scope' });
  }
  return combos;
}

function comboPayloadWithKind(combo: Record<string, unknown>): Record<string, unknown> {
  const existing =
    combo.comboPayload && typeof combo.comboPayload === 'object'
      ? (combo.comboPayload as Record<string, unknown>)
      : {};
  const kind = combo.kind ?? existing.kind ?? 'assembly';
  return { ...combo, kind, comboPayload: { ...existing, kind } };
}
