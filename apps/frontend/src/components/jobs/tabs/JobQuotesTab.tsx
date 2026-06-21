'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuoteFormDrawer } from '@/components/forms/QuoteFormDrawer';
import { QuotesTable, getEstimateTypeName } from '@/components/quotes/QuotesTable';
import type { QuoteSortField } from '@/components/quotes/QuotesTable';
import { QuoteDetail } from '@/components/quotes/QuoteDetail';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import { fetchQuoteAction } from '@/app/(app)/quotes/actions';
import {
  isArchivedStatus,
  compareDates,
  compareValues,
  ValueFilterMenu,
} from '@/components/shared/list-filters';
import type { Quote } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';

function getQuoteSortValue(q: Quote, field: QuoteSortField): string | null | undefined {
  switch (field) {
    case 'quote_number': return q.quoteNumber ?? q.name ?? q.id;
    case 'status': return q.status?.name;
    case 'estimate_type': return getEstimateTypeName(q) || null;
    case 'reference': return q.name;
    case 'total_amount': return q.totalAmount;
    case 'quote_date': return q.quoteDate;
    case 'updated_at': return q.updatedAt;
    default: return null;
  }
}

export function JobQuotesTab({
  jobId,
  claimId,
}: {
  jobId: string;
  claimId: string;
}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [tab, setTab] = useState<ListTab>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [columnSort, setColumnSort] = useState<{ field: QuoteSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobQuotesAction(jobId);
      setQuotes(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const q of quotes) {
      const n = getEstimateTypeName(q).trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [quotes]);

  const toggleType = (name: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleColumnSort = (field: QuoteSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'quote_number' ? 'asc' : 'desc' };
    });
  };

  const visibleRows = useMemo(() => {
    let rows = quotes;

    if (tab !== 'all') {
      rows = rows.filter((q) => {
        const archived = isArchivedStatus(q.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (typeFilter.size > 0) {
      rows = rows.filter((q) => {
        const n = getEstimateTypeName(q).trim();
        return n ? typeFilter.has(n) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
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
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [quotes, tab, typeFilter, debouncedSearch, columnSort]);

  async function handleRowClick(q: Quote) {
    setDetailLoading(true);
    try {
      const full = await fetchQuoteAction(q.id);
      if (full) setSelectedQuote(full);
    } finally {
      setDetailLoading(false);
    }
  }

  if (selectedQuote) {
    return <QuoteDetail quote={selectedQuote} />;
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
            placeholder="Search estimates..."
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
          emptyLabel="All types"
          menuTitle="Filter by type"
          itemNoun={{ singular: 'type', plural: 'types' }}
        />

        <Button size="sm" onClick={() => setDrawerOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Create Estimate
        </Button>
      </div>

      {loading || detailLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No estimates found.</p>
          </div>
        </div>
      ) : (
        <QuotesTable
          quotes={visibleRows}
          onRowClick={handleRowClick}
          sortField={columnSort.field}
          sortOrder={columnSort.order}
          onSort={handleColumnSort}
        />
      )}

      <QuoteFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
        claimId={claimId}
      />
    </div>
  );
}
