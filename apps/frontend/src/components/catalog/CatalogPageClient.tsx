'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FolderTree, Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type StatusOption,
  type SortOption,
  buildSortString,
  parseSort,
  statusIdsKey,
  parseStatusIdsFromSearchParam,
  compareValues,
} from '@/components/shared/list-filters';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { CatalogImportDialog } from '@/components/catalog/CatalogImportDialog';
import { CatalogCategoriesDrawer } from '@/components/catalog/CatalogCategoriesDrawer';
import { CatalogUnresolvedPanel } from '@/components/catalog/CatalogUnresolvedPanel';
import { fetchCatalogItemsAction } from '@/app/(app)/admin/catalog/actions';
import type { CatalogCategory, CatalogItem, CatalogItemType, PaginatedResponse } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
  { key: 'kind', label: 'Kind' },
  { key: 'unit_cost', label: 'Unit cost' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

const KIND_OPTIONS: StatusOption[] = [
  { id: 'primitive', name: 'Primitive' },
  { id: 'assembly', name: 'Assembly' },
];

export interface CatalogPageClientProps {
  initialData: PaginatedResponse<CatalogItem>;
  types: CatalogItemType[];
  categories: CatalogCategory[];
  templateCsv: string;
  unresolvedReferences: Array<{
    id: string;
    externalReference: string;
    sourceEntity: string | null;
    sourceEntityId: string | null;
    createdAt: string;
  }>;
}

function unitCostDisplay(item: CatalogItem): string {
  if (item.kind === 'assembly') {
    return item.computedUnitCost ?? item.fixedUnitCost ?? '—';
  }
  return item.unitCost ?? '—';
}

export function CatalogPageClient({
  initialData,
  types,
  categories,
  templateCsv,
  unresolvedReferences,
}: CatalogPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState(() => {
    const parsed = parseSort({
      sortParam: searchParams.get('sort'),
      allowedFields: ALLOWED_SORT_FIELDS,
      defaultField: 'code',
      defaultOrder: 'asc',
    });
    return buildSortString(parsed.field, parsed.order);
  });
  const [kindFilter, setKindFilter] = useState<Set<string>>(() =>
    parseStatusIdsFromSearchParam(searchParams.get('kind')),
  );

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const kindKey = statusIdsKey(kindFilter);
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    else params.delete('q');
    params.set('sort', sort);
    params.set('page', '1');
    if (kindKey) params.set('kind', kindKey);
    else params.delete('kind');
    router.replace(`/admin/catalog?${params}`, { scroll: false });

    const kind =
      kindFilter.size === 1
        ? ([...kindFilter][0] as 'primitive' | 'assembly')
        : undefined;
    fetchCatalogItemsAction({
      q: debouncedSearch.trim() || undefined,
      kind,
    }).then((res) => res && setData(res));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, kindFilter, sort]);

  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const categoryById = useMemo(() => {
    const map = new Map<string, CatalogCategory>();
    const walk = (nodes: CatalogCategory[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (node.children) walk(node.children);
      }
    };
    walk(categories);
    return map;
  }, [categories]);

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'code',
    defaultOrder: 'asc',
  });

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      const defaultOrder = field === 'code' || field === 'name' ? 'asc' : 'desc';
      setSort(buildSortString(field, defaultOrder));
    }
  };

  const setKindChecked = (id: string, checked: boolean) => {
    setKindFilter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = data.data;

    if (kindFilter.size > 0) {
      rows = rows.filter((item) => kindFilter.has(item.kind));
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((item) => {
        const code = item.code.toLowerCase();
        const name = item.name.toLowerCase();
        return code.includes(query) || name.includes(query);
      });
    }

    return [...rows].sort((a, b) => {
      switch (activeSortField) {
        case 'name':
          return compareValues(a.name, b.name, sortOrder);
        case 'kind':
          return compareValues(a.kind, b.kind, sortOrder);
        case 'unit_cost': {
          const aCost = parseFloat(unitCostDisplay(a)) || 0;
          const bCost = parseFloat(unitCostDisplay(b)) || 0;
          return sortOrder === 'asc' ? aCost - bCost : bCost - aCost;
        }
        case 'code':
        default:
          return compareValues(a.code, b.code, sortOrder);
      }
    });
  }, [data.data, debouncedSearch, kindFilter, activeSortField, sortOrder]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
        <SetPageHeader>
          <ListPageHeader
            icon={Package}
            title="Item Catalogue"
            total={data.total}
            showing={visibleRows.length}
            search={debouncedSearch}
            statusSelectedCount={kindFilter.size}
            accent="slate"
          />
        </SetPageHeader>

        <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <SortTabs
              options={SORT_OPTIONS}
              activeField={activeSortField}
              sortOrder={sortOrder}
              onSort={handleSort}
            />

            <SearchInput
              placeholder="Search by code or name…"
              value={search}
              onChange={setSearch}
            />

            <StatusFilterMenu
              options={KIND_OPTIONS}
              selected={kindFilter}
              onSelectionChange={setKindChecked}
              onClearAll={() => setKindFilter(new Set())}
              onSelectAll={() => setKindFilter(new Set(KIND_OPTIONS.map((o) => o.id)))}
              triggerEmptyLabel="All kinds"
              menuTitle="Filter by kind"
              itemNoun={{ singular: 'kind', plural: 'kinds' }}
            />

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setCategoriesOpen(true)}>
                <FolderTree className="mr-1 h-4 w-4" />
                Categories
              </Button>
              <CatalogImportDialog templateCsv={templateCsv} />
              <Button size="sm" render={<Link href="/admin/catalog/new" />}>
                <Plus className="mr-1 h-4 w-4" />
                New Item
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
          {unresolvedReferences.length > 0 && (
            <div className="mb-4">
              <CatalogUnresolvedPanel entries={unresolvedReferences} />
            </div>
          )}

          {visibleRows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3">Code</th>
                    <th scope="col" className="px-4 py-3">Name</th>
                    <th scope="col" className="px-4 py-3">Kind</th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Category</th>
                    <th scope="col" className="px-4 py-3 text-right">Unit cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/admin/catalog/items/${item.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-slate-900">
                        {item.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                          {item.kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {typeById.get(item.typeId)?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.categoryId
                          ? (categoryById.get(item.categoryId)?.name ?? '—')
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                        {unitCostDisplay(item)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ListEmptyState label="No catalogue items found." />
          )}
        </div>
      </div>

      <CatalogCategoriesDrawer
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
      />
    </>
  );
}
