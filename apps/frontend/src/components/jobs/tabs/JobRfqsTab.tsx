'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RfqFormDrawer } from '@/components/forms/RfqFormDrawer';
import { fetchJobRfqsAction } from '@/app/(app)/jobs/[id]/actions';
import {
  isArchivedStatus,
  compareDates,
  compareValues,
  formatDate,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import type { Rfq } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';

type RfqSortField =
  | 'rfq_number'
  | 'status'
  | 'vendor'
  | 'sent_date'
  | 'due_date'
  | 'updated_at';

interface ColDef { key: RfqSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'rfq_number', label: 'RFQ #' },
  { key: 'status', label: 'Status' },
  { key: 'vendor', label: 'Vendor (sub)' },
  { key: 'sent_date', label: 'Sent' },
  { key: 'due_date', label: 'Due' },
  { key: 'updated_at', label: 'Updated' },
];

function getSortValue(rfq: Rfq, field: RfqSortField): string | null | undefined {
  switch (field) {
    case 'rfq_number': return rfq.rfqNumber ?? rfq.name ?? rfq.id;
    case 'status': return rfq.status?.name;
    case 'vendor': return rfq.rfqToName;
    case 'sent_date': return rfq.sentDate;
    case 'due_date': return rfq.dueDate;
    case 'updated_at': return rfq.updatedAt;
    default: return null;
  }
}

export function JobRfqsTab({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [tab, setTab] = useState<ListTab>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState<Set<string>>(new Set());
  const [columnSort, setColumnSort] = useState<{ field: RfqSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });

  const load = useCallback(() => {
    setLoading(true);
    fetchJobRfqsAction(jobId)
      .then((data) => setRfqs(data ?? []))
      .catch((err) => console.error('JobRfqsTab:', err))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleColumnSort = (field: RfqSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'rfq_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueVendors = useMemo(() => {
    const names = new Set<string>();
    for (const rfq of rfqs) {
      const n = rfq.rfqToName?.trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [rfqs]);

  const toggleVendor = (name: string) => {
    setVendorFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = rfqs;

    if (tab !== 'all') {
      rows = rows.filter((rfq) => {
        const archived = isArchivedStatus(rfq.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (vendorFilter.size > 0) {
      rows = rows.filter((rfq) => {
        const n = rfq.rfqToName?.trim();
        return n ? vendorFilter.has(n) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((rfq) => {
        const num = (rfq.rfqNumber ?? '').toLowerCase();
        const name = (rfq.name ?? '').toLowerCase();
        const vendor = (rfq.rfqToName ?? '').toLowerCase();
        return num.includes(query) || name.includes(query) || vendor.includes(query);
      });
    }

    const isDate = columnSort.field === 'sent_date' || columnSort.field === 'due_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [rfqs, tab, vendorFilter, debouncedSearch, columnSort]);

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
            placeholder="Search RFQs..."
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
          options={uniqueVendors}
          selected={vendorFilter}
          onToggle={toggleVendor}
          onClearAll={() => setVendorFilter(new Set())}
          onSelectAll={() => setVendorFilter(new Set(uniqueVendors))}
          emptyLabel="All vendors"
          menuTitle="Filter by vendor"
          itemNoun={{ singular: 'vendor', plural: 'vendors' }}
        />

        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create RFQ
        </Button>
      </div>

      <RfqFormDrawer
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
            <p className="text-sm text-slate-400">No RFQs found.</p>
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
              {visibleRows.map((rfq) => {
                const statusName = rfq.status?.name ?? 'Unknown';
                return (
                  <tr
                    key={rfq.id}
                    onClick={() => router.push(`/rfqs/${rfq.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {rfq.rfqNumber ?? rfq.name ?? rfq.id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {statusName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{rfq.rfqToName ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(rfq.sentDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(rfq.dueDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(rfq.updatedAt)}</td>
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
