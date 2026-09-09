'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SortTabs,
  SearchInput,
  SortableColumnHeader,
  TableEmptyRow,
  type SortOption } from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatDateTime } from '@/components/shared/detail';
import { JobCellLink } from '@/components/shared/JobCellLink';
import { NoteDetailDrawer } from '@/components/notes/NoteDetailDrawer';
import { deleteNoteAction, fetchNotesAction } from '@/app/(app)/messages/actions';
import type { JobNote } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'created_at', label: 'Date' },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function NotesListPanel({
  jobNameById,
  jobTypeById,
  fetchJobId,
  fetchJobIds,
  uniqueJobs,
  jobFilter,
  jobFilterActive,
  onApplyJobFilter,
  onStatsChange,
  reloadToken,
}: {
  jobNameById?: Record<string, string>;
  jobTypeById?: Record<string, string>;
  fetchJobId?: string;
  fetchJobIds?: string[];
  uniqueJobs: string[];
  jobFilter: Set<string>;
  jobFilterActive: boolean;
  onApplyJobFilter: (next: Set<string>) => void;
  onStatsChange: (stats: { total: number; showing: number }) => void;
  reloadToken?: number;
}) {
  const onStatsChangeRef = useRef(onStatsChange);
  onStatsChangeRef.current = onStatsChange;
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedNote, setSelectedNote] = useState<JobNote | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<JobNote | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const loadGenRef = useRef(0);
  const limit = 20;
  const sortParam = `${sortField}_${sortOrder}`;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortField, sortOrder, fetchJobId, fetchJobIds]);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const res = await fetchNotesAction({
        page,
        limit,
        jobId: fetchJobId,
        jobIds: fetchJobIds,
        search: debouncedSearch || undefined,
        sort: sortParam });
      if (gen !== loadGenRef.current) return;
      setNotes(res.data);
      setTotal(res.total);
      onStatsChangeRef.current({ total: res.total, showing: res.data.length });
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [
    page,
    fetchJobId,
    fetchJobIds,
    debouncedSearch,
    sortParam,
  ]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const openNote = (note: JobNote) => {
    setSelectedNote(note);
    setDetailOpen(true);
  };

  const handleDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) setSelectedNote(null);
  };

  const requestDelete = (note: JobNote) => {
    setDeleteError(null);
    setNoteToDelete(note);
  };

  const handleDeleteDialogChange = (open: boolean) => {
    if (!open && !deletingId) {
      setNoteToDelete(null);
      setDeleteError(null);
    }
  };

  const confirmDelete = async () => {
    if (!noteToDelete) return;
    setDeletingId(noteToDelete.id);
    setDeleteError(null);
    try {
      const result = await deleteNoteAction(noteToDelete.id);
      if (!result.success) {
        setDeleteError(result.error ?? 'Failed to delete note');
        return;
      }
      if (selectedNote?.id === noteToDelete.id) {
        setDetailOpen(false);
        setSelectedNote(null);
      }
      setNoteToDelete(null);
      if (notes.length === 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        await load();
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
          <SearchInput
            placeholder="Search notes…"
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <SortableColumnHeader
                  columnKey="job"
                  label="Job"
                  activeField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  filter={{
                    options: uniqueJobs,
                    selected: jobFilterActive ? jobFilter : new Set(uniqueJobs),
                    active: jobFilterActive,
                    onApply: onApplyJobFilter,
                    menuTitle: 'Filter by job',
                    itemNoun: { singular: 'job', plural: 'jobs' } }}
                />
                <th scope="col" className="px-4 py-3">Note</th>
                <th scope="col" className="px-4 py-3">Author</th>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="w-px px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableEmptyRow colSpan={5} label="Loading notes…" />
              ) : notes.length === 0 ? (
                <TableEmptyRow colSpan={5} label="No notes found." />
              ) : (
                notes.map((note) => {
                  const preview = stripHtml(note.body ?? '').slice(0, 120);
                  const author = note.createdByName?.trim() || note.createdByUserId || 'Unknown';
                  return (
                    <tr
                      key={note.id}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => openNote(note)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openNote(note);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open note by ${author}`}
                    >
                      <td className="px-4 py-3 text-slate-700">
                        <JobCellLink
                          jobId={note.jobId}
                          jobNameById={jobNameById ?? {}}
                          jobTypeById={jobTypeById}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <div className="text-slate-900 truncate max-w-md">
                            {preview || '(Empty note)'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{author}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatDateTime(note.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-8 w-8 text-slate-400 hover:text-destructive"
                          disabled={deletingId === note.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDelete(note);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          aria-label="Delete note"
                        >
                          {deletingId === note.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={limit}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </div>

      <NoteDetailDrawer
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        note={selectedNote}
        jobNameById={jobNameById}
      />

      <Dialog
        open={noteToDelete !== null}
        onOpenChange={handleDeleteDialogChange}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Delete note</DialogTitle>
                <DialogDescription className="mt-1">
                  Delete this note? This cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(deletingId)}
              onClick={() => {
                setNoteToDelete(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={Boolean(deletingId)}
              onClick={() => void confirmDelete()}
            >
              {deletingId ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
