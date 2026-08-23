import type { ApiCombo, ApiItem, ApiScope } from './types';

export function isSelectablePicked(id: string | undefined, selectedIds?: Set<string>): boolean {
  return !!id && !!selectedIds?.has(id);
}

export function comboHasPickedItems(combo: ApiCombo, selectedIds?: Set<string>): boolean {
  if (isSelectablePicked(combo.id, selectedIds)) return true;
  return (combo.items ?? []).some((item) => isSelectablePicked(item.id, selectedIds));
}

export function scopeHasPickedItems(scope: ApiScope, selectedIds?: Set<string>): boolean {
  if (isSelectablePicked(scope.id, selectedIds)) return true;
  if ((scope.items ?? []).some((item) => isSelectablePicked(item.id, selectedIds))) return true;
  return (scope.combos ?? []).some((combo) => comboHasPickedItems(combo, selectedIds));
}

export function filterVisibleItems(items: ApiItem[], hideUnselected: boolean, selectedIds?: Set<string>): ApiItem[] {
  if (!hideUnselected) return items;
  return items.filter((item) => isSelectablePicked(item.id, selectedIds));
}

export function filterVisibleCombos(
  combos: ApiCombo[],
  hideUnselected: boolean,
  selectedIds?: Set<string>,
): ApiCombo[] {
  if (!hideUnselected) return combos;
  return combos.filter((combo) => comboHasPickedItems(combo, selectedIds));
}
