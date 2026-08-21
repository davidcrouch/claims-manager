'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  TableEmptyRow,
  type SortOption,
  type StatusOption,
  buildSortString,
  parseSort,
  statusIdsKey,
  formatDate,
} from '@/components/shared/list-filters';
import { ConnectionFormDrawer } from './ConnectionFormDrawer';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { fetchConnectionsAction } from '@/app/(app)/connections/actions';
import type { ConnectionSummary } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'providerName', label: 'Provider' },
  { key: 'lastEventAt', label: 'Last Event' },
  { key: 'totalWebhookEvents', label: 'Events' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

const STATUS_ACTIVE = 'active';
const STATUS_INACTIVE = 'inactive';
const STATUS_OPTIONS: StatusOption[] = [
  { id: STATUS_ACTIVE, name: 'Active' },
  { id: STATUS_INACTIVE, name: 'Inactive' },
];

export interface ConnectionsPageClientProps {
  connections: ConnectionSummary[];
}

export function ConnectionsPageClient({ connections: initialConnections }: ConnectionsPageClientProps) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<string>(buildSortString('name', 'asc'));
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const lastFetchKeyRef = useRef<string | null>(null);

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'name',
    defaultOrder: 'asc',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setConnections(initialConnections);
    lastFetchKeyRef.current = null;
  }, [initialConnections]);

  useEffect(() => {
    const statusKey = statusIdsKey(statusFilter);
    const fetchKey = `${debouncedSearch}|${sort}|${statusKey}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    const isActive =
      statusFilter.size === 1
        ? [...statusFilter][0] === STATUS_ACTIVE
          ? true
          : [...statusFilter][0] === STATUS_INACTIVE
            ? false
            : undefined
        : undefined;

    fetchConnectionsAction({
      search: debouncedSearch || undefined,
      sort,
      isActive,
    }).then((res) => {
      if (res) setConnections(res);
    });
  }, [debouncedSearch, sort, statusFilter]);

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      const defaultOrder = field === 'name' || field === 'providerName' ? 'asc' : 'desc';
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
    setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.id)));

  const activeCount = connections.filter((c) => c.isActive).length;
  const inactiveCount = connections.length - activeCount;
  const totalEvents = connections.reduce(
    (acc, c) => acc + c.totalWebhookEvents,
    0,
  );
  const totalErrors = connections.reduce(
    (acc, c) => acc + c.recentErrorCount,
    0,
  );
  const breakdown = [
    { name: 'Active', count: activeCount },
    { name: 'Inactive', count: inactiveCount },
  ].filter((b) => b.count > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Unplug}
          title="Connections"
          total={connections.length}
          showing={connections.length}
          search={debouncedSearch}
          statusSelectedCount={statusFilter.size}
          breakdown={breakdown}
          stats={[
            { label: 'Events', value: totalEvents.toLocaleString() },
            ...(totalErrors > 0
              ? [
                  {
                    label: 'Recent errors',
                    value: (
                      <span className="text-destructive">
                        {totalErrors.toLocaleString()}
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
          accent="violet"
        />
      </SetPageHeader>

      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setCreateOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Connection
        </Button>
      </SetHeaderActions>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={activeSortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />

          <SearchInput
            placeholder="Search by name, provider, environment..."
            value={search}
            onChange={setSearch}
          />

          <StatusFilterMenu
            options={STATUS_OPTIONS}
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Provider</th>
                <th scope="col" className="px-4 py-3">Environment</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Events</th>
                <th scope="col" className="px-4 py-3">Last Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {connections.length === 0 ? (
                <TableEmptyRow
                  colSpan={6}
                  label={
                    debouncedSearch || statusFilter.size > 0
                      ? 'No connections match your filters.'
                      : 'No connections configured yet.'
                  }
                />
              ) : (
                connections.map((conn) => (
                  <tr
                    key={conn.id}
                    onClick={() => router.push(`/connections/${conn.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {conn.name || conn.providerName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {conn.providerName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                      {conn.environment}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {conn.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {conn.totalWebhookEvents.toLocaleString()}
                      {conn.recentErrorCount > 0 && (
                        <span className="ml-1 text-destructive">
                          · {conn.recentErrorCount.toLocaleString()} error
                          {conn.recentErrorCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(conn.lastEventAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConnectionFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingConnections={connections}
      />
    </div>
  );
}
