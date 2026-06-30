import type { ApiGroup, FlatLineItemRow } from '@/components/quotes/quote-line-items.types';
import type { Quote } from '@/types/api';
import type { Dict } from '@/components/shared/detail';

export function getApi(quote: Quote): Dict {
  return (quote.apiPayload as Dict | undefined) ?? {};
}

export function getPayloadGroups(quote: Quote): ApiGroup[] {
  const api = getApi(quote);
  const groups = api.groups;
  return Array.isArray(groups) ? (groups as ApiGroup[]) : [];
}

export function groupLabel(group: ApiGroup, index: number, fallbackPrefix = 'Group'): string {
  return (
    group.groupLabel?.name ??
    group.groupLabel?.externalReference ??
    group.description ??
    `${fallbackPrefix} ${index + 1}`
  );
}

export function flattenGroups(groups: ApiGroup[]): FlatLineItemRow[] {
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
  });

  return rows;
}

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
