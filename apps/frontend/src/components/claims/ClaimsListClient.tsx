'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { fetchClaimsAction } from '@/app/(app)/claims/actions';
import type { Claim, PaginatedResponse } from '@/types/api';
import { normalizeSortParam } from './claims-list-helpers';

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

const SORT_OPTIONS = [
  { key: 'updated_at', label: 'Updated' },
  { key: 'created_at', label: 'Created' },
  { key: 'claim_number', label: 'Claim #' },
];

function parseSort(sortParam: string | null): {
  field: string;
  order: 'asc' | 'desc';
} {
  if (!sortParam) {
    return { field: 'updated_at', order: 'desc' };
  }
  const lastUnderscore = sortParam.lastIndexOf('_');
  if (lastUnderscore <= 0) {
    return { field: 'updated_at', order: 'desc' };
  }
  const order = sortParam.slice(lastUnderscore + 1);
  const field = sortParam.slice(0, lastUnderscore);
  if (order !== 'asc' && order !== 'desc') {
    return { field: 'updated_at', order: 'desc' };
  }
  if (!['updated_at', 'created_at', 'claim_number'].includes(field)) {
    return { field: 'updated_at', order: 'desc' };
  }
  return { field, order };
}

function buildSortString(field: string, order: 'asc' | 'desc') {
  return `${field}_${order}`;
}

function statusIdsKey(ids: Set<string>) {
  return [...ids].sort().join(',');
}

function parseStatusIdsFromSearchParam(param: string | null): Set<string> {
  if (!param) return new Set();
  return new Set(param.split(',').map((s) => s.trim()).filter(Boolean));
}

function SortButton({
  field,
  label,
  activeField,
  sortOrder,
  onSort,
}: {
  field: string;
  label: string;
  activeField: string;
  sortOrder: string;
  onSort: (field: string) => void;
}) {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-slate-100 text-slate-900 shadow-sm'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {label}
      {isActive &&
        (sortOrder === 'asc' ? (
          <ArrowUp size={12} className="text-indigo-600" />
        ) : (
          <ArrowDown size={12} className="text-indigo-600" />
        ))}
    </button>
  );
}

function StatusFilterMenu({
  options,
  selected,
  onSelectionChange,
  onClearAll,
  onSelectAll,
}: {
  options: { id: string; name: string }[];
  selected: Set<string>;
  onSelectionChange: (id: string, checked: boolean) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex min-w-[140px] cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-white py-2 pl-3 pr-2 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500"
      >
        <span className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          {selected.size === 0
            ? 'All statuses'
            : `${selected.size} status${selected.size !== 1 ? 'es' : ''}`}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[220px] p-2" align="end">
        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-medium text-slate-500">
            Filter by status
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs text-indigo-600 hover:underline"
            >
              All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-indigo-600 hover:underline"
            >
              None
            </button>
          </div>
        </div>
        <div className="max-h-[280px] space-y-0.5 overflow-y-auto">
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.id}
              checked={selected.has(opt.id)}
              onCheckedChange={(checked) =>
                onSelectionChange(opt.id, checked === true)
              }
              className="cursor-pointer"
            >
              {opt.name}
            </DropdownMenuCheckboxItem>
          ))}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-slate-400">
              No status values loaded
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface ClaimsListClientProps {
  initialData: PaginatedResponse<Claim>;
  /** Matches server list query so the first client effect can skip a duplicate fetch */
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
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() =>
    parseStatusIdsFromSearchParam(searchParams.get('status'))
  );

  const lastFetchKeyRef = useRef<string | null>(initialFetchKey);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusIdsKey(statusFilter);
    const fetchKey = `${debouncedSearch}|${sort}|${statusKey}`;

    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('sort', sort);
    params.set('page', '1');
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

    fetchClaimsAction({
      search: debouncedSearch || undefined,
      sort,
      status: statusKey || undefined,
    }).then((res) => res && setData(res));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams: router.replace syncs URL; full dep causes loops
  }, [debouncedSearch, sort, statusFilter]);

  const { field: activeSortField, order: sortOrder } = parseSort(sort);

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(
        buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc')
      );
    } else {
      const defaultOrder = field === 'claim_number' ? 'asc' : 'desc';
      setSort(buildSortString(field, defaultOrder));
    }
  };

  const setStatusChecked = (id: string, checked: boolean) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearStatuses = () => setStatusFilter(new Set());
  const selectAllStatuses = () =>
    setStatusFilter(new Set(statusOptions.map((o) => o.id)));

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
          statusSelectedCount={statusFilter.size}
          breakdown={breakdown}
          accent="blue"
        />
      </SetPageHeader>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center rounded-md border border-slate-200 bg-white p-1">
            {SORT_OPTIONS.map((option) => (
              <SortButton
                key={option.key}
                field={option.key}
                label={option.label}
                activeField={activeSortField}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            ))}
          </div>

          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <Input
              placeholder="Search claims by claim number, reference, or policy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <StatusFilterMenu
            options={statusOptions}
            selected={statusFilter}
            onSelectionChange={setStatusChecked}
            onClearAll={clearStatuses}
            onSelectAll={selectAllStatuses}
          />
        </div>
      </div>

      <div
        className="flex-1 px-6 pb-6"
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        {data.data.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3">Claim #</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Policy</th>
                  <th scope="col" className="px-4 py-3">Address</th>
                  <th scope="col" className="px-4 py-3">Account</th>
                  <th scope="col" className="px-4 py-3">Lodged</th>
                  <th scope="col" className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((claim) => {
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
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {statusName}
                        </span>
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
