'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { fetchClaimsAction } from '@/app/(app)/claims/actions';
import type { Claim, PaginatedResponse } from '@/types/api';
import {
  normalizeSortParam,
  ARCHIVED_STATUS_NAMES,
} from './claims-list-helpers';
import {
  compareValues,
  compareDates,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';

const PAGE_SIZE = 20;

function formatAddress(claim: Claim): string {
  const addr = claim.address as
    | { streetNumber?: string; streetName?: string; suburb?: string }
    | undefined;
  if (addr) {
    const parts = [addr.streetNumber, addr.streetName, addr.suburb].filter(
      Boolean
    );
    if (parts.length) return parts.join(' ');
  }
  return claim.addressSuburb ?? '';
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

type ClaimTab = 'active' | 'archived' | 'all';

const VALID_TABS = new Set<ClaimTab>(['active', 'archived', 'all']);

function parseTab(param: string | null): ClaimTab {
  if (param && VALID_TABS.has(param as ClaimTab)) return param as ClaimTab;
  return 'active';
}

function statusIdsForTab(
  tab: ClaimTab,
  statusOptions: { id: string; name: string }[],
): string {
  if (tab === 'all') return '';
  const archivedIds: string[] = [];
  const activeIds: string[] = [];
  for (const opt of statusOptions) {
    if (ARCHIVED_STATUS_NAMES.has(opt.name.trim().toLowerCase())) {
      archivedIds.push(opt.id);
    } else {
      activeIds.push(opt.id);
    }
  }
  const ids = tab === 'archived' ? archivedIds : activeIds;
  return ids.sort().join(',');
}

type ColumnSortField =
  | 'claim_number'
  | 'status'
  | 'policy'
  | 'address'
  | 'account'
  | 'lodgement_date'
  | 'updated_at';

interface ColumnDef {
  key: ColumnSortField;
  label: string;
}

const TABLE_COLUMNS: ColumnDef[] = [
  { key: 'claim_number', label: 'Claim #' },
  { key: 'status', label: 'Status' },
  { key: 'policy', label: 'Policy' },
  { key: 'address', label: 'Address' },
  { key: 'account', label: 'Account' },
  { key: 'lodgement_date', label: 'Lodged' },
  { key: 'updated_at', label: 'Updated' },
];

function getClaimSortValue(
  claim: Claim,
  field: ColumnSortField,
): string | null | undefined {
  switch (field) {
    case 'claim_number':
      return claim.claimNumber ?? claim.externalReference ?? claim.id;
    case 'status':
      return (claim.status as { name?: string })?.name;
    case 'policy':
      return claim.policyNumber ?? claim.policyName;
    case 'address':
      return formatAddress(claim) || null;
    case 'account':
      return (claim.account as { name?: string })?.name;
    case 'lodgement_date':
      return claim.lodgementDate;
    case 'updated_at':
      return claim.updatedAt;
    default:
      return null;
  }
}

export interface ClaimsListClientProps {
  initialData: PaginatedResponse<Claim>;
  initialFetchKey: string;
  statusOptions: { id: string; name: string }[];
}

export function ClaimsListClient({
  initialData,
  initialFetchKey,
  statusOptions,
}: ClaimsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState(() =>
    normalizeSortParam(searchParams.get('sort'))
  );
  const [tab, setTab] = useState<ClaimTab>(() =>
    parseTab(searchParams.get('tab'))
  );
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{
    field: ColumnSortField;
    order: 'asc' | 'desc';
  } | null>(null);
  const [accountFilter, setAccountFilter] = useState<Set<string>>(new Set());

  const lastFetchKeyRef = useRef<string | null>(initialFetchKey);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const statusKey = useMemo(
    () => statusIdsForTab(tab, statusOptions),
    [tab, statusOptions],
  );

  useEffect(() => {
    const fetchKey = `${debouncedSearch}|${sort}|${tab}|${statusKey}|${page}`;

    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('sort', sort);
    params.set('page', String(page));
    params.set('tab', tab);
    if (statusKey) {
      params.set('status', statusKey);
    } else {
      params.delete('status');
    }
    router.replace(`/claims?${params}`, { scroll: false });

    if (lastFetchKeyRef.current === fetchKey) {
      return;
    }
    lastFetchKeyRef.current = fetchKey;

    setColumnSort(null);

    fetchClaimsAction({
      search: debouncedSearch || undefined,
      sort,
      status: statusKey || undefined,
      page,
      limit: PAGE_SIZE,
    }).then((res) => res && setData(res));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sort, tab, statusKey, page]);

  const SERVER_SORT_FIELDS = new Set(['claim_number', 'updated_at', 'created_at']);

  const handleColumnSort = (field: ColumnSortField) => {
    if (SERVER_SORT_FIELDS.has(field)) {
      const serverField = field === 'lodgement_date' ? 'created_at' : field;
      const currentServerField = sort.replace(/_(?:asc|desc)$/, '');
      if (currentServerField === serverField) {
        const currentOrder = sort.endsWith('_asc') ? 'asc' : 'desc';
        setSort(`${serverField}_${currentOrder === 'asc' ? 'desc' : 'asc'}`);
      } else {
        const defaultOrder = serverField === 'claim_number' ? 'asc' : 'desc';
        setSort(`${serverField}_${defaultOrder}`);
      }
      setColumnSort(null);
      setPage(1);
      return;
    }

    setColumnSort((prev) => {
      if (prev?.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: 'asc' };
    });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (val: string) => {
    setTab(val as ClaimTab);
    setPage(1);
  };

  const activeColumnField: ColumnSortField | null = columnSort
    ? columnSort.field
    : SERVER_SORT_FIELDS.has(sort.replace(/_(?:asc|desc)$/, ''))
      ? (sort.replace(/_(?:asc|desc)$/, '') as ColumnSortField)
      : null;
  const activeColumnOrder: 'asc' | 'desc' = columnSort
    ? columnSort.order
    : sort.endsWith('_asc')
      ? 'asc'
      : 'desc';

  const uniqueAccounts = useMemo(() => {
    const names = new Set<string>();
    for (const claim of data.data) {
      const name = (claim.account as { name?: string })?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data]);

  const toggleAccount = (name: string) => {
    setAccountFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const clearAccounts = () => setAccountFilter(new Set());
  const selectAllAccounts = () => setAccountFilter(new Set(uniqueAccounts));

  const filteredAndSortedData = useMemo(() => {
    let rows = data.data;
    if (accountFilter.size > 0) {
      rows = rows.filter((claim) => {
        const name = (claim.account as { name?: string })?.name?.trim();
        return name ? accountFilter.has(name) : false;
      });
    }
    if (!columnSort) return rows;
    const isDate = columnSort.field === 'lodgement_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getClaimSortValue(a, columnSort.field);
      const bVal = getClaimSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, columnSort, accountFilter]);

  const breakdown = computeStatusBreakdown(
    data.data,
    (c) => (c.status as { name?: string } | undefined)?.name,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={FileText}
          title="Claims"
          total={data.total}
          showing={data.data.length}
          search={debouncedSearch}
          breakdown={breakdown}
          accent="blue"
        />
      </SetPageHeader>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs
            value={tab}
            onValueChange={handleTabChange}
          >
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <Input
              placeholder="Search claims by claim number, reference, or policy..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 w-full pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <ValueFilterMenu
            options={uniqueAccounts}
            selected={accountFilter}
            onToggle={toggleAccount}
            onClearAll={clearAccounts}
            onSelectAll={selectAllAccounts}
            emptyLabel="All accounts"
            menuTitle="Filter by account"
            itemNoun={{ singular: 'account', plural: 'accounts' }}
          />
        </div>
      </div>

      <div
        className="flex-1 px-6 pb-6"
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        {filteredAndSortedData.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {TABLE_COLUMNS.map((col) => (
                    <SortableColumnHeader
                      key={col.key}
                      columnKey={col.key}
                      label={col.label}
                      activeField={activeColumnField}
                      sortOrder={activeColumnOrder}
                      onSort={handleColumnSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedData.map((claim) => {
                  const claimNo =
                    claim.claimNumber ?? claim.externalReference ?? claim.id;
                  const statusName =
                    (claim.status as { name?: string })?.name ?? 'Unknown';
                  const accountName =
                    (claim.account as { name?: string })?.name ?? '';
                  const policy =
                    claim.policyNumber ?? claim.policyName ?? '';

                  return (
                    <tr
                      key={claim.id}
                      onClick={() => router.push(`/claims/${claim.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {claimNo}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{policy}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatAddress(claim)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {accountName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(claim.lodgementDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(claim.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={handlePageChange}
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">No claims found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
