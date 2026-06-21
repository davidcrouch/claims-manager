'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillFormDrawer } from '@/components/forms/BillFormDrawer';
import { fetchJobBillsAction } from '@/app/(app)/jobs/[id]/actions';
import { formatCurrency } from '@/components/shared/detail';
import {
  isArchivedStatus,
  compareDates,
  compareValues,
  formatDate,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import type { Bill } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';

type BillSortField =
  | 'bill_number'
  | 'status'
  | 'total_amount'
  | 'received_date'
  | 'due_date'
  | 'updated_at';

interface ColDef { key: BillSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'bill_number', label: 'Bill #' },
  { key: 'status', label: 'Status' },
  { key: 'total_amount', label: 'Amount' },
  { key: 'received_date', label: 'Received' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'updated_at', label: 'Updated' },
];

function getSortValue(bill: Bill, field: BillSortField): string | number | null | undefined {
  switch (field) {
    case 'bill_number': return bill.billNumber ?? bill.externalReference ?? bill.id;
    case 'status': return bill.status?.name;
    case 'total_amount': { const n = Number(bill.totalAmount); return Number.isFinite(n) ? n : null; }
    case 'received_date': return bill.receivedDate;
    case 'due_date': return bill.dueDate;
    case 'updated_at': return bill.updatedAt;
    default: return null;
  }
}

export function JobBillsTab({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [tab, setTab] = useState<ListTab>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [columnSort, setColumnSort] = useState<{ field: BillSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });

  const load = useCallback(() => {
    setLoading(true);
    fetchJobBillsAction(jobId)
      .then((data) => setBills(data ?? []))
      .catch((err) => console.error('JobBillsTab:', err))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleColumnSort = (field: BillSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'bill_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueStatuses = useMemo(() => {
    const names = new Set<string>();
    for (const b of bills) {
      const n = b.status?.name?.trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [bills]);

  const toggleStatus = (name: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = bills;

    if (tab !== 'all') {
      rows = rows.filter((b) => {
        const archived = isArchivedStatus(b.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (statusFilter.size > 0) {
      rows = rows.filter((b) => {
        const n = b.status?.name?.trim();
        return n ? statusFilter.has(n) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((b) => {
        const num = (b.billNumber ?? '').toLowerCase();
        const ref = (b.externalReference ?? '').toLowerCase();
        return num.includes(query) || ref.includes(query);
      });
    }

    const isDate = columnSort.field === 'received_date' || columnSort.field === 'due_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      if (isDate) return compareDates(aVal as string, bVal as string, columnSort.order);
      return compareValues(aVal, bVal, columnSort.order);
    });
  }, [bills, tab, statusFilter, debouncedSearch, columnSort]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <Tabs value={tab} onValueChange={(val) => setTab(val as ListTab)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search bills..."
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
          options={uniqueStatuses}
          selected={statusFilter}
          onToggle={toggleStatus}
          onClearAll={() => setStatusFilter(new Set())}
          onSelectAll={() => setStatusFilter(new Set(uniqueStatuses))}
          emptyLabel="All statuses"
          menuTitle="Filter by status"
          itemNoun={{ singular: 'status', plural: 'statuses' }}
        />

        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Bill
        </Button>
      </div>

      <BillFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
      />

      {visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No bills found.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                {TABLE_COLUMNS.map((col) => (
                  <SortableColumnHeader
                    key={col.key}
                    columnKey={col.key}
                    label={col.label}
                    activeField={columnSort.field}
                    sortOrder={columnSort.order}
                    onSort={handleColumnSort}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((bill) => {
                const statusName = bill.status?.name ?? 'Unknown';
                return (
                  <tr
                    key={bill.id}
                    onClick={() => router.push(`/bills/${bill.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {bill.billNumber ?? bill.externalReference ?? bill.id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {statusName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(bill.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(bill.receivedDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(bill.dueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(bill.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
