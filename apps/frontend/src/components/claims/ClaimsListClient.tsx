'use client';

import { useEffect, useMemo, useState } from 'react';
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
import {
  createListFetchSession,
  replaceListQueryIfNeeded,
  useListPageData,
} from '@/components/shared/use-list-page-data';
import type { Claim, PaginatedResponse } from '@/types/api';
import { normalizeSortParam } from './claims-list-helpers';
import {
  compareValues,
  compareDates,
  ValueFilterMenu,
  SortableColumnHeader,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  statusIdsForArchiveListTab,
  mergeStatusParamWithTab,
  parseArchiveListTab,
  type ArchiveListTab,
  TableEmptyRow,
} from '@/components/shared/list-filters';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatAddress } from '@/components/shared/detail';

type ClaimTab = ArchiveListTab;

const PAGE_SIZE = 20;

function claimListAddress(claim: Claim): string {
  return formatAddress(claim.address as Record<string, unknown> | undefined, {
    fallback: { suburb: claim.addressSuburb },
  });
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
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
  filterable?: boolean;
  locked?: boolean;
}

const TABLE_COLUMNS: ColumnDef[] = [
  { key: 'claim_number', label: 'Claim #', locked: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'policy', label: 'Policy' },
  { key: 'address', label: 'Address' },
  { key: 'account', label: 'Account', filterable: true },
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
      return claimListAddress(claim) || null;
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
  accountOptions: { id: string; name: string }[];
}

export function ClaimsListClient({
  initialData,
  initialFetchKey,
  statusOptions,
  accountOptions,
}: ClaimsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, setData, beginFetch, abortFetch } = useListPageData(initialData, {
    initialFetchKey,
  });
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState(() =>
    normalizeSortParam(searchParams.get('sort'))
  );
  const [tab, setTab] = useState<ClaimTab>(() =>
    parseArchiveListTab(searchParams.get('tab')),
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
  const [accountFilterActive, setAccountFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'claims',
    TABLE_COLUMNS,
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const statusParam = useMemo(
    () =>
      mergeStatusParamWithTab(
        columnFilterToIdsParam(statusFilterActive, statusFilter, statusOptions),
        statusIdsForArchiveListTab(tab, statusOptions),
      ),
    [tab, statusFilterActive, statusFilter, statusOptions],
  );

  const accountParam = useMemo(
    () => columnFilterToIdsParam(accountFilterActive, accountFilter, accountOptions),
    [accountFilterActive, accountFilter, accountOptions],
  );

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const accountKey = accountParam === null ? '__none__' : (accountParam ?? '');
    const fetchKey = `${debouncedSearch}|${sort}|${tab}|${statusKey}|${accountKey}|${page}`;

    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (sort !== 'updated_at_desc') params.set('sort', sort);
    else params.delete('sort');
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    if (tab !== 'active') params.set('tab', tab);
    else params.delete('tab');
    if (statusParam) {
      params.set('status', statusParam);
    } else {
      params.delete('status');
    }
    if (accountParam) {
      params.set('account', accountParam);
    } else {
      params.delete('account');
    }
    const next = params.toString();
    if (
      !replaceListQueryIfNeeded({
        router,
        pathname: '/claims',
        currentQuery: searchParams.toString(),
        nextQuery: next,
      })
    ) {
      return;
    }

    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    setColumnSort(null);

    if (statusParam === null || accountParam === null) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }

    fetchClaimsAction({
      search: debouncedSearch || undefined,
      sort,
      status: statusParam,
      account: accountParam,
      page,
      limit: PAGE_SIZE,
    }).then((res) => {
      if (!session.cancelled && res) setData(res);
    });

    return session.cleanup;
  }, [debouncedSearch, sort, tab, statusParam, accountParam, page, searchParams, router, beginFetch, abortFetch]);

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
    const fromOptions = accountOptions
      .map((a) => a.name?.trim())
      .filter((n): n is string => !!n);
    if (fromOptions.length > 0) {
      return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
    }
    const names = new Set<string>();
    for (const claim of data.data) {
      const name = (claim.account as { name?: string })?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data, accountOptions]);

  const uniqueStatuses = useMemo(() => {
    const fromOptions = statusOptions
      .map((s) => s.name?.trim())
      .filter((n): n is string => !!n);
    return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
  }, [statusOptions]);

  const toggleAccount = (name: string) => {
    const working = accountFilterActive
      ? new Set(accountFilter)
      : new Set(uniqueAccounts);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueAccounts.length,
    });
    setAccountFilter(committed.selected);
    setAccountFilterActive(committed.active);
    setPage(1);
  };

  const applyStatusFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length,
    });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
    setPage(1);
  };

  const applyAccountFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueAccounts.length,
    });
    setAccountFilter(committed.selected);
    setAccountFilterActive(committed.active);
    setPage(1);
  };

  const filteredAndSortedData = useMemo(() => {
    const rows = data.data;
    if (!columnSort) return rows;
    const isDate = columnSort.field === 'lodgement_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getClaimSortValue(a, columnSort.field);
      const bVal = getClaimSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, columnSort]);

  const breakdown = computeStatusBreakdown(
    data.data,
    (c) => (c.status as { name?: string } | undefined)?.name,
  );

  const statusFilterProps = {
    options: uniqueStatuses,
    selected: statusFilter,
    active: statusFilterActive,
    onApply: applyStatusFilter,
    menuTitle: 'Filter by status',
    itemNoun: { singular: 'status', plural: 'statuses' },
  };

  const accountFilterProps = {
    options: uniqueAccounts,
    selected: accountFilter,
    active: accountFilterActive,
    onApply: applyAccountFilter,
    menuTitle: 'Filter by account',
    itemNoun: { singular: 'account', plural: 'accounts' },
  };

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
            selected={accountFilterActive ? accountFilter : new Set(uniqueAccounts)}
            onToggle={toggleAccount}
            onClearAll={() => {
              setAccountFilter(new Set());
              setAccountFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setAccountFilter(new Set());
              setAccountFilterActive(false);
              setPage(1);
            }}
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {TABLE_COLUMNS.filter((col) => isVisible(col.key)).map((col) => (
                    <SortableColumnHeader
                      key={col.key}
                      columnKey={col.key}
                      label={col.label}
                      activeField={activeColumnField}
                      sortOrder={activeColumnOrder}
                      onSort={handleColumnSort}
                      filter={
                        col.key === 'status'
                          ? statusFilterProps
                          : col.key === 'account'
                            ? accountFilterProps
                            : undefined
                      }
                    />
                  ))}
                  <th scope="col" className={LIST_ARCHIVE_TH_CLASS}>
                    <span className="sr-only">Actions</span>
                  </th>
                  <ColumnSettingsHeaderCell
                    columns={TABLE_COLUMNS}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedData.length === 0 ? (
                  <TableEmptyRow colSpan={visibleCount + 2} label="No claims found." />
                ) : (
                  filteredAndSortedData.map((claim) => {
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
                      {isVisible('claim_number') && (
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {claimNo}
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={statusName} />
                        </td>
                      )}
                      {isVisible('policy') && (
                        <td className="px-4 py-3 text-slate-600">{policy}</td>
                      )}
                      {isVisible('address') && (
                        <td className="px-4 py-3 text-slate-600">
                          {claimListAddress(claim)}
                        </td>
                      )}
                      {isVisible('account') && (
                        <td className="px-4 py-3 text-slate-600">
                          {accountName}
                        </td>
                      )}
                      {isVisible('lodgement_date') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(claim.lodgementDate)}
                        </td>
                      )}
                      {isVisible('updated_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(claim.updatedAt)}
                        </td>
                      )}
                      <td
                        className={LIST_ARCHIVE_TD_CLASS}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ListArchiveButton
                          entityType="claim"
                          entityId={claim.id}
                          statusName={statusName}
                          entityLabel={claimNo}
                          onArchived={(id) => {
                            setData((prev) => ({
                              ...prev,
                              data: prev.data.filter((row) => row.id !== id),
                              total: Math.max(0, prev.total - 1),
                            }));
                          }}
                        />
                      </td>
                      <td className={LIST_ARCHIVE_SPACER_TD_CLASS} aria-hidden />
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={handlePageChange}
            />
          </div>
      </div>
    </div>
  );
}
