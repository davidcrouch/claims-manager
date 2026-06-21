'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, FileSpreadsheet, Search, X } from 'lucide-react';
import { deleteQuoteAction } from '@/app/(app)/quotes/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type StatusOption,
  compareDates,
  compareValues,
  isArchivedStatus,
  ValueFilterMenu,
} from '@/components/shared/list-filters';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { QuotesTable, type QuoteSortField, getEstimateTypeName } from './QuotesTable';
import type { Quote, PaginatedResponse } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

function getQuoteSortValue(q: Quote, field: QuoteSortField): string | number | null | undefined {
  switch (field) {
    case 'quote_number': return q.quoteNumber ?? q.name ?? q.id;
    case 'status': return q.status?.name;
    case 'estimate_type': return getEstimateTypeName(q) || null;
    case 'reference': return q.name;
    case 'total_amount': { const n = Number(q.totalAmount); return Number.isFinite(n) ? n : null; }
    case 'quote_date': return q.quoteDate;
    case 'updated_at': return q.updatedAt;
    default: return null;
  }
}

export interface QuotesListClientProps {
  initialData: PaginatedResponse<Quote>;
  statusOptions: StatusOption[];
}

export function QuotesListClient({
  initialData,
  statusOptions,
}: QuotesListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [columnSort, setColumnSort] = useState<{ field: QuoteSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', '1');
    router.replace(`/quotes?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, tab]);

  const handleColumnSort = (field: QuoteSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'quote_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const q of data.data) {
      const name = getEstimateTypeName(q).trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data]);

  const toggleType = (name: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data.data;

    if (tab !== 'all') {
      rows = rows.filter((q) => {
        const archived = isArchivedStatus(q.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (typeFilter.size > 0) {
      rows = rows.filter((q) => {
        const name = getEstimateTypeName(q).trim();
        return name ? typeFilter.has(name) : false;
      });
    }

    if (query) {
      rows = rows.filter((q) => {
        const num = (q.quoteNumber ?? '').toLowerCase();
        const name = (q.name ?? '').toLowerCase();
        return num.includes(query) || name.includes(query);
      });
    }

    const isDate = columnSort.field === 'quote_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getQuoteSortValue(a, columnSort.field);
      const bVal = getQuoteSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal as string, bVal as string, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, debouncedSearch, tab, typeFilter, columnSort]);

  const breakdown = computeStatusBreakdown(visibleRows, (q) => q.status?.name);
  const totalValue = useMemo(() => {
    const sum = visibleRows.reduce((acc, q) => {
      const n = Number(q.totalAmount);
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);
    if (sum === 0) return null;
    return sum.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  }, [visibleRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={FileSpreadsheet}
          title="Estimates"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="amber"
        />
      </SetPageHeader>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={tab} onValueChange={(val) => setTab(val as ListTab)}>
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
              placeholder="Search estimates by estimate # or reference..."
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

          <ValueFilterMenu
            options={uniqueTypes}
            selected={typeFilter}
            onToggle={toggleType}
            onClearAll={() => setTypeFilter(new Set())}
            onSelectAll={() => setTypeFilter(new Set(uniqueTypes))}
            emptyLabel="All estimate types"
            menuTitle="Filter by estimate type"
            itemNoun={{ singular: 'type', plural: 'types' }}
          />
        </div>
      </div>

      <div
        className="flex-1 px-6 pb-6"
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        {visibleRows.length > 0 ? (
          <QuotesTable
            quotes={visibleRows}
            onRowClick={(q) => router.push(`/quotes/${q.id}`)}
            onDelete={(id) => setConfirmDeleteId(id)}
            deletingId={isPending ? deletingId : null}
            showActions
            sortField={columnSort.field}
            sortOrder={columnSort.order}
            onSort={handleColumnSort}
          />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">No estimates found.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Delete Estimate</DialogTitle>
                <DialogDescription className="mt-1">
                  This action cannot be undone. The estimate and all its line items will be permanently removed.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending && deletingId === confirmDeleteId}
              onClick={() => {
                if (!confirmDeleteId) return;
                const idToDelete = confirmDeleteId;
                setDeletingId(idToDelete);
                startTransition(async () => {
                  await deleteQuoteAction(idToDelete);
                  setData((prev) => ({
                    ...prev,
                    data: prev.data.filter((q) => q.id !== idToDelete),
                    total: Math.max(0, prev.total - 1),
                  }));
                  setDeletingId(null);
                  setConfirmDeleteId(null);
                  router.refresh();
                });
              }}
            >
              {isPending && deletingId === confirmDeleteId ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
