import type { ApiCombo, ApiGroup, ApiItem, ApiScope } from './types';

export type CatalogUpdateMode = 'none' | 'prompt' | 'auto';

export const CATALOG_UPDATE_MODE_STORAGE_KEY = 'line-items.catalogUpdateMode';

export function parseCatalogUpdateMode(value: string | null | undefined): CatalogUpdateMode {
  if (value === 'prompt' || value === 'auto' || value === 'none') return value;
  return 'none';
}

export interface CatalogSourcePushItem {
  id: string;
  label: string;
  name?: string;
  description?: string;
  unitType?: string;
  unitCost?: string;
  markupValue?: string;
  tax?: string;
}

function findItem(groups: ApiGroup[], itemId: string): ApiItem | undefined {
  for (const g of groups) {
    for (const item of g.items ?? []) if (item.id === itemId) return item;
    for (const combo of g.combos ?? []) {
      for (const item of combo.items ?? []) if (item.id === itemId) return item;
    }
    for (const scope of g.scopes ?? []) {
      for (const item of scope.items ?? []) if (item.id === itemId) return item;
      for (const combo of scope.combos ?? []) {
        for (const item of combo.items ?? []) if (item.id === itemId) return item;
      }
    }
  }
  return undefined;
}

function findCombo(groups: ApiGroup[], comboId: string): ApiCombo | undefined {
  for (const g of groups) {
    for (const combo of g.combos ?? []) if (combo.id === comboId) return combo;
    for (const scope of g.scopes ?? []) {
      for (const combo of scope.combos ?? []) if (combo.id === comboId) return combo;
    }
  }
  return undefined;
}

function findScope(groups: ApiGroup[], scopeId: string): ApiScope | undefined {
  for (const g of groups) {
    for (const scope of g.scopes ?? []) if (scope.id === scopeId) return scope;
  }
  return undefined;
}

/**
 * Map estimate edits to catalogue source updates.
 * Quantity is instance-specific and is not pushed back to the catalogue.
 */
export function collectCatalogSourceUpdates(
  groups: ApiGroup[],
  converted: {
    items: Array<{
      id: string;
      name?: string;
      description?: string;
      unitType?: string;
      unitCost?: string;
      markupValue?: string;
      tax?: string;
    }>;
    combos: Array<{ id: string; name?: string; description?: string }>;
  },
): CatalogSourcePushItem[] {
  const byCatalogId = new Map<string, CatalogSourcePushItem>();

  for (const item of converted.items) {
    const source = findItem(groups, item.id);
    const catalogItemId = source?.catalogItemId;
    if (!catalogItemId) continue;
    const hasField =
      item.name !== undefined ||
      item.description !== undefined ||
      item.unitType !== undefined ||
      item.unitCost !== undefined ||
      item.markupValue !== undefined ||
      item.tax !== undefined;
    if (!hasField) continue;
    byCatalogId.set(catalogItemId, {
      id: catalogItemId,
      label: item.name ?? source?.name ?? 'Item',
      name: item.name,
      description: item.description,
      unitType: item.unitType,
      unitCost: item.unitCost,
      markupValue: item.markupValue,
      tax: item.tax,
    });
  }

  for (const combo of converted.combos) {
    const asCombo = findCombo(groups, combo.id);
    const asScope = findScope(groups, combo.id);
    const catalogId = asCombo?.catalogComboId ?? asScope?.catalogScopeId;
    if (!catalogId) continue;
    if (combo.name === undefined && combo.description === undefined) continue;
    byCatalogId.set(catalogId, {
      id: catalogId,
      label: combo.name ?? asCombo?.name ?? asScope?.name ?? 'Item',
      name: combo.name,
      description: combo.description,
    });
  }

  return [...byCatalogId.values()];
}
