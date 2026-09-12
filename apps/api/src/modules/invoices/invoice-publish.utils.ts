/**
 * Crunchwork Insurance REST API invoice helpers.
 *
 * Full-amount vendor tax invoices — POST /invoices:
 *   CreateVendorTaxInvoiceInput { invoiceType, purchaseOrderId }
 *   then POST /invoices/{id} with completed + pricing (quantity is locked).
 *
 * Partial / 2nd+ claims — POST /progress-invoices (CreateTradeInvoiceInput):
 *   header totals only ({ purchaseOrderId, invoiceNumber, total, totalTax, … }).
 *   Required when the PO already has a vendor-tax invoice and Partial Invoicing
 *   is disabled on the CW tenant (second POST /invoices is rejected).
 *
 * InvoiceGroup.subTotal/total/totalTax are response-only on vendor-tax invoices.
 * Do not send header totals on vendor-tax create (not on CreateVendorTaxInvoiceInput).
 */

import { copyUnitCostToBuyCostForCrunchwork } from '../catalog/catalog.utils';
import {
  coerceToRate,
  isFixedMarkupType,
  isPercentMarkupType,
} from '../../common/rates';

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

export type CrunchworkInvoiceKind = 'progress' | 'vendorTax';

/** Sum matching keys across invoicedAmounts maps (siblings + current). */
export function mergeInvoicedAmountMaps(
  maps: Array<Record<string, number> | null | undefined>,
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  let any = false;
  for (const map of maps) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) continue;
    for (const [key, raw] of Object.entries(map)) {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) continue;
      any = true;
      out[key] = roundCents((out[key] ?? 0) + n);
    }
  }
  return any ? out : undefined;
}

/**
 * Trade invoice body for POST /progress-invoices (when enabled on the tenant).
 * Header-level totals only — no line groups.
 */
export function buildCrunchworkProgressInvoiceBody(params: {
  purchaseOrderId: string;
  invoiceNumber?: string | null;
  issueDate?: string | null;
  comments?: string | null;
  total: number;
  totalTax?: number | null;
}): JsonObject {
  const body: JsonObject = {
    purchaseOrderId: params.purchaseOrderId,
    total: roundCents(params.total),
  };
  if (params.invoiceNumber) body.invoiceNumber = params.invoiceNumber;
  if (params.issueDate) body.issueDate = params.issueDate;
  if (params.comments) body.comments = params.comments;
  if (params.totalTax != null && Number.isFinite(params.totalTax)) {
    body.totalTax = roundCents(params.totalTax);
  }
  return body;
}

/**
 * Publish as a CW progress invoice when invoice total < WO/PO billable total,
 * or when a sibling has already been published to Crunchwork.
 */
export function shouldUseCrunchworkProgressInvoice(params: {
  invoiceTotal: number;
  billableTotal: number;
  hasPriorPublishedSibling: boolean;
}): boolean {
  if (params.hasPriorPublishedSibling) return true;
  const invoiceTotal = Number(params.invoiceTotal);
  const billableTotal = Number(params.billableTotal);
  if (!Number.isFinite(invoiceTotal) || invoiceTotal <= 0) return false;
  if (!Number.isFinite(billableTotal) || billableTotal <= 0) return false;
  return invoiceTotal + 0.02 < billableTotal;
}

/** GST-inclusive commercial total for a priced line (qty × unit ± markup + tax). */
export function itemInclusiveLineTotal(item: JsonObject): number {
  const qty = Number(item.quantity);
  const unitCost = Number(item.unitCost);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  if (!Number.isFinite(unitCost) || unitCost < 0) return 0;
  const perUnitNet = netUnitAmount(item, unitCost);
  if (!(perUnitNet > 0)) return 0;
  const taxRate = jsonRate(item.tax);
  return roundCents(qty * perUnitNet * (1 + taxRate));
}

/** Sum GST-inclusive line totals across outbound invoice groups. */
export function sumLocalGroupsInclusiveTotal(groups: JsonObject[]): number {
  let sum = 0;
  for (const item of walkInvoiceItems(groups)) {
    sum += itemInclusiveLineTotal(item);
  }
  return roundCents(sum);
}

/**
 * Resolve progress-invoice total + tax from header and/or per-line allocations.
 * Prefer unique allocated amounts; fall back to header total with tax inferred
 * from allocated / priced lines.
 */
export function computeProgressInvoiceMoney(params: {
  groups: JsonObject[];
  invoicedAmounts?: Record<string, number> | null;
  headerTotal?: number | null;
}): { total: number; totalTax: number; subTotal: number } {
  const amounts = params.invoicedAmounts;
  const allocatedRows: { inclusive: number; taxRate: number }[] = [];

  if (amounts && typeof amounts === 'object' && !Array.isArray(amounts)) {
    const seen = new Set<string>();
    for (const item of walkInvoiceItems(params.groups)) {
      const keys = invoiceItemMatchKeys(item);
      const primary = keys[0];
      if (!primary || seen.has(primary)) continue;
      seen.add(primary);
      const inclusive = lookupInvoicedAmount(amounts, item);
      if (inclusive == null || inclusive <= 0) continue;
      allocatedRows.push({ inclusive, taxRate: jsonRate(item.tax) });
    }
  }

  if (allocatedRows.length > 0) {
    let total = 0;
    let totalTax = 0;
    for (const row of allocatedRows) {
      total += row.inclusive;
      const ex = row.taxRate > 0 ? row.inclusive / (1 + row.taxRate) : row.inclusive;
      totalTax += row.inclusive - ex;
    }
    total = roundCents(total);
    totalTax = roundCents(totalTax);
    return { total, totalTax, subTotal: roundCents(total - totalTax) };
  }

  const header = Number(params.headerTotal);
  const total =
    Number.isFinite(header) && header > 0
      ? roundCents(header)
      : sumLocalGroupsInclusiveTotal(params.groups);
  const taxRate = inferGroupsTaxRate(params.groups);
  const subTotal = taxRate > 0 ? roundCents(total / (1 + taxRate)) : total;
  return { total, totalTax: roundCents(total - subTotal), subTotal };
}

function walkInvoiceItems(groups: JsonObject[]): JsonObject[] {
  const items: JsonObject[] = [];
  for (const group of groups) {
    for (const item of asObjectArray(group.items)) items.push(item);
    for (const combo of asObjectArray(group.combos)) {
      for (const item of asObjectArray(combo.items)) items.push(item);
    }
  }
  return items;
}

function inferGroupsTaxRate(groups: JsonObject[]): number {
  for (const item of walkInvoiceItems(groups)) {
    const rate = jsonRate(item.tax);
    if (rate > 0) return rate;
  }
  return 0;
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
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
 * - amount > 0 → completed: true; adjust unitCost (keep PO quantity — CW locks
 *   quantity on vendor-tax clones) so the line totals the GST-inclusive
 *   allocated amount after tax/markup
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
    const qtyRaw = Number(item.quantity);
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
    if (!(Number.isFinite(qtyRaw) && qtyRaw > 0)) {
      item.quantity = 1;
    }
    // Keep quantity; scale unitCost so qty × net × (1+tax) ≈ allocated.
    const inclusivePerUnit = allocated / qty;
    item.unitCost = roundMoney(unitCostFromInclusive(inclusivePerUnit, item));
    copyUnitCostToBuyCostForCrunchwork(item);
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

function jsonRate(value: unknown): number {
  if (typeof value === 'string' || typeof value === 'number') {
    return coerceToRate(value);
  }
  return coerceToRate(undefined);
}

/**
 * Ex-GST commercial amount per unit of quantity (unitCost ± markup), matching
 * frontend `computeItemMoney` so qty = exTaxAllocated / perUnitNet.
 */
function netUnitAmount(item: JsonObject, unitCost: number): number {
  const markupType =
    typeof item.markupType === 'string' ? item.markupType : null;
  if (isFixedMarkupType(markupType)) {
    const fixed = Number(item.markupValue);
    return unitCost + (Number.isFinite(fixed) ? fixed : 0);
  }
  if (isPercentMarkupType(markupType)) {
    return unitCost * (1 + jsonRate(item.markupValue));
  }
  return unitCost;
}

/** Derive unitCost for qty=1 so CW total equals the GST-inclusive allocation. */
function unitCostFromInclusive(allocatedInclusive: number, item: JsonObject): number {
  const taxRate = jsonRate(item.tax);
  const exTax = taxRate > 0 ? allocatedInclusive / (1 + taxRate) : allocatedInclusive;
  const markupType =
    typeof item.markupType === 'string' ? item.markupType : null;
  if (isFixedMarkupType(markupType)) {
    const fixed = Number(item.markupValue);
    return exTax - (Number.isFinite(fixed) ? fixed : 0);
  }
  if (isPercentMarkupType(markupType)) {
    const markupRate = jsonRate(item.markupValue);
    return markupRate > 0 ? exTax / (1 + markupRate) : exTax;
  }
  return exTax;
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
  // Do not send combo.quantity — CW locks quantities cloned from the PO.
  return items.length > 0 ? out : { id: combo.id };
}

function toInvoiceUpdateItem(item: JsonObject): JsonObject | null {
  if (typeof item.id !== 'string' || !item.id) return null;
  if (item.completed === false) {
    return { id: item.id, completed: false };
  }
  const out: JsonObject = { id: item.id, completed: true };
  // Do not send quantity — CW locks PO-cloned line quantities
  // ("quantity on item … is locked and cannot be modified").
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
