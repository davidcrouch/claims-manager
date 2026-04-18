'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Unplug, Search, Plus, ArrowUpDown } from 'lucide-react';
import { EntityPanel } from '@/components/ui/entity-panel';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConnectionFormDrawer } from './ConnectionFormDrawer';
import type { ConnectionSummary } from '@/types/api';

type SortField = 'name' | 'providerName' | 'totalWebhookEvents' | 'lastEventAt';
type StatusFilter = 'all' | 'active' | 'inactive';

export interface ConnectionsPageClientProps {
  connections: ConnectionSummary[];
}

export function ConnectionsPageClient({ connections }: ConnectionsPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    let items = [...connections];

    if (statusFilter === 'active') {
      items = items.filter((c) => c.isActive);
    } else if (statusFilter === 'inactive') {
      items = items.filter((c) => !c.isActive);
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
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'providerName') {
        cmp = a.providerName.localeCompare(b.providerName);
      } else if (sortField === 'lastEventAt') {
        const aT = a.lastEventAt ? new Date(a.lastEventAt).getTime() : 0;
        const bT = b.lastEventAt ? new Date(b.lastEventAt).getTime() : 0;
        cmp = aT - bT;
      } else if (sortField === 'totalWebhookEvents') {
        cmp = a.totalWebhookEvents - b.totalWebhookEvents;
      }
      return sortAsc ? cmp : -cmp;
    });

    return items;
  }, [connections, search, sortField, sortAsc, statusFilter]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  return (
    <>
      <EntityPanel
        searchSlot={
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, provider, environment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        }
        sortSlot={
          <div className="flex items-center gap-1">
            {(['name', 'providerName', 'lastEventAt', 'totalWebhookEvents'] as const).map(
              (field) => (
                <Button
                  key={field}
                  variant={sortField === field ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleSort(field)}
                  className="gap-1 text-xs"
                >
                  {field === 'name'
                    ? 'Name'
                    : field === 'providerName'
                      ? 'Provider'
                      : field === 'lastEventAt'
                        ? 'Last Event'
                        : 'Events'}
                  {sortField === field && (
                    <ArrowUpDown className="h-3 w-3" />
                  )}
                </Button>
              ),
            )}
          </div>
        }
        filterSlot={
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        }
        headerAction={
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add Connection
          </Button>
        }
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
      </EntityPanel>

      <ConnectionFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingConnections={connections}
      />
    </>
  );
}
