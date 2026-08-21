import type { ApiCombo, ApiGroup, ApiItem, ApiScope, FlatLineItemRow } from '@/components/quotes/quote-line-items.types';
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

export const LINE_ITEMS_PAGE_SIZE = 100;

export type LineDisplayUnit =
  | { kind: 'item'; groupIndex: number; item: ApiItem }
  | { kind: 'combo'; groupIndex: number; combo: ApiCombo }
  | { kind: 'scope'; groupIndex: number; scope: ApiScope }
  | { kind: 'empty-group'; groupIndex: number };

export function collectDisplayUnits(groups: ApiGroup[]): LineDisplayUnit[] {
  const units: LineDisplayUnit[] = [];
  groups.forEach((group, groupIndex) => {
    const items = group.items ?? [];
    const combos = group.combos ?? [];
    const scopes = group.scopes ?? [];
    if (items.length === 0 && combos.length === 0 && scopes.length === 0) {
      units.push({ kind: 'empty-group', groupIndex });
      return;
    }
    for (const item of items) {
      units.push({ kind: 'item', groupIndex, item });
    }
    for (const combo of combos) {
      units.push({ kind: 'combo', groupIndex, combo });
    }
    for (const scope of scopes) {
      units.push({ kind: 'scope', groupIndex, scope });
    }
  });
  return units;
}

export function paginateGroups(
  groups: ApiGroup[],
  page: number,
  pageSize: number,
): { groups: ApiGroup[]; totalUnits: number } {
  const units = collectDisplayUnits(groups);
  const totalUnits = units.length;
  const start = Math.max(0, (page - 1) * pageSize);
  const slice = units.slice(start, start + pageSize);
  if (slice.length === 0) {
    return { groups: [], totalUnits };
  }

  const rebuilt = new Map<number, ApiGroup>();
  for (const unit of slice) {
    const source = groups[unit.groupIndex];
    let target = rebuilt.get(unit.groupIndex);
    if (!target) {
      target = { ...source, items: [], combos: [], scopes: [] };
      rebuilt.set(unit.groupIndex, target);
    }
    if (unit.kind === 'empty-group') continue;
    if (unit.kind === 'item') target.items = [...(target.items ?? []), unit.item];
    else if (unit.kind === 'combo') target.combos = [...(target.combos ?? []), unit.combo];
    else target.scopes = [...(target.scopes ?? []), unit.scope];
  }

  return {
    groups: [...rebuilt.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, group]) => group),
    totalUnits,
  };
}

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
