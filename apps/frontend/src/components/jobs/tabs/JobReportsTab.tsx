'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { FileBarChart, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportFormDrawer } from '@/components/forms/ReportFormDrawer';
import { fetchJobReportsAction } from '@/app/(app)/jobs/[id]/actions';
import {
  isArchivedStatus,
  compareDates,
  compareValues,
  formatDate,
  commitColumnFilterSelection,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import type { Report } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';

type ReportSortField =
  | 'title'
  | 'status'
  | 'type'
  | 'reference'
  | 'updated_at';

interface ColDef { key: ReportSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Type' },
  { key: 'reference', label: 'Reference' },
  { key: 'updated_at', label: 'Updated' },
];

function getSortValue(r: Report, field: ReportSortField): string | null | undefined {
  switch (field) {
    case 'title': return r.title ?? r.id;
    case 'status': return r.status?.name;
    case 'type': return r.reportType?.name;
    case 'reference': return r.reference;
    case 'updated_at': return r.updatedAt;
    default: return null;
  }
}

export function JobReportsTab({
  jobId,
  claimId,
}: {
  jobId: string;
  claimId?: string | null;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [tab, setTab] = useState<ListTab>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [columnSort, setColumnSort] = useState<{ field: ReportSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobReportsAction(jobId);
      setReports(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleColumnSort = (field: ReportSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'title' ? 'asc' : 'desc' };
    });
  };

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const r of reports) {
      const n = r.reportType?.name?.trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const uniqueStatuses = useMemo(() => {
    const names = new Set<string>();
    for (const r of reports) {
      const n = r.status?.name?.trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const toggleType = (name: string) => {
    const working = typeFilterActive ? new Set(typeFilter) : new Set(uniqueTypes);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
  };

  const applyStatusFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length,
    });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
  };

  const visibleRows = useMemo(() => {
    let rows = reports;

    if (tab !== 'all') {
      rows = rows.filter((r) => {
        const archived = isArchivedStatus(r.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (statusFilterActive) {
      if (statusFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((r) => {
          const n = r.status?.name?.trim();
          return n ? statusFilter.has(n) : false;
        });
      }
    }

    if (typeFilterActive) {
      if (typeFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((r) => {
          const n = r.reportType?.name?.trim();
          return n ? typeFilter.has(n) : false;
        });
      }
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((r) => {
        const title = (r.title ?? '').toLowerCase();
        const ref = (r.reference ?? '').toLowerCase();
        return title.includes(query) || ref.includes(query);
      });
    }

    const isDate = columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [reports, tab, statusFilterActive, statusFilter, typeFilterActive, typeFilter, debouncedSearch, columnSort]);

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
            placeholder="Search reports..."
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
          selected={typeFilterActive ? typeFilter : new Set(uniqueTypes)}
          onToggle={toggleType}
          onClearAll={() => {
            setTypeFilter(new Set());
            setTypeFilterActive(false);
          }}
          onSelectAll={() => {
            setTypeFilter(new Set());
            setTypeFilterActive(false);
          }}
          emptyLabel="All types"
          menuTitle="Filter by type"
          itemNoun={{ singular: 'type', plural: 'types' }}
        />

        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <FileBarChart className="h-4 w-4 mr-2" />
          Create Report
        </Button>
      </div>

      <ReportFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
        claimId={claimId}
      />

      {visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No reports found.</p>
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
                    filter={
                      col.key === 'status'
                        ? {
                            options: uniqueStatuses,
                            selected: statusFilter,
                            active: statusFilterActive,
                            onApply: applyStatusFilter,
                            menuTitle: 'Filter by status',
                            itemNoun: { singular: 'status', plural: 'statuses' },
                          }
                        : col.key === 'type'
                          ? {
                              options: uniqueTypes,
                              selected: typeFilter,
                              active: typeFilterActive,
                              onApply: applyTypeFilter,
                              menuTitle: 'Filter by type',
                              itemNoun: { singular: 'type', plural: 'types' },
                            }
                          : undefined
                    }
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((r) => {
                const statusName = r.status?.name ?? 'Unknown';
                return (
                  <tr key={r.id} className="cursor-pointer transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        href={`/reports/${r.id}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.title ?? r.id}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {statusName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.reportType?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.reference ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(r.updatedAt)}</td>
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
