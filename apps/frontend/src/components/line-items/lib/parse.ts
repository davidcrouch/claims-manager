import type { ApiGroup, ApiItem, FlatLineItemRow } from './types';
import { groupLabel } from '../lib/money';

/** Extract ApiGroup[] from a document payload (WO, PO, Invoice, etc). */
export function groupsFromDocumentPayload(
  payload: Record<string, unknown> | null | undefined,
): ApiGroup[] {
  const groups = payload?.groups;
  return Array.isArray(groups) ? (groups as ApiGroup[]) : [];
}

/** IDs used by RFQ/PO scope pickers — includes scopes and nested assemblies/items. */
export function collectSelectableLineItemIds(groups: ApiGroup[]): string[] {
  const ids: string[] = [];
  for (const group of groups) {
    for (const item of group.items ?? []) {
      if (item.id) ids.push(item.id);
    }
    for (const combo of group.combos ?? []) {
      if (combo.id) ids.push(combo.id);
      for (const item of combo.items ?? []) {
        if (item.id) ids.push(item.id);
      }
    }
    for (const scope of group.scopes ?? []) {
      if (scope.id) ids.push(scope.id);
      for (const item of scope.items ?? []) {
        if (item.id) ids.push(item.id);
      }
      for (const combo of scope.combos ?? []) {
        if (combo.id) ids.push(combo.id);
        for (const item of combo.items ?? []) {
          if (item.id) ids.push(item.id);
        }
      }
    }
  }
  return ids;
}

/** Flatten the group tree into a single-level list for exports/reports. */
export function flattenLineItems(groups: ApiGroup[]): FlatLineItemRow[] {
  const rows: FlatLineItemRow[] = [];

  groups.forEach((group, groupIndex) => {
    const label = groupLabel(group, groupIndex);

    for (const item of group.items ?? []) {
      rows.push({
        rowKey: `group-item-${group.id ?? groupIndex}-${item.id ?? item.name ?? rows.length}`,
        groupId: group.id,
        groupLabel: label,
        assemblyName: null,
        item,
      });
    }

    for (const combo of group.combos ?? []) {
      const comboName = combo.name ?? 'Assembly';
      for (const item of combo.items ?? []) {
        rows.push({
          rowKey: `combo-item-${combo.id ?? comboName}-${item.id ?? item.name ?? rows.length}`,
          groupId: group.id,
          groupLabel: label,
          assemblyName: comboName,
          item,
        });
      }
    }

    for (const scope of group.scopes ?? []) {
      const scopeName = scope.name ?? 'Scope';
      for (const item of scope.items ?? []) {
        rows.push({
          rowKey: `scope-item-${scope.id ?? scopeName}-${item.id ?? item.name ?? rows.length}`,
          groupId: group.id,
          groupLabel: label,
          assemblyName: scopeName,
          item,
        });
      }
      for (const combo of scope.combos ?? []) {
        const comboName = combo.name ?? 'Assembly';
        for (const item of combo.items ?? []) {
          rows.push({
            rowKey: `scope-combo-item-${combo.id ?? comboName}-${item.id ?? item.name ?? rows.length}`,
            groupId: group.id,
            groupLabel: label,
            assemblyName: `${scopeName} / ${comboName}`,
            item,
          });
        }
      }
    }
  });

  return rows;
}

/** Build unique filter options from flat rows for filter dropdowns. */
export function uniqueFilterOptions(
  rows: FlatLineItemRow[],
  pick: (row: FlatLineItemRow) => string | null | undefined,
): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const value = pick(row)?.trim();
    if (!value) continue;
    if (!seen.has(value)) seen.set(value, value);
  }
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
