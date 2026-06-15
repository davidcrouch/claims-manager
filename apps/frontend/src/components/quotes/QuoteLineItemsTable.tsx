'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Layers } from 'lucide-react';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type SortOption,
  buildSortString,
  parseSort,
  compareValues,
} from '@/components/shared/list-filters';
import { formatCurrency } from '@/components/shared/detail';
import {
  getCatalogDragData,
  type CatalogDragPayload,
} from '@/components/catalog/catalog-drag';
import type { ApiGroup, FlatLineItemRow } from '@/components/quotes/quote-line-items.types';
import {
  flattenGroups,
  groupLabel,
  uniqueFilterOptions,
} from '@/components/quotes/quote-line-items.utils';
import { cn } from '@/lib/utils';

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'total', label: 'Total' },
  { key: 'quantity', label: 'Qty' },
  { key: 'group', label: 'Group' },
  { key: 'category', label: 'Category' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

function lookupDisplay(l?: { name?: string; externalReference?: string }): string {
  if (!l) return '—';
  return l.name ?? l.externalReference ?? '—';
}

function rowSearchText(row: FlatLineItemRow): string {
  const { item } = row;
  return [
    row.groupLabel,
    row.assemblyName,
    item.name,
    item.description,
    item.type,
    item.category,
    item.subCategory,
    item.note,
    ...(item.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export interface QuoteLineItemsTableProps {
  groups: ApiGroup[];
  activeDropKey: string | null;
  setActiveDropKey: (key: string | null) => void;
  onCatalogDrop: (payload: CatalogDragPayload, groupId?: string) => void;
}

export function QuoteLineItemsTable({
  groups,
  activeDropKey,
  setActiveDropKey,
  onCatalogDrop,
}: QuoteLineItemsTableProps) {
  const allRows = useMemo(() => flattenGroups(groups), [groups]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState(() => buildSortString('name', 'asc'));
  const [groupFilter, setGroupFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const groupOptions = useMemo(
    () => uniqueFilterOptions(allRows, (row) => row.groupLabel),
    [allRows],
  );
  const typeOptions = useMemo(
    () => uniqueFilterOptions(allRows, (row) => row.item.type),
    [allRows],
  );
  const categoryOptions = useMemo(
    () => uniqueFilterOptions(allRows, (row) => row.item.category),
    [allRows],
  );

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'name',
    defaultOrder: 'asc',
  });

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      const defaultOrder =
        field === 'name' || field === 'group' || field === 'category' ? 'asc' : 'desc';
      setSort(buildSortString(field, defaultOrder));
    }
  };

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = allRows;

    if (groupFilter.size > 0) {
      rows = rows.filter((row) => groupFilter.has(row.groupLabel));
    }
    if (typeFilter.size > 0) {
      rows = rows.filter((row) => row.item.type && typeFilter.has(row.item.type));
    }
    if (categoryFilter.size > 0) {
      rows = rows.filter(
        (row) => row.item.category && categoryFilter.has(row.item.category),
      );
    }
    if (query) {
      rows = rows.filter((row) => rowSearchText(row).includes(query));
    }

    return [...rows].sort((a, b) => {
      switch (activeSortField) {
        case 'total':
          return compareValues(a.item.total ?? 0, b.item.total ?? 0, sortOrder);
        case 'quantity':
          return compareValues(a.item.quantity ?? 0, b.item.quantity ?? 0, sortOrder);
        case 'group':
          return compareValues(a.groupLabel, b.groupLabel, sortOrder);
        case 'category':
          return compareValues(
            a.item.category ?? '',
            b.item.category ?? '',
            sortOrder,
          );
        case 'name':
        default:
          return compareValues(a.item.name ?? '', b.item.name ?? '', sortOrder);
      }
    });
  }, [
    allRows,
    debouncedSearch,
    groupFilter,
    typeFilter,
    categoryFilter,
    activeSortField,
    sortOrder,
  ]);

  const defaultDropGroupId = groups[0]?.id;
  const dropKey = 'line-items-table';
  const isDropActive = activeDropKey === dropKey;

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setActiveDropKey(dropKey);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (activeDropKey === dropKey) setActiveDropKey(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setActiveDropKey(null);
      const payload = getCatalogDragData(e.dataTransfer);
      if (!payload) return;
      onCatalogDrop(payload, defaultDropGroupId);
    },
  };

  const setFilterChecked = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
    checked: boolean,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Line items</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {visibleRows.length} of {allRows.length} line
            {allRows.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={activeSortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />

          <SearchInput
            placeholder="Search line items by name, category, group…"
            value={search}
            onChange={setSearch}
          />

          <StatusFilterMenu
            options={groupOptions}
            selected={groupFilter}
            onSelectionChange={(id, checked) =>
              setFilterChecked(setGroupFilter, id, checked)
            }
            onClearAll={() => setGroupFilter(new Set())}
            onSelectAll={() =>
              setGroupFilter(new Set(groupOptions.map((o) => o.id)))
            }
            triggerEmptyLabel="All groups"
            menuTitle="Filter by group"
            itemNoun={{ singular: 'group', plural: 'groups' }}
          />

          <StatusFilterMenu
            options={typeOptions}
            selected={typeFilter}
            onSelectionChange={(id, checked) =>
              setFilterChecked(setTypeFilter, id, checked)
            }
            onClearAll={() => setTypeFilter(new Set())}
            onSelectAll={() => setTypeFilter(new Set(typeOptions.map((o) => o.id)))}
            triggerEmptyLabel="All types"
            menuTitle="Filter by type"
            itemNoun={{ singular: 'type', plural: 'types' }}
          />

          <StatusFilterMenu
            options={categoryOptions}
            selected={categoryFilter}
            onSelectionChange={(id, checked) =>
              setFilterChecked(setCategoryFilter, id, checked)
            }
            onClearAll={() => setCategoryFilter(new Set())}
            onSelectAll={() =>
              setCategoryFilter(new Set(categoryOptions.map((o) => o.id)))
            }
            triggerEmptyLabel="All categories"
            menuTitle="Filter by category"
            itemNoun={{ singular: 'category', plural: 'categories' }}
          />
        </div>

        {isDropActive && (
          <p className="text-xs font-medium text-amber-700">
            Release to add catalogue item
            {groups.length === 1
              ? ` to ${groupLabel(groups[0], 0)}`
              : groups.length > 1
                ? ' to the first group'
                : ''}
          </p>
        )}
      </div>

      <div
        {...dropProps}
        className={cn(
          'min-h-[16rem] rounded-lg transition-shadow',
          isDropActive && 'ring-2 ring-amber-500 ring-offset-2',
        )}
      >
        {visibleRows.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3">Group</th>
                    <th scope="col" className="px-4 py-3">Assembly</th>
                    <th scope="col" className="px-4 py-3">Name</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Category</th>
                    <th scope="col" className="px-4 py-3 text-right">Qty</th>
                    <th scope="col" className="px-4 py-3 text-right">Unit</th>
                    <th scope="col" className="px-4 py-3 text-right">Tax</th>
                    <th scope="col" className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row) => {
                    const { item } = row;
                    const mismatches = item.mismatches ?? [];
                    return (
                      <tr key={row.rowKey} className="transition-colors hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {row.groupLabel}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {row.assemblyName ?? '—'}
                        </td>
                        <td className="min-w-[12rem] px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {item.name ?? '—'}
                            {item.internal && (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                                internal
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                              {item.description}
                            </p>
                          )}
                          {mismatches.length > 0 && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                              <AlertTriangle className="h-3 w-3" />
                              Catalogue mismatch
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {item.type ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {[item.category, item.subCategory].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-slate-700">
                          {item.quantity ?? 0}
                          {item.unitType && (
                            <span className="ml-1 text-xs text-slate-400">
                              {lookupDisplay(item.unitType)}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-slate-700">
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-slate-700">
                          {typeof item.tax === 'number' ? `${item.tax}%` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : allRows.length === 0 ? (
          <ListEmptyState label="No line items yet. Drag catalogue items here to add lines." />
        ) : (
          <ListEmptyState label="No line items match your search or filters." />
        )}
      </div>
    </div>
  );
}
