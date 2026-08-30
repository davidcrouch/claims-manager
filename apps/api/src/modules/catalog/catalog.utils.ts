import type { CatalogItemRow } from '../../database/repositories/catalog-items.repository';

export type CatalogItemKind = 'primitive' | 'assembly' | 'scope';
export type CatalogPricingMode = 'computed' | 'fixed' | 'cost_plus';

export function isCatalogBomParentKind(kind: string): kind is 'assembly' | 'scope' {
  return kind === 'assembly' || kind === 'scope';
}

/**
 * Hierarchy rules for BOM lines:
 * - assembly → primitive only
 * - scope → primitive or assembly (not scope)
 * - scopes never nest under anything
 */
export function isAllowedBomComponent(
  parentKind: CatalogItemKind | string,
  componentKind: CatalogItemKind | string,
): boolean {
  if (componentKind === 'scope') return false;
  if (parentKind === 'assembly') return componentKind === 'primitive';
  if (parentKind === 'scope') {
    return componentKind === 'primitive' || componentKind === 'assembly';
  }
  return false;
}

export function bomComponentRuleMessage(
  parentKind: CatalogItemKind | string,
  componentKind: CatalogItemKind | string,
): string {
  if (componentKind === 'scope') {
    return 'Scopes cannot be nested inside assemblies or scopes';
  }
  if (parentKind === 'assembly' && componentKind !== 'primitive') {
    return 'Assemblies can only contain primitive items';
  }
  if (parentKind === 'scope' && componentKind !== 'primitive' && componentKind !== 'assembly') {
    return 'Scopes can only contain assemblies or primitive items';
  }
  if (!isCatalogBomParentKind(parentKind)) {
    return 'Target must be an assembly or scope';
  }
  return 'Invalid BOM component for parent kind';
}

export function comboKindFromPayload(payload: unknown): 'assembly' | 'scope' {
  if (!payload || typeof payload !== 'object') return 'assembly';
  const rec = payload as Record<string, unknown>;
  if (rec.kind === 'scope') return 'scope';
  const nested = rec.comboPayload;
  if (nested && typeof nested === 'object' && (nested as Record<string, unknown>).kind === 'scope') {
    return 'scope';
  }
  return 'assembly';
}

export function isScopeComboPayload(payload: unknown): boolean {
  return comboKindFromPayload(payload) === 'scope';
}

export function parentComboIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const rec = payload as Record<string, unknown>;
  if (typeof rec.parentComboId === 'string' && rec.parentComboId) {
    return rec.parentComboId;
  }
  const nested = rec.comboPayload;
  if (nested && typeof nested === 'object') {
    const id = (nested as Record<string, unknown>).parentComboId;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

export function buildComboPayload(params: {
  kind: 'assembly' | 'scope';
  parentComboId?: string | null;
}): Record<string, unknown> {
  return {
    kind: params.kind,
    ...(params.parentComboId ? { parentComboId: params.parentComboId } : {}),
  };
}

/**
 * Recursively strip non-provider combos (typically scopes) and hoist their
 * children into the nearest kept ancestor or the group.
 *
 * - Kept combo: emit with its own items plus items hoisted from stripped descendants.
 * - Stripped combo: do not emit; promote kept descendant combos and items upward.
 */
export function hoistProviderCombos<
  TCombo extends { id: string; name?: string | null; comboPayload: unknown },
  TItem,
>(params: {
  combos: TCombo[];
  itemsByComboId: Map<string, TItem[]>;
  keepCombo: (combo: TCombo) => boolean;
}): {
  kept: Array<{ combo: TCombo; items: TItem[] }>;
  groupItems: TItem[];
  strippedComboCount: number;
  strippedComboIds: string[];
  strippedComboMeta: Array<{ name: string; kind: 'assembly' | 'scope' }>;
} {
  const { combos, itemsByComboId, keepCombo } = params;
  const comboIds = new Set(combos.map((c) => c.id));
  const childrenByParent = new Map<string, TCombo[]>();
  const roots: TCombo[] = [];

  for (const combo of combos) {
    const parentId = parentComboIdFromPayload(combo.comboPayload);
    if (parentId && comboIds.has(parentId)) {
      const list = childrenByParent.get(parentId) ?? [];
      list.push(combo);
      childrenByParent.set(parentId, list);
    } else {
      roots.push(combo);
    }
  }

  let strippedComboCount = 0;
  const strippedComboIds: string[] = [];
  const strippedComboMeta: Array<{ name: string; kind: 'assembly' | 'scope' }> = [];

  type VisitResult = {
    kept: Array<{ combo: TCombo; items: TItem[] }>;
    items: TItem[];
  };

  const visit = (combo: TCombo): VisitResult => {
    const ownItems = itemsByComboId.get(combo.id) ?? [];
    const children = childrenByParent.get(combo.id) ?? [];
    const childKept: Array<{ combo: TCombo; items: TItem[] }> = [];
    const hoistedItems: TItem[] = [...ownItems];

    for (const child of children) {
      const sub = visit(child);
      childKept.push(...sub.kept);
      hoistedItems.push(...sub.items);
    }

    if (keepCombo(combo)) {
      return {
        kept: [{ combo, items: hoistedItems }, ...childKept],
        items: [],
      };
    }

    strippedComboCount += 1;
    strippedComboIds.push(combo.id);
    strippedComboMeta.push({
      name: combo.name ?? '(unnamed)',
      kind: isScopeComboPayload(combo.comboPayload) ? 'scope' : 'assembly',
    });
    return {
      kept: childKept,
      items: hoistedItems,
    };
  };

  const kept: Array<{ combo: TCombo; items: TItem[] }> = [];
  const groupItems: TItem[] = [];
  for (const root of roots) {
    const result = visit(root);
    kept.push(...result.kept);
    groupItems.push(...result.items);
  }

  return { kept, groupItems, strippedComboCount, strippedComboIds, strippedComboMeta };
}

export interface ResolvedCatalogPrice {
  unitCost: string;
  buyCost: string | null;
}

export interface CategoryTreeNode {
  id: string;
  parentCategoryId: string | null;
  code: string;
  name: string;
  sortIndex: number;
  isActive: boolean;
  children: CategoryTreeNode[];
}

export function parseDecimal(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Crunchwork item create/update accepts both unitCost (resell) and buyCost
 * (wholesale). Local catalogue/quote/invoice rows keep those fields separate;
 * on outbound always copy unitCost onto buyCost so a single maintained rate
 * is pushed.
 */
export function copyUnitCostToBuyCostForCrunchwork(item: Record<string, unknown>): void {
  if (item.unitCost == null || item.unitCost === '') return;
  item.buyCost = item.unitCost;
}

export function formatDecimal(value: number, scale = 4): string {
  return value.toFixed(scale);
}

export {
  DEFAULT_MARKUP_RATE,
  DEFAULT_TAX_RATE,
  coerceToRate,
  coerceToRateString,
  formatRate,
  isFixedMarkupType,
  isPercentMarkupType,
  percentPointsToRate,
  rateToPercentPoints,
} from '../../common/rates';

import {
  coerceToRate,
  isPercentMarkupType,
} from '../../common/rates';

export function applyMarkup(params: {
  baseCost: number;
  markupType: string | null | undefined;
  markupValue: string | null | undefined;
}): number {
  const markupVal = parseDecimal(params.markupValue);
  if (!params.markupType || params.markupType === 'none') return params.baseCost;
  if (isPercentMarkupType(params.markupType)) {
    // markupValue is a decimal rate (0.19 = 19%)
    return params.baseCost * (1 + markupVal);
  }
  if (params.markupType === 'fixed' || params.markupType.toLowerCase() === 'absolute') {
    return params.baseCost + markupVal;
  }
  return params.baseCost;
}

export function computeLineTotals(params: {
  quantity: string;
  unitCost: string;
  taxRate?: string | null;
}): { subTotal: string; totalTax: string; total: string } {
  const qty = parseDecimal(params.quantity);
  const unit = parseDecimal(params.unitCost);
  const subTotal = qty * unit;
  // taxRate is a decimal rate (0.10 = 10%). coerceToRate accepts legacy %-points.
  const taxRate = coerceToRate(params.taxRate);
  const totalTax = subTotal * taxRate;
  const total = subTotal + totalTax;
  return {
    subTotal: formatDecimal(subTotal, 4),
    totalTax: formatDecimal(totalTax, 4),
    total: formatDecimal(total, 4),
  };
}

export function buildItemSnapshotFields(params: {
  item: CatalogItemRow;
  typeCode: string;
  categoryName: string | null;
  subCategoryName: string | null;
  unitCost: string;
}): {
  name: string;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  itemType: string;
  unitTypeLookupId: string | null;
  unitCost: string;
  buyCost: string | null;
  markupType: string | null;
  markupValue: string | null;
  tax: string | null;
  catalogItemId: string;
} {
  return {
    name: params.item.name,
    description: params.item.description,
    category: params.categoryName,
    subCategory: params.subCategoryName,
    itemType: params.typeCode,
    unitTypeLookupId: params.item.unitTypeLookupId,
    unitCost: params.unitCost,
    buyCost: params.item.buyCost,
    markupType: params.item.markupType,
    markupValue: params.item.markupValue,
    tax: params.item.taxRate,
    catalogItemId: params.item.id,
  };
}

export const DEFAULT_CATALOG_TYPES = [
  { code: 'material', name: 'Material', sortIndex: 0 },
  { code: 'labour', name: 'Labour', sortIndex: 1 },
  { code: 'equipment', name: 'Equipment', sortIndex: 2 },
  { code: 'vendor', name: 'Vendor', sortIndex: 3 },
  { code: 'other', name: 'Other', sortIndex: 4 },
] as const;

/** Standard CW / catalogue unit types seeded per tenant. */
export const DEFAULT_UNIT_TYPES = [
  { name: 'Each', externalReference: 'EA' },
  { name: 'Hour', externalReference: 'HR' },
  { name: 'Square Metre', externalReference: 'M2' },
  { name: 'Linear Metre', externalReference: 'LM' },
  { name: 'Lot', externalReference: 'LOT' },
  { name: 'Kilometre', externalReference: 'KM' },
  { name: 'Cubic Metre', externalReference: 'M3' },
  { name: 'Days', externalReference: 'DAYS' },
  { name: 'Item', externalReference: 'ITEM' },
  { name: 'Week', externalReference: 'WK' },
] as const;

export const DEFAULT_CATALOG_CATEGORIES = [
  {
    code: 'trades',
    name: 'Trades',
    sortIndex: 0,
    children: [
      { code: 'electrical', name: 'Electrical', sortIndex: 0 },
      { code: 'carpentry', name: 'Carpentry', sortIndex: 1 },
      { code: 'plumbing', name: 'Plumbing', sortIndex: 2 },
      { code: 'plastering', name: 'Plastering', sortIndex: 3 },
      { code: 'general', name: 'General', sortIndex: 4 },
    ],
  },
] as const;

/** Soft-allowed catalogue provider tags (plus any future registry codes accepted by the service). */
export const KNOWN_CATALOG_PROVIDER_CODES = ['internal', 'crunchwork', 'direct'] as const;

export function normalizeProviderCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const code = value.trim().toLowerCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** True when the item may be included in an outbound payload for the given providerCode. */
export function catalogItemAllowsProvider(
  providerCodes: string[] | null | undefined,
  providerCode: string | undefined | null,
): boolean {
  if (!providerCode) return true;
  if (!providerCodes || providerCodes.length === 0) return false;
  return providerCodes.includes(providerCode);
}

export function defaultProviderCodesForImport(
  importFormat: 'internal' | 'crunchwork',
  kind?: string,
): string[] {
  if (kind === 'scope') return ['internal'];
  return [importFormat === 'crunchwork' ? 'crunchwork' : 'internal'];
}

const ENSURE_CATALOG_NAMES = new Set(['ensure', 'ensure catalogue']);

/** True for the Ensure default catalogue (`Ensure` or `Ensure Catalogue`). */
export function isEnsureCatalogName(name: string | null | undefined): boolean {
  return ENSURE_CATALOG_NAMES.has((name ?? '').trim().toLowerCase());
}

/**
 * Ensure Catalogue is type=internal (scopes live there) but its primitives
 * are Crunchwork-publishable and must carry the crunchwork tag.
 */
export function providerCodesForEnsureCatalogItem(kind: string): string[] {
  if (kind === 'scope') return ['internal'];
  if (kind === 'primitive') return ['crunchwork'];
  return ['internal'];
}

/** Resolve provider tags for create/update: scopes never carry crunchwork. */
export function resolveCatalogItemProviderCodes(params: {
  kind: string;
  providerCodes?: string[] | null;
  catalogType?: string | null;
}): string[] {
  if (params.kind === 'scope') return ['internal'];
  const normalized = normalizeProviderCodes(params.providerCodes);
  if (normalized.length > 0) return normalized;
  const catalogType = (params.catalogType ?? 'internal').trim().toLowerCase();
  return [catalogType || 'internal'];
}


