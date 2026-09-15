'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  File,
  Loader2,
  Paperclip,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  attachDocumentToEntityAction,
  fetchEntityAttachmentsAction,
} from '@/app/(app)/attachments/actions';
import { formatDate, formatBytes, PhaseUnavailable } from '@/components/shared/detail';
import {
  compareDates,
  compareValues,
  commitColumnFilterSelection,
  SortableColumnHeader,
  TableEmptyRow,
  ValueFilterMenu,
} from '@/components/shared/list-filters';
import { ProjectDocumentsPickerDrawer } from '@/components/documents/ProjectDocumentsPickerDrawer';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/types/api';

type SyncTab = 'all' | 'pending' | 'synced';

type AttachmentSortField = 'name' | 'type' | 'size' | 'status' | 'created_at';

interface ColDef {
  key: AttachmentSortField;
  label: string;
}

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Size' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Uploaded' },
];

interface EntityAttachmentsTabProps {
  entityId: string;
  relatedRecordType: 'Job' | 'Quote' | 'Invoice' | string;
  jobId?: string | null;
  entityLabel?: string;
  /** Controlled documents-picker open state (optional). */
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
  /** When true, omit the in-tab attach control (parent header owns it). */
  hideAttachButton?: boolean;
}

function attachmentFileName(a: Attachment): string {
  return a.fileName ?? a.filename ?? a.title ?? a.id;
}

function attachmentTypeLabel(a: Attachment): string {
  const docType = a.documentType?.trim();
  if (docType) return docType;
  const metaType = a.attachmentMeta?.documentTypeExternalReference;
  if (typeof metaType === 'string' && metaType.trim()) return metaType.trim();
  const mime = a.mimeType?.trim();
  if (!mime) return 'Unknown';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') {
    return 'Spreadsheet';
  }
  if (mime.includes('word')) return 'Word';
  return mime;
}

function attachmentSize(a: Attachment): number | null {
  if (typeof a.fileSize === 'string') {
    const n = Number(a.fileSize);
    return Number.isFinite(n) ? n : null;
  }
  return a.fileSize ?? null;
}

function isPendingSync(a: Attachment): boolean {
  return a.attachmentMeta?.pendingCrunchworkSync === true;
}

function syncStatusLabel(a: Attachment): string {
  return isPendingSync(a) ? 'Pending sync' : 'Synced';
}

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return FileSpreadsheet;
  }
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType === 'text/plain') {
    return FileText;
  }
  return File;
}

function getFileIconColor(mimeType?: string | null): string {
  if (!mimeType) return 'text-slate-500';
  if (mimeType.startsWith('image/')) return 'text-purple-500';
  if (mimeType.startsWith('video/')) return 'text-pink-500';
  if (mimeType.startsWith('audio/')) return 'text-orange-500';
  if (mimeType.includes('pdf')) return 'text-red-500';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'text-green-500';
  if (mimeType.includes('word')) return 'text-blue-500';
  return 'text-slate-500';
}

function getSortValue(a: Attachment, field: AttachmentSortField): string | number | null | undefined {
  switch (field) {
    case 'name':
      return attachmentFileName(a);
    case 'type':
      return attachmentTypeLabel(a);
    case 'size':
      return attachmentSize(a);
    case 'status':
      return syncStatusLabel(a);
    case 'created_at':
      return a.createdAt;
    default:
      return null;
  }
}

export function EntityAttachmentsTab({
  entityId,
  relatedRecordType,
  jobId,
  entityLabel,
  pickerOpen: pickerOpenProp,
  onPickerOpenChange,
  hideAttachButton = false,
}: EntityAttachmentsTabProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);
  const [internalPickerOpen, setInternalPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [syncTab, setSyncTab] = useState<SyncTab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [columnSort, setColumnSort] = useState<{
    field: AttachmentSortField;
    order: 'asc' | 'desc';
  }>({ field: 'created_at', order: 'desc' });

  const pickerOpen = pickerOpenProp ?? internalPickerOpen;
  const setPickerOpen = onPickerOpenChange ?? setInternalPickerOpen;

  const load = useCallback(async () => {
    const res = await fetchEntityAttachmentsAction(relatedRecordType, entityId);
    setAttachments(res.data);
    setPhaseUnavailable(res.phaseUnavailable);
  }, [entityId, relatedRecordType]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const canAttach = Boolean(jobId);
  const label = entityLabel ?? 'this record';

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const a of attachments) {
      names.add(attachmentTypeLabel(a));
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [attachments]);

  const uniqueStatuses = useMemo(() => ['Pending sync', 'Synced'], []);

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

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
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

  const handleColumnSort = (field: AttachmentSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'name' || field === 'type' ? 'asc' : 'desc' };
    });
  };

  const visibleRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let rows = attachments.filter((a) => {
      if (syncTab === 'pending' && !isPendingSync(a)) return false;
      if (syncTab === 'synced' && isPendingSync(a)) return false;

      if (typeFilterActive && !typeFilter.has(attachmentTypeLabel(a))) return false;
      if (statusFilterActive && !statusFilter.has(syncStatusLabel(a))) return false;

      if (!q) return true;
      const haystack = [
        attachmentFileName(a),
        a.title,
        a.documentType,
        a.mimeType,
        a.uploadedByName,
        syncStatusLabel(a),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    const isDate = columnSort.field === 'created_at';
    const isNumeric = columnSort.field === 'size';
    rows = [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      if (isDate) return compareDates(String(aVal ?? ''), String(bVal ?? ''), columnSort.order);
      if (isNumeric) {
        const an = typeof aVal === 'number' ? aVal : Number(aVal ?? NaN);
        const bn = typeof bVal === 'number' ? bVal : Number(bVal ?? NaN);
        const aMissing = !Number.isFinite(an);
        const bMissing = !Number.isFinite(bn);
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;
        return columnSort.order === 'asc' ? an - bn : bn - an;
      }
      return compareValues(String(aVal ?? ''), String(bVal ?? ''), columnSort.order);
    });
    return rows;
  }, [
    attachments,
    syncTab,
    debouncedSearch,
    typeFilter,
    typeFilterActive,
    statusFilter,
    statusFilterActive,
    columnSort,
  ]);

  async function handleAttach(params: {
    documentIds: string[];
    documentTypeExternalReference?: string;
  }) {
    const errors: string[] = [];
    for (const documentId of params.documentIds) {
      const result = await attachDocumentToEntityAction({
        documentId,
        relatedRecordType,
        relatedRecordId: entityId,
        documentTypeExternalReference: params.documentTypeExternalReference,
      });
      if (!result.success) {
        errors.push(result.error ?? `Failed to attach ${documentId}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(
        errors.length === params.documentIds.length
          ? errors[0]
          : `Attached ${params.documentIds.length - errors.length} of ${params.documentIds.length}. ${errors[0]}`,
      );
    }
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={syncTab} onValueChange={(val) => setSyncTab(val as SyncTab)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending sync</TabsTrigger>
              <TabsTrigger value="synced">Synced</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input
              placeholder="Search attachments..."
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

          {!hideAttachButton && (
            <Button
              size="default"
              variant="outline"
              disabled={!canAttach}
              className="h-10 gap-1.5"
              title={
                canAttach
                  ? 'Attach files from the project documents browser for upload to Crunchwork'
                  : 'Link a job to attach documents from the project repository'
              }
              onClick={() => setPickerOpen(true)}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Attach from Documents
              {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            </Button>
          )}
        </div>

        {!canAttach && (
          <p className="text-xs text-muted-foreground">
            Attach from Documents requires a linked job so files can be selected from the project
            repository and uploaded to Crunchwork.
          </p>
        )}

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
                      col.key === 'type'
                        ? {
                            options: uniqueTypes,
                            selected: typeFilter,
                            active: typeFilterActive,
                            onApply: applyTypeFilter,
                            menuTitle: 'Filter by type',
                            itemNoun: { singular: 'type', plural: 'types' },
                          }
                        : col.key === 'status'
                          ? {
                              options: uniqueStatuses,
                              selected: statusFilter,
                              active: statusFilterActive,
                              onApply: applyStatusFilter,
                              menuTitle: 'Filter by status',
                              itemNoun: { singular: 'status', plural: 'statuses' },
                            }
                          : undefined
                    }
                  />
                ))}
                <th scope="col" className="px-4 py-3 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <TableEmptyRow
                  colSpan={TABLE_COLUMNS.length + 1}
                  label={
                    attachments.length === 0
                      ? `No attachments linked to ${label}.`
                      : 'No attachments match your filters.'
                  }
                />
              ) : (
                visibleRows.map((a) => {
                  const name = attachmentFileName(a);
                  const Icon = getFileIcon(a.mimeType);
                  const iconColor = getFileIconColor(a.mimeType);
                  const pending = isPendingSync(a);
                  const size = attachmentSize(a);
                  const viewHref = `/api/attachments/${a.id}/download?disposition=inline`;
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className={cn('h-4 w-4 shrink-0', iconColor)} />
                          <span className="truncate font-medium text-slate-900" title={name}>
                            {name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{attachmentTypeLabel(a)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatBytes(size)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {pending ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                            title="Saved locally; will upload to Crunchwork when this record is synced"
                          >
                            Pending sync
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Synced
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(a.createdAt)}
                        {a.uploadedByName ? ` by ${a.uploadedByName}` : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <a
                          href={viewHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {attachments.length === 0 && canAttach && (
          <p className="text-center text-xs text-muted-foreground">
            Use Attach from Documents to select files from the project repository for upload to
            Crunchwork.
          </p>
        )}
      </div>

      {jobId && (
        <ProjectDocumentsPickerDrawer
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          jobId={jobId}
          relatedRecordType={relatedRecordType}
          showDocumentTypeField={relatedRecordType === 'Job'}
          onConfirm={handleAttach}
        />
      )}
    </>
  );
}
