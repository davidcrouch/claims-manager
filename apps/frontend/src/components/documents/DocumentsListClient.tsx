'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Eye, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TypeBadge } from '@/components/ui/type-badge';
import {
  SortableColumnHeader,
  ValueFilterMenu,
  TableEmptyRow,
  commitColumnFilterSelection,
  columnFilterToValuesParam,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
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
  filterable?: boolean;
  locked?: boolean;
}

const TABLE_COLUMNS: ColDef[] = [
  { key: 'title', label: 'Name', locked: true },
  { key: 'type', label: 'Type' },
  { key: 'entity', label: 'Entity', filterable: true },
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
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'documents',
    TABLE_COLUMNS,
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const sortParam = `${columnSort.field}_${columnSort.order}`;
  const relatedRecordTypeParam = useMemo(
    () => columnFilterToValuesParam(typeFilterActive, typeFilter),
    [typeFilterActive, typeFilter],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (relatedRecordTypeParam === null) {
        if (!cancelled) {
          setDocuments([]);
          setTotal(0);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const res = await fetchDocumentsAction({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        relatedRecordType: relatedRecordTypeParam,
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
  }, [debouncedSearch, page, sortParam, relatedRecordTypeParam]);

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
    const names = new Set<string>([
      'Claim',
      'Job',
      'Quote',
      'Invoice',
      'PurchaseOrder',
      'WorkOrder',
      'Report',
      'Rfq',
      'Proposal',
      'Bill',
      'Task',
      'Appointment',
      'Journal',
    ]);
    for (const d of documents) {
      const t = d.relatedRecordType?.trim();
      if (t) names.add(t);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [documents]);

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
    setPage(1);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const visibleRows = useMemo(() => {
    let rows = documents;

    return rows;
  }, [documents]);

  const typeFilterProps = {
    options: uniqueTypes,
    selected: typeFilter,
    active: typeFilterActive,
    onApply: applyTypeFilter,
    menuTitle: 'Filter by entity type',
    itemNoun: { singular: 'type', plural: 'types' },
  };

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
            selected={typeFilterActive ? typeFilter : new Set(uniqueTypes)}
            onToggle={toggleType}
            onClearAll={() => {
              setTypeFilter(new Set());
              setTypeFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setTypeFilter(new Set());
              setTypeFilterActive(false);
              setPage(1);
            }}
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
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {TABLE_COLUMNS.filter((col) => isVisible(col.key)).map((col) => (
                    <SortableColumnHeader
                      key={col.key}
                      columnKey={col.key}
                      label={col.label}
                      activeField={columnSort.field}
                      sortOrder={columnSort.order}
                      onSort={handleColumnSort}
                      filter={col.key === 'entity' ? typeFilterProps : undefined}
                    />
                  ))}
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  <ColumnSettingsHeaderCell
                    columns={TABLE_COLUMNS}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <TableEmptyRow
                    colSpan={visibleCount + 2}
                    label={
                      debouncedSearch
                        ? 'No documents match your search.'
                        : 'No documents found.'
                    }
                  />
                ) : (
                  visibleRows.map((doc) => (
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
                      {isVisible('title') && (
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {doc.title ?? doc.filename ?? doc.id}
                        </td>
                      )}
                      {isVisible('type') && (
                        <td className="px-4 py-3">
                          {doc.documentType ? (
                            <TypeBadge type={doc.documentType} />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}
                      {isVisible('entity') && (
                        <td className="px-4 py-3 text-slate-600">
                          {doc.relatedRecordType ?? '—'}
                        </td>
                      )}
                      {isVisible('filename') && (
                        <td className="px-4 py-3 text-slate-600">
                          {doc.filename ?? '—'}
                        </td>
                      )}
                      {isVisible('size') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatBytes(doc.fileSize)}
                        </td>
                      )}
                      {isVisible('created_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(doc.createdAt)}
                          {doc.uploadedByName ? ` by ${doc.uploadedByName}` : ''}
                        </td>
                      )}
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
                      <td className="px-2 py-3" aria-hidden />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
