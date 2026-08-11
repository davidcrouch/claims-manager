import type { ApiCombo, ApiGroup, FlatLineItemRow } from '@/components/quotes/quote-line-items.types';
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

export function groupsFromDocumentPayload(
  payload: Record<string, unknown> | null | undefined,
): ApiGroup[] {
  const groups = payload?.groups;
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

export function comboKindFromRecord(
  combo: ApiCombo | Record<string, unknown>,
): 'assembly' | 'scope' {
  const rec = combo as Record<string, unknown>;
  if (rec.kind === 'scope') return 'scope';
  const payload = rec.comboPayload;
  if (payload && typeof payload === 'object' && (payload as Record<string, unknown>).kind === 'scope') {
    return 'scope';
  }
  return 'assembly';
}

export function parentComboIdFromRecord(
  combo: ApiCombo | Record<string, unknown>,
): string | undefined {
  const rec = combo as Record<string, unknown>;
  if (typeof rec.parentComboId === 'string' && rec.parentComboId) return rec.parentComboId;
  const payload = rec.comboPayload;
  if (payload && typeof payload === 'object') {
    const id = (payload as Record<string, unknown>).parentComboId;
    if (typeof id === 'string' && id) return id;
  }
  return undefined;
}

/** Split combos tagged as scopes into `group.scopes` so every document uses the same UI. */
export function normalizeLineItemGroups(groups: ApiGroup[]): ApiGroup[] {
  return groups.map((group) => {
    const existingScopes = [...(group.scopes ?? [])];
    const existingIds = new Set(existingScopes.map((s) => s.id).filter(Boolean) as string[]);
    const topLevelAssemblies: ApiCombo[] = [];
    const nestedAssemblies: ApiCombo[] = [];

    for (const combo of group.combos ?? []) {
      if (comboKindFromRecord(combo) === 'scope') {
        if (combo.id && existingIds.has(combo.id)) continue;
        existingScopes.push({
          id: combo.id,
          name: combo.name,
          component: combo.component,
          description: combo.description,
          category: combo.category,
          subCategory: combo.subCategory,
          index: combo.index,
          quantity: combo.quantity,
          catalogScopeId: combo.catalogComboId,
          lineScopeStatus: combo.lineScopeStatus,
          items: combo.items,
          combos: [],
          subTotal: combo.subTotal,
          totalTax: combo.totalTax,
          total: combo.total,
          allocatedCost: combo.allocatedCost,
          committedCost: combo.committedCost,
        });
        if (combo.id) existingIds.add(combo.id);
        continue;
      }
      if (parentComboIdFromRecord(combo)) {
        nestedAssemblies.push(combo);
      } else {
        topLevelAssemblies.push(combo);
      }
    }

    const scopes = existingScopes.map((scope) => {
      const extras = nestedAssemblies.filter((combo) => parentComboIdFromRecord(combo) === scope.id);
      if (extras.length === 0) return scope;
      const seen = new Set((scope.combos ?? []).map((c) => c.id).filter(Boolean) as string[]);
      const merged = [...(scope.combos ?? [])];
      for (const extra of extras) {
        if (extra.id && seen.has(extra.id)) continue;
        merged.push(extra);
        if (extra.id) seen.add(extra.id);
      }
      return { ...scope, combos: merged };
    });

    const attachedIds = new Set(
      scopes.flatMap((scope) => (scope.combos ?? []).map((c) => c.id).filter(Boolean) as string[]),
    );
    const combos = [
      ...topLevelAssemblies,
      ...nestedAssemblies.filter((combo) => !combo.id || !attachedIds.has(combo.id)),
    ];

    return { ...group, combos, scopes };
  });
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
