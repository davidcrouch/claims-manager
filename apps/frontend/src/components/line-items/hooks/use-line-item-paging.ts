import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ApiCombo, ApiGroup, ApiItem, ApiScope, LineItemsPaging } from '../lib/types';

export const LINE_ITEMS_PAGE_SIZE = 100;

export type LineDisplayUnit =
  | { kind: 'item'; groupIndex: number; item: ApiItem }
  | { kind: 'combo'; groupIndex: number; combo: ApiCombo }
  | { kind: 'scope'; groupIndex: number; scope: ApiScope }
  | { kind: 'empty-group'; groupIndex: number };

export interface UseLineItemPagingReturn {
  pagedGroups: ApiGroup[];
  totalUnits: number;
  currentPage: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  setPage: (page: number) => void;
  hiddenGroupIds: Set<string>;
  setHiddenGroupIds: (ids: Set<string>) => void;
}

/**
 * Hook that handles client-side or server-side pagination, search debounce,
 * and group filtering for the line items table.
 */
export function useLineItemPaging(
  groups: ApiGroup[],
  paging?: LineItemsPaging,
): UseLineItemPagingReturn {
  const serverFiltered = !!paging?.serverFiltered;
  const [clientPage, setClientPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [hiddenGroupIds, setHiddenGroupIds] = useState<Set<string>>(new Set());

  const externalSearch = paging?.search ?? '';
  const externalHidden = paging?.hiddenGroupIds ?? hiddenGroupIds;
  const effectiveSearch = paging?.onSearchChange ? externalSearch : searchTerm;
  const effectiveHidden = paging?.onHiddenGroupIdsChange ? (paging.hiddenGroupIds ?? new Set()) : hiddenGroupIds;

  useEffect(() => {
    setClientPage(1);
  }, [effectiveSearch, effectiveHidden]);

  const filteredGroups = useMemo(() => {
    if (serverFiltered) return groups;

    let result = groups;

    if (effectiveHidden.size > 0) {
      result = result.filter((g, i) => !effectiveHidden.has(g.id ?? `group-${i}`));
    }

    const term = effectiveSearch.trim().toLowerCase();
    if (!term) return result;

    const matchesItem = (item: ApiItem) => {
      const category = [item.category, item.subCategory].filter(Boolean).join(' / ');
      return (
        (item.name ?? '').toLowerCase().includes(term) ||
        (item.component ?? '').toLowerCase().includes(term) ||
        (item.type ?? '').toLowerCase().includes(term) ||
        category.toLowerCase().includes(term)
      );
    };

    const matchesCombo = (combo: ApiCombo) => {
      const category = [combo.category, combo.subCategory].filter(Boolean).join(' / ');
      return (
        (combo.name ?? '').toLowerCase().includes(term) ||
        (combo.component ?? '').toLowerCase().includes(term) ||
        'assembly'.includes(term) ||
        category.toLowerCase().includes(term)
      );
    };

    const matchesScope = (scope: ApiScope) => {
      const category = [scope.category, scope.subCategory].filter(Boolean).join(' / ');
      return (
        (scope.name ?? '').toLowerCase().includes(term) ||
        (scope.component ?? '').toLowerCase().includes(term) ||
        'scope'.includes(term) ||
        category.toLowerCase().includes(term)
      );
    };

    return result
      .map((group) => {
        const filteredItems = (group.items ?? []).filter(matchesItem);
        const filteredCombos = (group.combos ?? [])
          .map((combo) => {
            const comboMatch = matchesCombo(combo);
            const matchingItems = (combo.items ?? []).filter(matchesItem);
            if (comboMatch || matchingItems.length > 0) {
              return { ...combo, items: comboMatch ? combo.items : matchingItems };
            }
            return null;
          })
          .filter(Boolean) as ApiCombo[];
        const filteredScopes = (group.scopes ?? [])
          .map((scope) => {
            const scopeMatch = matchesScope(scope);
            const matchingItems = (scope.items ?? []).filter(matchesItem);
            const matchingCombos = (scope.combos ?? [])
              .map((combo) => {
                const comboMatch = matchesCombo(combo);
                const comboMatchingItems = (combo.items ?? []).filter(matchesItem);
                if (comboMatch || comboMatchingItems.length > 0) {
                  return { ...combo, items: comboMatch ? combo.items : comboMatchingItems };
                }
                return null;
              })
              .filter(Boolean) as ApiCombo[];
            if (scopeMatch || matchingItems.length > 0 || matchingCombos.length > 0) {
              return { ...scope, items: scopeMatch ? scope.items : matchingItems, combos: scopeMatch ? scope.combos : matchingCombos };
            }
            return null;
          })
          .filter(Boolean) as ApiScope[];

        if (filteredItems.length > 0 || filteredCombos.length > 0 || filteredScopes.length > 0) {
          return { ...group, items: filteredItems, combos: filteredCombos, scopes: filteredScopes };
        }
        return null;
      })
      .filter(Boolean) as ApiGroup[];
  }, [groups, effectiveSearch, effectiveHidden, serverFiltered]);

  const pageSize = paging?.pageSize ?? LINE_ITEMS_PAGE_SIZE;
  const currentPage = paging?.page ?? clientPage;

  const paged = useMemo(() => {
    if (serverFiltered) {
      return { groups: filteredGroups, totalUnits: paging?.total ?? 0 };
    }
    return paginateGroups(filteredGroups, currentPage, pageSize);
  }, [filteredGroups, currentPage, pageSize, serverFiltered, paging?.total]);

  const setPage = useCallback(
    (page: number) => {
      if (paging?.onPageChange) paging.onPageChange(page);
      else setClientPage(page);
    },
    [paging],
  );

  const handleSetSearch = useCallback(
    (term: string) => {
      if (paging?.onSearchChange) paging.onSearchChange(term);
      else setSearchTerm(term);
    },
    [paging],
  );

  const handleSetHiddenGroupIds = useCallback(
    (ids: Set<string>) => {
      if (paging?.onHiddenGroupIdsChange) paging.onHiddenGroupIdsChange(ids);
      else setHiddenGroupIds(ids);
    },
    [paging],
  );

  return {
    pagedGroups: paged.groups,
    totalUnits: paged.totalUnits,
    currentPage,
    searchTerm: effectiveSearch,
    setSearchTerm: handleSetSearch,
    setPage,
    hiddenGroupIds: effectiveHidden,
    setHiddenGroupIds: handleSetHiddenGroupIds,
  };
}

function collectDisplayUnits(groups: ApiGroup[]): LineDisplayUnit[] {
  const units: LineDisplayUnit[] = [];
  groups.forEach((group, groupIndex) => {
    const items = group.items ?? [];
    const combos = group.combos ?? [];
    const scopes = group.scopes ?? [];
    if (items.length === 0 && combos.length === 0 && scopes.length === 0) {
      units.push({ kind: 'empty-group', groupIndex });
      return;
    }
    for (const item of items) units.push({ kind: 'item', groupIndex, item });
    for (const combo of combos) units.push({ kind: 'combo', groupIndex, combo });
    for (const scope of scopes) units.push({ kind: 'scope', groupIndex, scope });
  });
  return units;
}

function paginateGroups(
  groups: ApiGroup[],
  page: number,
  pageSize: number,
): { groups: ApiGroup[]; totalUnits: number } {
  const units = collectDisplayUnits(groups);
  const totalUnits = units.length;
  const start = Math.max(0, (page - 1) * pageSize);
  const slice = units.slice(start, start + pageSize);
  if (slice.length === 0) return { groups: [], totalUnits };

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
