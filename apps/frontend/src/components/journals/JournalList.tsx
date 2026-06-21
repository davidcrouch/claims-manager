'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, Link2, Unlink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JournalFormDrawer } from './JournalFormDrawer';
import { JournalLinkDrawer } from './JournalLinkDrawer';
import {
  isArchivedStatus,
  compareDates,
  compareValues,
  formatDate,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import type { Journal } from '@/types/api';

export interface JournalListProps {
  entityType: string;
  entityId: string;
  fetchJournals: () => Promise<Journal[]>;
  fetchAllJournals: () => Promise<Journal[]>;
  createJournal: (data: { name: string; description?: string }) => Promise<Journal | null>;
  linkJournal: (journalId: string) => Promise<boolean>;
  unlinkJournal: (journalId: string) => Promise<boolean>;
}

type ListTab = 'active' | 'archived' | 'all';

type JournalSortField =
  | 'name'
  | 'status'
  | 'suburb'
  | 'pages'
  | 'updated_at';

interface ColDef { key: JournalSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'suburb', label: 'Location' },
  { key: 'pages', label: 'Pages' },
  { key: 'updated_at', label: 'Updated' },
];

function getSortValue(j: Journal, field: JournalSortField): string | number | null | undefined {
  switch (field) {
    case 'name': return j.name;
    case 'status': return j.status;
    case 'suburb': return j.addressSuburb;
    case 'pages': return j.pageCount ?? null;
    case 'updated_at': return j.updatedAt;
    default: return null;
  }
}

export function JournalList({
  entityType,
  entityId,
  fetchJournals,
  fetchAllJournals,
  createJournal,
  linkJournal,
  unlinkJournal,
}: JournalListProps) {
  const router = useRouter();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);

  const [tab, setTab] = useState<ListTab>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [columnSort, setColumnSort] = useState<{ field: JournalSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });

  const loadJournals = () => {
    setLoading(true);
    fetchJournals()
      .then((data) => setJournals(data))
      .catch((err) => console.error('JournalList.loadJournals:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadJournals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleCreatedAndLinked = (journal: Journal) => {
    setJournals((prev) => [journal, ...prev]);
    setCreateDrawerOpen(false);
  };

  const handleLinked = () => {
    loadJournals();
    setLinkDrawerOpen(false);
  };

  const handleUnlink = async (e: React.MouseEvent, journalId: string) => {
    e.stopPropagation();
    try {
      await unlinkJournal(journalId);
      setJournals((prev) => prev.filter((j) => j.id !== journalId));
    } catch (err) {
      console.error('JournalList.handleUnlink:', err);
    }
  };

  const handleColumnSort = (field: JournalSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'name' ? 'asc' : 'desc' };
    });
  };

  const uniqueStatuses = useMemo(() => {
    const names = new Set<string>();
    for (const j of journals) {
      const s = j.status?.trim();
      if (s) names.add(s);
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
    let rows = journals;

    if (tab !== 'all') {
      rows = rows.filter((j) => {
        const archived = isArchivedStatus(j.status);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (statusFilter.size > 0) {
      rows = rows.filter((j) => {
        const s = j.status?.trim();
        return s ? statusFilter.has(s) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((j) => {
        const name = (j.name ?? '').toLowerCase();
        const desc = (j.description ?? '').toLowerCase();
        const suburb = (j.addressSuburb ?? '').toLowerCase();
        return name.includes(query) || desc.includes(query) || suburb.includes(query);
      });
    }

    const isDate = columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal as string, bVal as string, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [journals, tab, statusFilter, debouncedSearch, columnSort]);

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
            placeholder="Search journals..."
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

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLinkDrawerOpen(true)}>
            <Link2 className="mr-1 size-4" />
            Link Existing
          </Button>
          <Button size="sm" onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="mr-1 size-4" />
            New Journal
          </Button>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No journals found.</p>
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
                <th scope="col" className="px-4 py-3 w-10">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((journal) => (
                <tr
                  key={journal.id}
                  onClick={() => router.push(`/journals/${journal.id}`)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{journal.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {journal.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{journal.addressSuburb ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {journal.pageCount != null ? journal.pageCount : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDate(journal.updatedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={(e) => handleUnlink(e, journal.id)}
                      className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Unlink journal"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <JournalFormDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        entityType={entityType}
        entityId={entityId}
        createJournal={createJournal}
        linkJournal={linkJournal}
        onCreated={handleCreatedAndLinked}
      />

      <JournalLinkDrawer
        open={linkDrawerOpen}
        onOpenChange={setLinkDrawerOpen}
        fetchAllJournals={fetchAllJournals}
        linkJournal={linkJournal}
        entityType={entityType}
        onLinked={handleLinked}
      />
    </div>
  );
}
