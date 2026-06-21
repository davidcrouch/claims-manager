'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { deleteQuoteAction } from '@/app/(app)/quotes/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  compareDates,
  compareValues,
} from '@/components/shared/list-filters';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { QuotesTable } from './QuotesTable';
import type { Quote, PaginatedResponse } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'updated_at', label: 'Updated' },
  { key: 'created_at', label: 'Created' },
  { key: 'quote_number', label: 'Estimate #' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

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
  const [sort, setSort] = useState(() => {
    const parsed = parseSort({
      sortParam: searchParams.get('sort'),
      allowedFields: ALLOWED_SORT_FIELDS,
      defaultField: 'updated_at',
    });
    return buildSortString(parsed.field, parsed.order);
  });
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() =>
    parseStatusIdsFromSearchParam(searchParams.get('status')),
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusIdsKey(statusFilter);
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('sort', sort);
    params.set('page', '1');
    if (statusKey) params.set('status', statusKey);
    else params.delete('status');
    router.replace(`/quotes?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop: router.replace updates URL -> searchParams changes -> effect re-runs
  }, [debouncedSearch, sort, statusFilter]);

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'updated_at',
  });

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      const defaultOrder = field === 'quote_number' ? 'asc' : 'desc';
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

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data.data;

    if (statusFilter.size > 0) {
      rows = rows.filter((q) => {
        const sid = q.statusLookupId ?? q.status?.id;
        return sid ? statusFilter.has(sid) : false;
      });
    }

    if (query) {
      rows = rows.filter((q) => {
        const num = (q.quoteNumber ?? '').toLowerCase();
        const name = (q.name ?? '').toLowerCase();
        return num.includes(query) || name.includes(query);
      });
    }

    const sorted = [...rows].sort((a, b) => {
      switch (activeSortField) {
        case 'quote_number':
          return compareValues(
            a.quoteNumber ?? '',
            b.quoteNumber ?? '',
            sortOrder,
          );
        case 'created_at':
          return compareDates(a.createdAt, b.createdAt, sortOrder);
        case 'updated_at':
        default:
          return compareDates(a.updatedAt, b.updatedAt, sortOrder);
      }
    });

    return sorted;
  }, [data.data, debouncedSearch, statusFilter, activeSortField, sortOrder]);

  const breakdown = computeStatusBreakdown(
    visibleRows,
    (q) => q.status?.name,
  );
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
          statusSelectedCount={statusFilter.size}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="amber"
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
            placeholder="Search estimates by estimate # or reference..."
            value={search}
            onChange={setSearch}
          />

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
        {visibleRows.length > 0 ? (
          <QuotesTable
            quotes={visibleRows}
            onRowClick={(q) => router.push(`/quotes/${q.id}`)}
            onDelete={(id) => setConfirmDeleteId(id)}
            deletingId={isPending ? deletingId : null}
            showActions
          />
        ) : (
          <ListEmptyState label="No estimates found." />
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
