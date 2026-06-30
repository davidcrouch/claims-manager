'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Eye, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TypeBadge } from '@/components/ui/type-badge';
import {
  SortableColumnHeader,
  ValueFilterMenu,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { formatDate, formatBytes } from '@/components/shared/detail';
import { fetchDocumentsAction } from '@/app/(app)/admin/documents/actions';
import type { Attachment } from '@/types/api';

const PAGE_SIZE = 20;

type DocSortField = 'title' | 'type' | 'entity' | 'filename' | 'size' | 'created_at';

interface ColDef {
  key: DocSortField;
  label: string;
}

const TABLE_COLUMNS: ColDef[] = [
  { key: 'title', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'entity', label: 'Entity' },
  { key: 'filename', label: 'Filename' },
  { key: 'size', label: 'Size' },
  { key: 'created_at', label: 'Uploaded' },
];

export function DocumentsListClient() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [columnSort, setColumnSort] = useState<{
    field: DocSortField;
    order: 'asc' | 'desc';
  }>({ field: 'created_at', order: 'desc' });
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetchDocumentsAction({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        sort: sortParam,
      });
      if (cancelled) return;
      setDocuments(res?.data ?? []);
      setTotal(res?.total ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, sortParam]);

  const handleColumnSort = (field: DocSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'title' || field === 'filename' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const d of documents) {
      const t = d.relatedRecordType?.trim();
      if (t) names.add(t);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [documents]);

  const toggleType = (name: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = documents;

    if (typeFilter.size > 0) {
      rows = rows.filter((d) => {
        const t = d.relatedRecordType?.trim();
        return t ? typeFilter.has(t) : false;
      });
    }

    return rows;
  }, [documents, typeFilter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={FolderOpen}
          title="Documents"
          total={total}
          showing={visibleRows.length}
          search={debouncedSearch}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <Input
              placeholder="Search documents by name or filename..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 w-full pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
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
            emptyLabel="All entity types"
            menuTitle="Filter by entity type"
            itemNoun={{ singular: 'type', plural: 'types' }}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-slate-400">Loading documents…</p>
          </div>
        ) : visibleRows.length > 0 ? (
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
                {visibleRows.map((doc) => (
                  <tr
                    key={doc.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => {
                      if (doc.relatedRecordType && doc.relatedRecordId) {
                        const entity = doc.relatedRecordType.toLowerCase();
                        const routes: Record<string, string> = {
                          job: `/jobs/${doc.relatedRecordId}`,
                          quote: `/quotes/${doc.relatedRecordId}`,
                          claim: `/claims/${doc.relatedRecordId}`,
                        };
                        const path = routes[entity];
                        if (path) router.push(path);
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {doc.title ?? doc.filename ?? doc.id}
                    </td>
                    <td className="px-4 py-3">
                      {doc.documentType ? (
                        <TypeBadge type={doc.documentType} />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {doc.relatedRecordType ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {doc.filename ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatBytes(doc.fileSize)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(doc.createdAt)}
                      {doc.uploadedByName ? ` by ${doc.uploadedByName}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <a
                        href={`/api/attachments/${doc.id}/download?disposition=inline`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <FolderOpen size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">
                {debouncedSearch
                  ? 'No documents match your search.'
                  : 'No documents found.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
