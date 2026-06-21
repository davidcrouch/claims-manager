'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  compareDates,
  compareValues,
  formatDate,
  isArchivedStatus,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { JournalFormDrawer } from './JournalFormDrawer';
import { createJournalAction } from '@/app/(app)/journals/actions';
import type { Journal, PaginatedResponse } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';

type JournalSortField =
  | 'name'
  | 'status'
  | 'description'
  | 'location'
  | 'pages'
  | 'created_at'
  | 'updated_at';

interface ColDef { key: JournalSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'description', label: 'Description' },
  { key: 'location', label: 'Location' },
  { key: 'pages', label: 'Pages' },
  { key: 'created_at', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
];

function getJournalSortValue(
  j: Journal,
  field: JournalSortField,
): string | number | null | undefined {
  switch (field) {
    case 'name': return j.name;
    case 'status': return j.status;
    case 'description': return j.description;
    case 'location': return j.addressSuburb;
    case 'pages': return j.pageCount ?? 0;
    case 'created_at': return j.createdAt;
    case 'updated_at': return j.updatedAt;
    default: return null;
  }
}

export interface JournalsPageClientProps {
  initialData: PaginatedResponse<Journal> | { data: Journal[]; total: number };
}

export function JournalsPageClient({ initialData }: JournalsPageClientProps) {
  const router = useRouter();
  const [journals, setJournals] = useState<Journal[]>(
    'data' in initialData ? initialData.data : [],
  );
  const total = 'total' in initialData ? initialData.total : journals.length;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<ListTab>('active');
  const [columnSort, setColumnSort] = useState<{ field: JournalSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleCreated = (journal: Journal) => {
    setJournals((prev) => [journal, ...prev]);
    setCreateDrawerOpen(false);
  };

  const handleColumnSort = (field: JournalSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'name' ? 'asc' : 'desc' };
    });
  };

  const uniqueStatuses = useMemo(() => {
    const names = new Set<string>();
    for (const j of journals) {
      const name = j.status?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [journals]);

  const toggleStatus = (name: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = journals;

    if (tab !== 'all') {
      rows = rows.filter((j) => {
        const archived = isArchivedStatus(j.status);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (statusFilter.size > 0) {
      rows = rows.filter((j) => {
        const name = j.status?.trim();
        return name ? statusFilter.has(name) : false;
      });
    }

    if (query) {
      rows = rows.filter((j) => {
        const name = j.name.toLowerCase();
        const desc = (j.description ?? '').toLowerCase();
        const suburb = (j.addressSuburb ?? '').toLowerCase();
        return name.includes(query) || desc.includes(query) || suburb.includes(query);
      });
    }

    const isDate = columnSort.field === 'created_at' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getJournalSortValue(a, columnSort.field);
      const bVal = getJournalSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal as string, bVal as string, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [journals, debouncedSearch, tab, statusFilter, columnSort]);

  const breakdown = computeStatusBreakdown(visibleRows, (j) => j.status);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={BookOpen}
          title="Journals"
          total={total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          accent="slate"
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
              placeholder="Search journals by name, description or location..."
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

          <Button size="sm" className="shrink-0" onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New Journal
          </Button>
        </div>
      </div>

      <div
        className="flex-1 px-6 pb-6"
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        {visibleRows.length > 0 ? (
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
                {visibleRows.map((journal) => (
                  <tr
                    key={journal.id}
                    onClick={() => router.push(`/journals/${journal.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {journal.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {journal.status}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                      {journal.description ?? ''}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {journal.addressSuburb ?? ''}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {journal.pageCount ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(journal.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(journal.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">No journals found.</p>
            </div>
          </div>
        )}
      </div>

      <JournalFormDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        createJournal={createJournalAction}
        onCreated={handleCreated}
      />
    </div>
  );
}
