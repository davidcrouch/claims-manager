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
import { ProviderFormDrawer } from './ProviderFormDrawer';
import type { ProviderSummary } from '@/types/api';

type SortField = 'name' | 'createdAt' | 'totalWebhookEvents';
type StatusFilter = 'all' | 'active' | 'inactive';

export interface ProvidersPageClientProps {
  providers: ProviderSummary[];
}

export function ProvidersPageClient({ providers }: ProvidersPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    let items = [...providers];

    if (statusFilter === 'active') {
      items = items.filter((p) => p.isActive);
    } else if (statusFilter === 'inactive') {
      items = items.filter((p) => !p.isActive);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'totalWebhookEvents') {
        cmp = a.totalWebhookEvents - b.totalWebhookEvents;
      }
      return sortAsc ? cmp : -cmp;
    });

    return items;
  }, [providers, search, sortField, sortAsc, statusFilter]);

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
              placeholder="Search by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        }
        sortSlot={
          <div className="flex items-center gap-1">
            {(['name', 'createdAt', 'totalWebhookEvents'] as const).map(
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
                    : field === 'createdAt'
                      ? 'Created'
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
            Add Provider Connection
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
            {filtered.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => router.push(`/providers/${provider.id}`)}
                className="text-left"
              >
                <Card className="h-32 min-w-[265px] max-w-[322px] border-l-4 border-l-violet-500 transition-colors hover:bg-muted/50">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1">
                    <div className="flex items-center gap-2">
                      <Unplug className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium truncate">
                        {provider.name}
                      </span>
                    </div>
                    <StatusBadge
                      status={provider.isActive ? 'Active' : 'Inactive'}
                      variant={provider.isActive ? 'active' : 'inactive'}
                    />
                  </CardHeader>
                  <CardContent className="py-1">
                    <p className="text-sm text-muted-foreground truncate font-mono">
                      {provider.code}
                    </p>
                  </CardContent>
                  <CardFooter className="py-1 text-xs text-muted-foreground">
                    {provider.connectionCount} connection
                    {provider.connectionCount !== 1 ? 's' : ''} ·{' '}
                    {provider.totalWebhookEvents} event
                    {provider.totalWebhookEvents !== 1 ? 's' : ''}
                    {provider.recentErrorCount > 0 && (
                      <span className="ml-1 text-destructive">
                        · {provider.recentErrorCount} error
                        {provider.recentErrorCount !== 1 ? 's' : ''}
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
                {providers.length === 0
                  ? 'No provider connections configured yet.'
                  : 'No providers match your filters.'}
              </p>
              {providers.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add your first provider connection
                </Button>
              )}
            </div>
          </div>
        )}
      </EntityPanel>

      <ProviderFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingProviders={providers}
      />
    </>
  );
}
