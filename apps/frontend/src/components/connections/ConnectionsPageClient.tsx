'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type SortOption,
  type StatusOption,
  buildSortString,
  parseSort,
  compareDates,
  compareValues,
  formatDate,
} from '@/components/shared/list-filters';
import { ConnectionFormDrawer } from './ConnectionFormDrawer';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
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

export function ConnectionsPageClient({ connections }: ConnectionsPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<string>(buildSortString('name', 'asc'));
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);

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

  const filtered = useMemo(() => {
    let items = [...connections];

    if (statusFilter.size > 0) {
      items = items.filter((c) => {
        const key = c.isActive ? STATUS_ACTIVE : STATUS_INACTIVE;
        return statusFilter.has(key);
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.providerName.toLowerCase().includes(q) ||
          c.providerCode.toLowerCase().includes(q) ||
          c.environment.toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => {
      switch (activeSortField) {
        case 'providerName':
          return compareValues(a.providerName, b.providerName, sortOrder);
        case 'lastEventAt':
          return compareDates(a.lastEventAt, b.lastEventAt, sortOrder);
        case 'totalWebhookEvents':
          return compareValues(
            a.totalWebhookEvents,
            b.totalWebhookEvents,
            sortOrder,
          );
        case 'name':
        default:
          return compareValues(a.name, b.name, sortOrder);
      }
    });

    return items;
  }, [connections, search, activeSortField, sortOrder, statusFilter]);

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
          showing={filtered.length}
          search={search}
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

          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Connection
          </Button>
        </div>
      </div>

      <div
        className="flex-1 px-6 pb-6"
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        {filtered.length > 0 ? (
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
                {filtered.map((conn) => (
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
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ListEmptyState
            label={
              connections.length === 0
                ? 'No connections configured yet.'
                : 'No connections match your filters.'
            }
          />
        )}
      </div>

      <ConnectionFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingConnections={connections}
      />
    </div>
  );
}
