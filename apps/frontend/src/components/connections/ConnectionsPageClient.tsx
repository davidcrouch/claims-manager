'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug, Plus } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  type SortOption,
  type StatusOption,
  buildSortString,
  parseSort,
  compareDates,
  compareValues,
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
          <div
            className="grid justify-start"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(265px, 322px))',
              gap: 'clamp(10px, 2vw, 20px)',
            }}
          >
            {filtered.map((conn) => (
              <button
                key={conn.id}
                type="button"
                onClick={() => router.push(`/connections/${conn.id}`)}
                className="text-left"
              >
                <Card className="h-36 min-w-[265px] max-w-[322px] border-l-4 border-l-violet-500 transition-colors hover:bg-muted/50">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1">
                    <div className="flex items-center gap-2">
                      <Unplug className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium truncate">
                        {conn.name || conn.providerName}
                      </span>
                    </div>
                    <StatusBadge
                      status={conn.isActive ? 'Active' : 'Inactive'}
                      variant={conn.isActive ? 'active' : 'inactive'}
                    />
                  </CardHeader>
                  <CardContent className="py-1 space-y-0.5">
                    <p className="text-sm text-slate-700 truncate">
                      {conn.providerName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {conn.environment}
                    </p>
                  </CardContent>
                  <CardFooter className="py-1 text-xs text-muted-foreground">
                    {conn.totalWebhookEvents} event
                    {conn.totalWebhookEvents !== 1 ? 's' : ''}
                    {conn.recentErrorCount > 0 && (
                      <span className="ml-1 text-destructive">
                        · {conn.recentErrorCount} error
                        {conn.recentErrorCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </CardFooter>
                </Card>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Unplug className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {connections.length === 0
                  ? 'No connections configured yet.'
                  : 'No connections match your filters.'}
              </p>
              {connections.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add your first connection
                </Button>
              )}
            </div>
          </div>
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
