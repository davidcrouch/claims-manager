export const LINE_ITEMS_PAGE_SIZE = 100;

export type LineItemsPageQuery = {
  search?: string;
  groupIds?: string[];
  page?: number;
  limit?: number;
  all?: boolean;
};

export type LineItemsPageResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  groups: T[];
  total: number;
  page: number;
  limit: number;
  groupSummaries: Array<{ id: string; label: string }>;
};

export function parseLineItemsPageQuery(q: {
  search?: string;
  groupIds?: string;
  page?: string;
  limit?: string;
  all?: string;
}): LineItemsPageQuery {
  const groupIds = q.groupIds
    ? q.groupIds.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;
  const parsedLimit = q.limit ? parseInt(q.limit, 10) : LINE_ITEMS_PAGE_SIZE;
  const parsedPage = q.page ? parseInt(q.page, 10) : 1;
  return {
    search: q.search?.trim() || undefined,
    groupIds: groupIds?.length ? groupIds : undefined,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, LINE_ITEMS_PAGE_SIZE)
        : LINE_ITEMS_PAGE_SIZE,
    all: q.all === 'true' || q.all === '1',
  };
}

export function emptyLineItemsPage(
  query?: Pick<LineItemsPageQuery, 'page' | 'limit'>,
): LineItemsPageResult {
  return {
    groups: [],
    total: 0,
    page: query?.page ?? 1,
    limit: query?.limit ?? LINE_ITEMS_PAGE_SIZE,
    groupSummaries: [],
  };
}

type DisplayUnit =
  | { kind: 'item'; groupIndex: number; item: Record<string, unknown> }
  | { kind: 'combo'; groupIndex: number; combo: Record<string, unknown> }
  | { kind: 'scope'; groupIndex: number; scope: Record<string, unknown> }
  /** Empty group shell so newly created groups still appear in paged results. */
  | { kind: 'empty-group'; groupIndex: number };

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object');
}

function searchableText(obj: Record<string, unknown>): string {
  return [obj.name, obj.component, obj.type, obj.category, obj.subCategory, obj.description]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function groupId(group: Record<string, unknown>, index: number): string {
  return typeof group.id === 'string' && group.id ? group.id : `group-${index}`;
}

function groupSummaryLabel(group: Record<string, unknown>, index: number): string {
  const label = group.groupLabel;
  if (label && typeof label === 'object') {
    const rec = label as Record<string, unknown>;
    if (typeof rec.name === 'string' && rec.name) return rec.name;
    if (typeof rec.externalReference === 'string' && rec.externalReference) {
      return rec.externalReference;
    }
  }
  if (typeof group.description === 'string' && group.description) return group.description;
  return `Group ${index + 1}`;
}

function matchesItem(item: Record<string, unknown>, term: string): boolean {
  return searchableText(item).includes(term);
}

function matchesNamedRow(row: Record<string, unknown>, term: string, kindWord: string): boolean {
  return searchableText(row).includes(term) || kindWord.includes(term);
}

function filterGroupBySearch(
  group: Record<string, unknown>,
  term: string,
  groupIndex: number,
): Record<string, unknown> | null {
  const labelMatch = groupSummaryLabel(group, groupIndex).toLowerCase().includes(term);
  const items = asRecordArray(group.items).filter((item) => matchesItem(item, term));
  const combos = asRecordArray(group.combos)
    .map((combo) => {
      const comboMatch = matchesNamedRow(combo, term, 'assembly');
      const matchingItems = asRecordArray(combo.items).filter((item) => matchesItem(item, term));
      if (comboMatch || matchingItems.length > 0) {
        return { ...combo, items: comboMatch ? asRecordArray(combo.items) : matchingItems };
      }
      return null;
    })
    .filter((row) => row != null);
  const scopes = asRecordArray(group.scopes)
    .map((scope) => {
      const scopeMatch = matchesNamedRow(scope, term, 'scope');
      const matchingItems = asRecordArray(scope.items).filter((item) => matchesItem(item, term));
      const matchingCombos = asRecordArray(scope.combos)
        .map((combo) => {
          const comboMatch = matchesNamedRow(combo, term, 'assembly');
          const comboItems = asRecordArray(combo.items).filter((item) => matchesItem(item, term));
          if (comboMatch || comboItems.length > 0) {
            return { ...combo, items: comboMatch ? asRecordArray(combo.items) : comboItems };
          }
          return null;
        })
        .filter((row) => row != null);
      if (scopeMatch || matchingItems.length > 0 || matchingCombos.length > 0) {
        return {
          ...scope,
          items: scopeMatch ? asRecordArray(scope.items) : matchingItems,
          combos: scopeMatch ? asRecordArray(scope.combos) : matchingCombos,
        };
      }
      return null;
    })
    .filter((row) => row != null);

  if (items.length === 0 && combos.length === 0 && scopes.length === 0) {
    return labelMatch ? { ...group, items: [], combos: [], scopes: [] } : null;
  }
  return { ...group, items, combos, scopes };
}

function collectDisplayUnits(groups: Record<string, unknown>[]): DisplayUnit[] {
  const units: DisplayUnit[] = [];
  groups.forEach((group, groupIndex) => {
    const items = asRecordArray(group.items);
    const combos = asRecordArray(group.combos);
    const scopes = asRecordArray(group.scopes);
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

function paginateUnits(
  groups: Record<string, unknown>[],
  page: number,
  limit: number,
): Record<string, unknown>[] {
  const units = collectDisplayUnits(groups);
  const start = Math.max(0, (page - 1) * limit);
  const slice = units.slice(start, start + limit);
  if (slice.length === 0) return [];

  const rebuilt = new Map<number, Record<string, unknown>>();
  for (const unit of slice) {
    const source = groups[unit.groupIndex];
    let target = rebuilt.get(unit.groupIndex);
    if (!target) {
      target = { ...source, items: [], combos: [], scopes: [] };
      rebuilt.set(unit.groupIndex, target);
    }
    if (unit.kind === 'empty-group') {
      continue;
    }
    if (unit.kind === 'item') {
      target.items = [...asRecordArray(target.items), unit.item];
    } else if (unit.kind === 'combo') {
      target.combos = [...asRecordArray(target.combos), unit.combo];
    } else {
      target.scopes = [...asRecordArray(target.scopes), unit.scope];
    }
  }

  return [...rebuilt.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => group);
}

export function paginateAssembledLineItems<T extends Record<string, unknown>>(
  groups: T[],
  query: LineItemsPageQuery = {},
): LineItemsPageResult<T> {
  const groupSummaries = groups.map((group, index) => ({
    id: groupId(group, index),
    label: groupSummaryLabel(group, index),
  }));

  let filtered: Record<string, unknown>[] = groups;
  if (query.groupIds?.length) {
    const allowed = new Set(query.groupIds);
    filtered = filtered.filter((group, index) => allowed.has(groupId(group, index)));
  }

  const term = query.search?.trim().toLowerCase();
  if (term) {
    filtered = filtered
      .map((group, index) => filterGroupBySearch(group, term, index))
      .filter((group): group is Record<string, unknown> => group != null);
  }

  const total = collectDisplayUnits(filtered).length;
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit =
    query.limit && query.limit > 0
      ? Math.min(query.limit, LINE_ITEMS_PAGE_SIZE)
      : LINE_ITEMS_PAGE_SIZE;

  if (query.all) {
    return {
      groups: filtered as T[],
      total,
      page: 1,
      limit: total || LINE_ITEMS_PAGE_SIZE,
      groupSummaries,
    };
  }

  return {
    groups: paginateUnits(filtered, page, limit) as T[],
    total,
    page,
    limit,
    groupSummaries,
  };
}
