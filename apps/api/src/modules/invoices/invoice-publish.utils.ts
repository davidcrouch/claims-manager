/**
 * Crunchwork Insurance REST API invoice helpers.
 *
 * POST /invoices accepts oneOf:
 *   - CreateVendorTaxInvoiceInput { invoiceType, purchaseOrderId }
 *     clones PO groups/items but does not invoice them — group totals stay 0
 *     until items are updated with completed + unitCost/quantity/tax.
 *   - CreateInvoiceInput { name, account, invoiceType, groups[] }
 *
 * InvoiceGroup.subTotal/total/totalTax are response-only; CW computes them
 * from completed line items. Do not send header totals on vendor-tax create
 * (they are not on CreateVendorTaxInvoiceInput and can prevent the PO clone).
 */

import { copyUnitCostToBuyCostForCrunchwork } from '../catalog/catalog.utils';

type JsonObject = Record<string, unknown>;

/**
 * CW create-invoice often echoes totals as 0. Keep a non-zero local amount
 * instead of overwriting it with a stub provider value.
 */
export function preferExistingAmount(
  providerValue: unknown,
  existing: string | number | null | undefined,
): string | undefined {
  const existingRaw =
    existing == null || existing === '' ? undefined : String(existing);
  const existingN = existingRaw != null ? Number(existingRaw) : NaN;
  const hasExisting = Number.isFinite(existingN) && existingN !== 0;

  if (providerValue == null || providerValue === '') {
    return existingRaw;
  }
  const providerRaw = String(providerValue);
  const providerN = Number(providerRaw);
  if ((!Number.isFinite(providerN) || providerN === 0) && hasExisting) {
    return existingRaw;
  }
  return providerRaw;
}

export function buildCrunchworkVendorTaxInvoiceCreateBody(params: {
  purchaseOrderId: string;
}): JsonObject {
  return {
    purchaseOrderId: params.purchaseOrderId,
    // CreateVendorTaxInvoiceInput — CW resolves this to a Vendor Tax Invoice.
    // Omitting invoiceType causes upstream: Cannot read properties of undefined (reading 'externalReference').
    invoiceType: { externalReference: 'Invoice' },
  };
}

export function crunchworkInvoiceGroupsFromPayload(
  payload: Record<string, unknown> | null | undefined,
): JsonObject[] {
  if (!payload || !Array.isArray(payload.groups)) return [];
  return payload.groups.filter(
    (g): g is JsonObject => typeof g === 'object' && g !== null,
  );
}

export function crunchworkPurchaseOrderId(
  invoice: Record<string, unknown>,
): string | undefined {
  if (typeof invoice.purchaseOrderId === 'string' && invoice.purchaseOrderId) {
    return invoice.purchaseOrderId;
  }
  const nested = invoice.purchaseOrder;
  if (nested && typeof nested === 'object' && nested !== null) {
    const id = (nested as JsonObject).id;
    if (typeof id === 'string' && id) return id;
  }
  return undefined;
}

/**
 * Prefer the invoice that belongs to this CW purchase order. If the job has a
 * single invoice, use that even without a PO match (vendor-tax clone).
 */
export function pickCrunchworkInvoiceIdForPurchaseOrder(params: {
  invoices: Record<string, unknown>[];
  purchaseOrderId: string;
}): string | undefined {
  const withId = params.invoices.filter(
    (inv): inv is JsonObject =>
      typeof inv === 'object' && inv !== null && typeof inv.id === 'string' && !!inv.id,
  );
  const matched = withId.find(
    (inv) => crunchworkPurchaseOrderId(inv) === params.purchaseOrderId,
  );
  if (matched && typeof matched.id === 'string') return matched.id;
  if (withId.length === 1 && typeof withId[0].id === 'string') return withId[0].id;
  return undefined;
}

/**
 * Copy local unitCost/quantity/tax/markup onto CW-cloned invoice groups and
 * mark every line completed so CW will compute group totals. buyCost on the
 * outbound payload is always a copy of unitCost.
 */
export function applyLocalPricingToCrunchworkInvoiceGroups(params: {
  cwGroups: JsonObject[];
  localGroups: JsonObject[];
}): JsonObject[] {
  const cwGroups = structuredClone(params.cwGroups);
  const usedGroups = new Set<number>();

  for (const cwGroup of cwGroups) {
    const localIdx = findMatchIndex(cwGroup, params.localGroups, usedGroups, [], {
      positionalFallback: true,
    });
    const localGroup = localIdx >= 0 ? params.localGroups[localIdx] : undefined;
    if (localIdx >= 0) usedGroups.add(localIdx);

    overlayItems({
      cwItems: asObjectArray(cwGroup.items),
      localItems: asObjectArray(localGroup?.items),
    });
    overlayCombos({
      cwCombos: asObjectArray(cwGroup.combos),
      localCombos: asObjectArray(localGroup?.combos),
    });
  }

  return cwGroups;
}

/**
 * Apply draft `invoicePayload.invoicedAmounts` onto priced CW groups before
 * update. When the map is present:
 * - amount <= 0 or missing → completed: false
 * - amount > 0 → completed: true; quantity = amount/unitCost (or qty=1, unitCost=amount)
 * When the map is absent, groups are returned unchanged (full-line publish).
 */
export function applyInvoicedAmountOverridesToGroups(params: {
  groups: JsonObject[];
  invoicedAmounts: Record<string, number> | null | undefined;
}): JsonObject[] {
  const amounts = params.invoicedAmounts;
  if (!amounts || typeof amounts !== 'object' || Array.isArray(amounts)) {
    return params.groups;
  }
  if (Object.keys(amounts).length === 0) return params.groups;

  const groups = structuredClone(params.groups);

  const visitItem = (item: JsonObject) => {
    const allocated = lookupInvoicedAmount(amounts, item);
    if (allocated == null || allocated <= 0) {
      item.completed = false;
      return;
    }
    item.completed = true;
    const unitCost = Number(item.unitCost);
    if (Number.isFinite(unitCost) && unitCost > 0) {
      item.quantity = roundMoney(allocated / unitCost);
    } else {
      item.quantity = 1;
      item.unitCost = allocated;
      copyUnitCostToBuyCostForCrunchwork(item);
    }
  };

  for (const group of groups) {
    for (const item of asObjectArray(group.items)) visitItem(item);
    for (const combo of asObjectArray(group.combos)) {
      for (const item of asObjectArray(combo.items)) visitItem(item);
    }
  }

  return groups;
}

function roundMoney(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function lookupInvoicedAmount(
  amounts: Record<string, number>,
  item: JsonObject,
): number | null {
  for (const key of invoiceItemMatchKeys(item)) {
    const raw = amounts[key];
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Match keys aligned with frontend bill/invoice line progress. */
export function invoiceItemMatchKeys(item: JsonObject): string[] {
  const keys: string[] = [];
  if (typeof item.id === 'string' && item.id) keys.push(`id:${item.id}`);
  if (typeof item.catalogItemId === 'string' && item.catalogItemId) {
    keys.push(`catalog:${item.catalogItemId}`);
  }
  const name =
    typeof item.name === 'string' ? item.name.trim().toLowerCase() : '';
  if (name) {
    const index =
      item.index != null && Number.isFinite(Number(item.index))
        ? Number(item.index)
        : 0;
    keys.push(`name:${name}:${index}`);
  }
  return keys;
}

/**
 * InvoiceUpdateGroupInput / InvoiceUpdateItemInput — ids from create, plus
 * completed and pricing. Drop response-only totals and nested id objects.
 */
export function toInvoiceUpdateGroups(cwGroups: JsonObject[]): JsonObject[] {
  const groups: JsonObject[] = [];
  for (const group of cwGroups) {
    if (typeof group.id !== 'string' || !group.id) continue;
    const items = asObjectArray(group.items)
      .map(toInvoiceUpdateItem)
      .filter((item): item is JsonObject => item != null);
    const combos = asObjectArray(group.combos)
      .map(toInvoiceUpdateCombo)
      .filter((combo): combo is JsonObject => combo != null);
    if (items.length === 0 && combos.length === 0) continue;
    const out: JsonObject = { id: group.id };
    if (items.length > 0) out.items = items;
    if (combos.length > 0) out.combos = combos;
    groups.push(out);
  }
  return groups;
}

function toInvoiceUpdateCombo(combo: JsonObject): JsonObject | null {
  if (typeof combo.id !== 'string' || !combo.id) return null;
  const items = asObjectArray(combo.items)
    .map(toInvoiceUpdateItem)
    .filter((item): item is JsonObject => item != null);
  const out: JsonObject = { id: combo.id };
  if (items.length > 0) out.items = items;
  if (combo.quantity != null && combo.quantity !== '') {
    const qty = Number(combo.quantity);
    if (Number.isFinite(qty)) out.quantity = qty;
  }
  return items.length > 0 || out.quantity != null ? out : { id: combo.id };
}

function toInvoiceUpdateItem(item: JsonObject): JsonObject | null {
  if (typeof item.id !== 'string' || !item.id) return null;
  if (item.completed === false) {
    return { id: item.id, completed: false };
  }
  const out: JsonObject = { id: item.id, completed: true };
  copyNumberIfPresent(item, out, 'quantity');
  copyNumberIfPresent(item, out, 'unitCost');
  copyUnitCostToBuyCostForCrunchwork(out);
  copyNumberIfPresent(item, out, 'tax');
  copyNumberIfPresent(item, out, 'markupValue');
  if (typeof item.markupType === 'string' && item.markupType) {
    out.markupType = item.markupType;
  }
  const unitType = toExternalReference(item.unitType);
  if (unitType) out.unitType = unitType;
  return out;
}

function overlayCombos(params: {
  cwCombos: JsonObject[];
  localCombos: JsonObject[];
}): void {
  const used = new Set<number>();
  for (const cwCombo of params.cwCombos) {
    const localIdx = findMatchIndex(
      cwCombo,
      params.localCombos,
      used,
      ['catalogComboId'],
      { positionalFallback: true },
    );
    const localCombo =
      localIdx >= 0 ? params.localCombos[localIdx] : undefined;
    if (localIdx >= 0) used.add(localIdx);
    if (localCombo?.quantity != null) cwCombo.quantity = localCombo.quantity;
    overlayItems({
      cwItems: asObjectArray(cwCombo.items),
      localItems: asObjectArray(localCombo?.items),
    });
  }
}

function overlayItems(params: {
  cwItems: JsonObject[];
  localItems: JsonObject[];
}): void {
  const used = new Set<number>();
  for (const cwItem of params.cwItems) {
    const localIdx = findMatchIndex(cwItem, params.localItems, used, [
      'catalogItemId',
    ]);
    if (localIdx >= 0) {
      used.add(localIdx);
      applyItemPricing(cwItem, params.localItems[localIdx]);
    }
    cwItem.completed = true;
    copyUnitCostToBuyCostForCrunchwork(cwItem);
  }
}

const PRICING_FIELDS = [
  'quantity',
  'unitCost',
  'tax',
  'markupType',
  'markupValue',
] as const;

function applyItemPricing(cwItem: JsonObject, localItem: JsonObject): void {
  for (const field of PRICING_FIELDS) {
    if (localItem[field] != null && localItem[field] !== '') {
      cwItem[field] = localItem[field];
    }
  }
  if (localItem.unitType != null) cwItem.unitType = localItem.unitType;
}

function findMatchIndex(
  cw: JsonObject,
  locals: JsonObject[],
  used: Set<number>,
  idKeys: string[] = [],
  options?: { positionalFallback?: boolean },
): number {
  for (const key of idKeys) {
    const cwId = asNonEmptyString(cw[key]);
    if (!cwId) continue;
    const idx = locals.findIndex(
      (local, i) => !used.has(i) && asNonEmptyString(local[key]) === cwId,
    );
    if (idx >= 0) return idx;
  }

  const cwName = normaliseName(cw.name);
  if (cwName) {
    const idx = locals.findIndex(
      (local, i) => !used.has(i) && normaliseName(local.name) === cwName,
    );
    if (idx >= 0) return idx;
  }

  if (cw.index != null) {
    const cwIndex = Number(cw.index);
    if (Number.isFinite(cwIndex)) {
      const idx = locals.findIndex(
        (local, i) => !used.has(i) && Number(local.index) === cwIndex,
      );
      if (idx >= 0) return idx;
    }
  }

  if (options?.positionalFallback) {
    return locals.findIndex((_, i) => !used.has(i));
  }

  return -1;
}

function asObjectArray(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is JsonObject => typeof row === 'object' && row !== null,
  );
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function normaliseName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toExternalReference(
  value: unknown,
): { externalReference: string } | undefined {
  if (typeof value !== 'object' || value == null) return undefined;
  const ref = (value as JsonObject).externalReference;
  return typeof ref === 'string' && ref.trim()
    ? { externalReference: ref.trim() }
    : undefined;
}

function copyNumberIfPresent(
  source: JsonObject,
  target: JsonObject,
  field: string,
): void {
  if (source[field] == null || source[field] === '') return;
  const n = Number(source[field]);
  if (Number.isFinite(n)) target[field] = n;
}
