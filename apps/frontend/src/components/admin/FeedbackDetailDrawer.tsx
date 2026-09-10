'use client';

import { useEffect, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Bug,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageCircle,
  MessageSquareWarning,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
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
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { formatDateTime } from '@/components/shared/detail';
import {
  addFeedbackNoteAction,
  deleteFeedbackNoteAction,
  updateFeedbackNoteAction,
} from '@/app/(app)/admin/feedback/actions';
import type {
  FeedbackItem,
  FeedbackNote,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackType,
} from '@/types/api';

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  enhancement: 'Enhancement',
  question: 'Question',
  comment: 'Comment',
};

const TYPE_ICONS: Record<FeedbackType, typeof Bug> = {
  bug: Bug,
  feature_request: Lightbulb,
  enhancement: Sparkles,
  question: HelpCircle,
  comment: MessageCircle,
};

const TYPE_COLORS: Record<FeedbackType, string> = {
  bug: 'bg-red-50 text-red-700',
  feature_request: 'bg-violet-50 text-violet-700',
  enhancement: 'bg-blue-50 text-blue-700',
  question: 'bg-amber-50 text-amber-700',
  comment: 'bg-slate-100 text-slate-600',
};

const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function stripTrailingEmail(label: string): string {
  const stripped = label.replace(/\s*\([^)]*@[^)]*\)\s*$/, '').trim();
  return stripped || label;
}

function formatReporter(item: FeedbackItem): string {
  const label = item.reportedByName?.trim();
  if (label && !looksLikeUuid(label)) return stripTrailingEmail(label);
  const id = item.reportedByUserId?.trim();
  if (id && !looksLikeUuid(id)) return id;
  return 'Unknown user';
}

function formatNoteAuthor(note: FeedbackNote): string {
  const label = note.createdByName?.trim();
  if (label && !looksLikeUuid(label)) return stripTrailingEmail(label);
  return 'Unknown user';
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
      <dt className="pt-0.5 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-900">{children}</dd>
    </div>
  );
}

export interface FeedbackDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FeedbackItem | null;
  isPending: boolean;
  onStatusChange: (id: string, status: FeedbackStatus) => void;
  onUpdated: (item: FeedbackItem) => void;
}

export function FeedbackDetailDrawer({
  open,
  onOpenChange,
  item,
  isPending,
  onStatusChange,
  onUpdated,
}: FeedbackDetailDrawerProps) {
  if (!item) {
    return (
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Feedback"
        description="Feedback details"
        icon={<MessageSquareWarning className="h-5 w-5" />}
      >
        <BottomFormDrawerBody>
          <p className="text-sm text-slate-500">No feedback selected.</p>
        </BottomFormDrawerBody>
        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
    );
  }

  const TypeIcon = TYPE_ICONS[item.type] ?? MessageCircle;
  const pageHref = item.pageContext?.pathname;
  const pageLabel = item.pageContext?.pageLabel || item.pageContext?.pathname;

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={item.title}
      description={`${TYPE_LABELS[item.type]} · ${formatDateTime(item.createdAt)}`}
      icon={<TypeIcon className="h-5 w-5" />}
    >
      <BottomFormDrawerBody className="px-0! py-0!">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-10 py-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge label={TYPE_LABELS[item.type]} className={TYPE_COLORS[item.type]} />
              <Badge
                label={item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                className={PRIORITY_COLORS[item.priority]}
              />
              <Badge
                label={STATUS_LABELS[item.status]}
                className={STATUS_COLORS[item.status]}
              />
            </div>

            <dl className="space-y-2.5">
              <MetaRow label="Reported by">
                <span className="font-medium">{formatReporter(item)}</span>
              </MetaRow>
              <MetaRow label="Created">
                <span>{formatDateTime(item.createdAt)}</span>
              </MetaRow>
              {pageHref && (
                <MetaRow label="Source page">
                  <Link
                    href={pageHref}
                    className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                  >
                    {pageLabel}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </MetaRow>
              )}
              {item.relatedEntityType && (
                <MetaRow label="Related">
                  <span>
                    {item.relatedEntityType}
                    {item.relatedEntityId ? `: ${item.relatedEntityId.slice(0, 8)}…` : ''}
                  </span>
                </MetaRow>
              )}
              {item.conversationId && (
                <MetaRow label="Conversation">
                  <span className="font-mono text-slate-600">
                    {item.conversationId.slice(0, 8)}…
                  </span>
                </MetaRow>
              )}
              {item.tags.length > 0 && (
                <MetaRow label="Tags">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </MetaRow>
              )}
            </dl>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
            <div className="space-y-6">
              <div>
                <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </h4>
                {item.description ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {item.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-slate-500">No description.</p>
                )}
              </div>

              <FeedbackNotesSection item={item} onUpdated={onUpdated} />
            </div>
          </div>
        </div>
      </BottomFormDrawerBody>
      <BottomFormDrawerFooter>
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {item.status !== 'resolved' && item.status !== 'closed' && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onStatusChange(item.id, 'resolved')}
                disabled={isPending}
              >
                Mark Resolved
              </Button>
            )}
            {item.status !== 'closed' && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onStatusChange(item.id, 'closed')}
                disabled={isPending}
              >
                Close Item
              </Button>
            )}
            {item.status === 'closed' && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => onStatusChange(item.id, 'open')}
                disabled={isPending}
              >
                Reopen
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}

function FeedbackNotesSection({
  item,
  onUpdated,
}: {
  item: FeedbackItem;
  onUpdated: (item: FeedbackItem) => void;
}) {
  const notes = item.notes ?? [];
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<FeedbackNote | null>(null);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    setDraft('');
    setEditingId(null);
    setEditBody('');
    setNoteToDelete(null);
  }, [item.id]);

  function addNote() {
    const body = draft.trim();
    if (!body) {
      toast.error('Enter a note before adding it');
      return;
    }
    startSave(async () => {
      try {
        const updated = await addFeedbackNoteAction(item.id, body);
        onUpdated(updated);
        setDraft('');
        toast.success('Note added');
      } catch (err) {
        console.error('[frontend:FeedbackNotesSection.addNote]', err);
        toast.error('Failed to add note');
      }
    });
  }

  function saveEdit() {
    if (!editingId) return;
    const body = editBody.trim();
    if (!body) {
      toast.error('Note cannot be empty');
      return;
    }
    startSave(async () => {
      try {
        const updated = await updateFeedbackNoteAction({
          id: item.id,
          noteId: editingId,
          body,
        });
        onUpdated(updated);
        setEditingId(null);
        setEditBody('');
        toast.success('Note updated');
      } catch (err) {
        console.error('[frontend:FeedbackNotesSection.saveEdit]', err);
        toast.error('Failed to update note');
      }
    });
  }

  function confirmDelete() {
    if (!noteToDelete) return;
    startSave(async () => {
      try {
        const updated = await deleteFeedbackNoteAction({
          id: item.id,
          noteId: noteToDelete.id,
        });
        onUpdated(updated);
        setNoteToDelete(null);
        toast.success('Note removed');
      } catch (err) {
        console.error('[frontend:FeedbackNotesSection.confirmDelete]', err);
        toast.error('Failed to remove note');
      }
    });
  }

  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Notes
      </h4>

      {notes.length === 0 ? (
        <p className="mb-4 text-sm italic text-slate-500">No notes yet.</p>
      ) : (
        <ul className="mb-4 space-y-3">
          {notes.map((note) => {
            const isEditing = editingId === note.id;
            const edited = note.updatedAt && note.updatedAt !== note.createdAt;
            return (
              <li
                key={note.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {formatNoteAuthor(note)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(note.createdAt)}
                      {edited ? ' · edited' : ''}
                    </p>
                  </div>
                  {note.canEdit && !isEditing && (
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={saving}
                        onClick={() => {
                          setEditingId(note.id);
                          setEditBody(note.body);
                        }}
                        aria-label="Edit note"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        disabled={saving}
                        onClick={() => setNoteToDelete(note)}
                        aria-label="Remove note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => {
                          setEditingId(null);
                          setEditBody('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving}
                        onClick={saveEdit}
                        className="bg-blue-600 text-white hover:bg-blue-500"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {note.body}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Add a note..."
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
      />
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={addNote}
          disabled={saving || !draft.trim()}
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          {saving && !editingId ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            'Add note'
          )}
        </Button>
      </div>

      <Dialog
        open={noteToDelete !== null}
        onOpenChange={(next) => {
          if (!saving) setNoteToDelete(next ? noteToDelete : null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-2 pt-0.5">
                <DialogTitle className="text-xl">Remove note</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  This note will be removed from the feedback item. This cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setNoteToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={confirmDelete}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
