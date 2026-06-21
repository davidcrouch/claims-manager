'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchJobInvoicesAction, fetchJobPurchaseOrdersAction } from '@/app/(app)/jobs/[id]/actions';
import { InvoiceFormDrawer } from '@/components/forms/InvoiceFormDrawer';
import { formatDate, formatCurrency, PhaseUnavailable } from '@/components/shared/detail';
import {
  isArchivedStatus,
  compareDates,
  compareValues,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import type { Invoice, PurchaseOrder } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';

type InvoiceSortField =
  | 'invoice_number'
  | 'status'
  | 'issue_date'
  | 'sub_total'
  | 'tax'
  | 'total'
  | 'excess';

interface ColDef { key: InvoiceSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'invoice_number', label: 'Invoice #' },
  { key: 'status', label: 'Status' },
  { key: 'issue_date', label: 'Issue Date' },
  { key: 'sub_total', label: 'Sub-total' },
  { key: 'tax', label: 'Tax' },
  { key: 'total', label: 'Total' },
  { key: 'excess', label: 'Excess' },
];

function getSortValue(inv: Invoice, field: InvoiceSortField): string | number | null | undefined {
  switch (field) {
    case 'invoice_number': return inv.invoiceNumber ?? inv.id;
    case 'status': return inv.status?.name;
    case 'issue_date': return inv.issueDate ?? inv.createdAt;
    case 'sub_total': return inv.subTotal ? Number(inv.subTotal) : null;
    case 'tax': return inv.tax ? Number(inv.tax) : null;
    case 'total': return inv.totalAmount ? Number(inv.totalAmount) : null;
    case 'excess': return inv.excessAmount ? Number(inv.excessAmount) : null;
    default: return null;
  }
}

export function JobInvoicesTab({ jobId }: { jobId: string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const [tab, setTab] = useState<ListTab>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [columnSort, setColumnSort] = useState<{ field: InvoiceSortField; order: 'asc' | 'desc' }>({
    field: 'issue_date',
    order: 'desc',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [invRes, pos] = await Promise.all([
        fetchJobInvoicesAction(jobId),
        fetchJobPurchaseOrdersAction(jobId),
      ]);
      if (cancelled) return;
      setInvoices(invRes.data);
      setPhaseUnavailable(invRes.phaseUnavailable);
      setPurchaseOrders(pos ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleColumnSort = (field: InvoiceSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'invoice_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueStatuses = useMemo(() => {
    const names = new Set<string>();
    for (const inv of invoices) {
      const n = inv.status?.name?.trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const toggleStatus = (name: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = invoices;

    if (tab !== 'all') {
      rows = rows.filter((inv) => {
        const archived = isArchivedStatus(inv.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (statusFilter.size > 0) {
      rows = rows.filter((inv) => {
        const n = inv.status?.name?.trim();
        return n ? statusFilter.has(n) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((inv) => {
        const num = (inv.invoiceNumber ?? '').toLowerCase();
        return num.includes(query);
      });
    }

    const isDate = columnSort.field === 'issue_date';
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      if (isDate) return compareDates(aVal as string, bVal as string, columnSort.order);
      return compareValues(aVal, bVal, columnSort.order);
    });
  }, [invoices, tab, statusFilter, debouncedSearch, columnSort]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
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
            placeholder="Search invoices..."
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

        <Button size="sm" onClick={() => setDrawerOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Submit Invoice
        </Button>
      </div>

      {visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No invoices found.</p>
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
              {visibleRows.map((inv) => {
                const statusName = inv.status?.name ?? 'Unknown';
                return (
                  <tr key={inv.id} className="cursor-pointer transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        {inv.invoiceNumber ?? inv.id}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {statusName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(inv.issueDate ?? inv.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{formatCurrency(inv.subTotal)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{formatCurrency(inv.tax)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">{formatCurrency(inv.totalAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{formatCurrency(inv.excessAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        purchaseOrders={purchaseOrders}
      />
    </div>
  );
}
