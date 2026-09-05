import type { ApiCombo, ApiGroup, ApiItem, ApiScope } from './types';

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

/**
 * Keep ancestor scope/assembly IDs in sync with their descendants.
 * Unchecking a child must drop the parent id, otherwise PO/RFQ copy treats
 * the parent as "select all" and re-includes the unchecked rows.
 */
export function syncLineItemSelectionAncestors(
  groups: ApiGroup[],
  selectedIds: Set<string>,
): Set<string> {
  const next = new Set(selectedIds);

  const syncCombo = (combo: ApiCombo) => {
    const childIds = (combo.items ?? []).map((item) => item.id).filter((id): id is string => !!id);
    if (!combo.id || childIds.length === 0) return;
    if (childIds.every((id) => next.has(id))) next.add(combo.id);
    else next.delete(combo.id);
  };

  for (const group of groups) {
    for (const combo of group.combos ?? []) syncCombo(combo);
    for (const scope of group.scopes ?? []) {
      for (const combo of scope.combos ?? []) syncCombo(combo);
      const descendantIds: string[] = [];
      for (const item of scope.items ?? []) {
        if (item.id) descendantIds.push(item.id);
      }
      for (const combo of scope.combos ?? []) {
        if (combo.id) descendantIds.push(combo.id);
        for (const item of combo.items ?? []) {
          if (item.id) descendantIds.push(item.id);
        }
      }
      if (!scope.id || descendantIds.length === 0) continue;
      if (descendantIds.every((id) => next.has(id))) next.add(scope.id);
      else next.delete(scope.id);
    }
  }
  return next;
}
