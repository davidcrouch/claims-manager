import type { CatalogItemRow } from '../../database/repositories/catalog-items.repository';

export type CatalogItemKind = 'primitive' | 'assembly';
export type CatalogPricingMode = 'computed' | 'fixed' | 'cost_plus';

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

export function formatDecimal(value: number, scale = 4): string {
  return value.toFixed(scale);
}

export function applyMarkup(params: {
  baseCost: number;
  markupType: string | null | undefined;
  markupValue: string | null | undefined;
}): number {
  const markupVal = parseDecimal(params.markupValue);
  if (!params.markupType || params.markupType === 'none') return params.baseCost;
  if (params.markupType === 'percent') {
    return params.baseCost * (1 + markupVal / 100);
  }
  if (params.markupType === 'fixed') {
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
  const taxPct = parseDecimal(params.taxRate);
  const totalTax = subTotal * (taxPct / 100);
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
