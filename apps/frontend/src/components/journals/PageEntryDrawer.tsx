'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  FilePlus2,
  FileText,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { StagedFileTile } from '@/components/documents/DocumentUploadTile';
import { validateFile, validateBatch, formatBytes } from '@/lib/upload';
import { useDocumentUpload } from '@/lib/upload/use-document-upload';
import type { ApiClient } from '@/lib/api-client';
import type { JournalPage, JournalPageAttachment, JournalPageBlock } from '@/types/api';

type NoteDraft = { id: string; type: 'note'; text: string };
type UploadDraft = { id: string; type: 'upload'; file: File; documentId?: string };
type ContentDraft = NoteDraft | UploadDraft;

export interface PageEntryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId: string;
  api: ApiClient;
  onCreated?: (page: JournalPage) => void;
}

export function PageEntryDrawer({
  open,
  onOpenChange,
  journalId,
  api,
  onCreated,
}: PageEntryDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [blocks, setBlocks] = useState<ContentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const pendingPageRef = useRef<JournalPage | null>(null);
  const pendingBlocksRef = useRef<JournalPageBlock[]>([]);
  const uploadSortRef = useRef(0);

  const {
    addFiles,
    tasks: uploadTasks,
    isUploading,
    progress: overallProgress,
  } = useDocumentUpload({
    relatedRecordType: 'Journal',
    relatedRecordId: journalId,
  });

  // Track completed upload tasks → create journal page attachments + save page
  useEffect(() => {
    if (!submitting || !pendingPageRef.current) return;

    const page = pendingPageRef.current;
    const allUploadBlocks = blocks.filter(
      (b): b is UploadDraft => b.type === 'upload',
    );
    if (allUploadBlocks.length === 0) return;

    const allDone = allUploadBlocks.every((b) => {
      const task = uploadTasks.find((t) => t.file === b.file);
      return task && (task.status === 'completed' || task.status === 'failed');
    });
    if (!allDone) return;

    const anyFailed = allUploadBlocks.some((b) => {
      const task = uploadTasks.find((t) => t.file === b.file);
      return task?.status === 'failed';
    });
    if (anyFailed) {
      const failedTask = allUploadBlocks
        .map((b) => uploadTasks.find((t) => t.file === b.file))
        .find((t) => t?.status === 'failed');
      setError(`Upload failed: ${failedTask?.error ?? 'Unknown error'}`);
      setSubmitting(false);
      return;
    }

    (async () => {
      try {
        for (const block of allUploadBlocks) {
          const task = uploadTasks.find((t) => t.file === block.file);
          if (!task) continue;

          const attachment = (await api.createJournalPageAttachment(
            journalId,
            page.id,
            {
              fileName: block.file.name,
              mimeType: block.file.type || 'application/octet-stream',
              fileSize: block.file.size,
              storageKey: task.storageKey,
              documentId: task.documentId,
              thumbnailStorageKey: task.thumbnailObjectPath,
              sortIndex: uploadSortRef.current++,
            },
          )) as JournalPageAttachment;

          pendingBlocksRef.current.push({
            id: block.id,
            type: 'upload',
            attachmentId: attachment.id,
          });
        }

        const body = blocks
          .filter((b): b is NoteDraft => b.type === 'note')
          .map((b) => b.text.trim())
          .filter(Boolean)
          .join('\n\n');

        await api.updateJournalPage(journalId, page.id, {
          body: body || undefined,
          blocks: pendingBlocksRef.current,
        });

        let resultPage: JournalPage = {
          ...page,
          metadata: { ...page.metadata, blocks: pendingBlocksRef.current },
        };
        try {
          resultPage = await api.getJournalPage(journalId, page.id);
        } catch {
          /* use local blocks */
        }

        onCreated?.(resultPage);
        handleOpenChange(false);
      } catch (err) {
        console.error('PageEntryDrawer: finalize failed', err);
        setError(
          err instanceof Error ? err.message : 'Failed to finalize entry',
        );
        setSubmitting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadTasks]);

  const resetForm = useCallback(() => {
    setBlocks([]);
    setError(null);
    setSubmitting(false);
    setLocation(null);
    setLocationError(null);
    pendingPageRef.current = null;
    pendingBlocksRef.current = [];
    uploadSortRef.current = 0;
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetForm();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm],
  );

  const addNoteBlock = () => {
    setBlocks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'note', text: '' },
    ]);
  };

  const addUploadBlocks = useCallback((files: File[]) => {
    setError(null);
    const batchError = validateBatch(files);
    if (batchError) {
      setError(batchError);
      return;
    }

    const valid: UploadDraft[] = [];
    const errors: string[] = [];
    for (const file of files) {
      const result = validateFile(file);
      if (!result.valid) {
        errors.push(result.error ?? file.name);
      } else {
        valid.push({ id: crypto.randomUUID(), type: 'upload', file });
      }
    }

    if (errors.length > 0 && valid.length === 0) {
      setError(errors.join('\n'));
      return;
    }
    if (errors.length > 0) {
      setError(`${errors.length} file(s) skipped: ${errors[0]}`);
    }

    setBlocks((prev) => [...prev, ...valid]);
  }, []);

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, direction: -1 | 1) => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  const updateNoteText = (id: string, text: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.type === 'note' ? { ...b, text } : b,
      ),
    );
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocationError(null);
      },
      (err) => {
        setLocationError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const uploadCount = blocks.filter((b) => b.type === 'upload').length;
  const noteCount = blocks.filter((b) => b.type === 'note').length;
  const hasContent =
    blocks.some((b) => b.type === 'upload') ||
    blocks.some((b) => b.type === 'note' && b.text.trim());
  const canSubmit = hasContent && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContent) {
      setError('Add at least one note or upload');
      return;
    }

    setSubmitting(true);
    setError(null);
    pendingBlocksRef.current = [];
    uploadSortRef.current = 0;

    try {
      const noteBlocks = blocks.filter(
        (b): b is NoteDraft => b.type === 'note',
      );
      const body = noteBlocks
        .map((b) => b.text.trim())
        .filter(Boolean)
        .join('\n\n');

      const page = await api.createJournalPage(journalId, {
        body: body || undefined,
        bodyFormat: 'plaintext',
        latitude: location?.latitude,
        longitude: location?.longitude,
        locationAccuracy: location?.accuracy,
        blocks: noteBlocks
          .filter((b) => b.text.trim())
          .map((b) => ({
            id: b.id,
            type: 'note' as const,
            text: b.text.trim(),
          })),
      });

      pendingPageRef.current = page;

      for (const b of noteBlocks) {
        if (b.text.trim()) {
          pendingBlocksRef.current.push({
            id: b.id,
            type: 'note',
            text: b.text.trim(),
          });
        }
      }

      const uploadDrafts = blocks.filter(
        (b): b is UploadDraft => b.type === 'upload',
      );

      if (uploadDrafts.length === 0) {
        let resultPage: JournalPage = {
          ...page,
          metadata: {
            ...page.metadata,
            blocks: pendingBlocksRef.current,
          },
        };
        try {
          resultPage = await api.getJournalPage(journalId, page.id);
        } catch {
          /* use local */
        }
        onCreated?.(resultPage);
        handleOpenChange(false);
        return;
      }

      const files = uploadDrafts.map((b) => b.file);
      await addFiles(files);
    } catch (err) {
      console.error('PageEntryDrawer.handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'Failed to create entry');
      setSubmitting(false);
    }
  };

  const stagedBytes = blocks
    .filter((b): b is UploadDraft => b.type === 'upload')
    .reduce((sum, b) => sum + b.file.size, 0);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Add Entry"
      description="Build a running list of notes and uploads in any order."
      icon={<FilePlus2 className="h-5 w-5" />}
      widthClassName="w-[50%]"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="mb-5 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={captureLocation}
              disabled={submitting}
              className={location ? 'text-green-600' : ''}
            >
              <MapPin className="mr-1 size-4" />
              {location ? 'Located' : 'Add Location'}
            </Button>
            {locationError && (
              <span className="text-xs text-destructive">{locationError}</span>
            )}
            {location && (
              <span className="text-xs text-muted-foreground">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </span>
            )}
          </div>

          <div className="mb-3">
            <h3 className="text-sm font-medium">Content</h3>
            <p className="text-xs text-muted-foreground">
              {noteCount} note{noteCount === 1 ? '' : 's'} · {uploadCount}{' '}
              upload
              {uploadCount === 1 ? '' : 's'}
              {stagedBytes > 0 ? ` · ${formatBytes(stagedBytes)}` : ''}
            </p>
          </div>

          {isUploading && uploadTasks.length > 0 && (
            <div className="mb-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {uploadTasks.filter((i) => i.status === 'completed').length}/
                {uploadTasks.length} uploaded
              </span>
            </div>
          )}

          <div className="space-y-3">
            {blocks.map((block, index) => (
              <div key={block.id} className="rounded-lg border bg-background p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {block.type === 'note' ? (
                      <>
                        <FileText className="size-3.5" />
                        Note
                      </>
                    ) : (
                      <>
                        <Paperclip className="size-3.5" />
                        Upload
                      </>
                    )}
                    <span className="font-normal normal-case text-muted-foreground/70">
                      #{index + 1}
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={submitting || index === 0}
                      onClick={() => moveBlock(block.id, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={submitting || index === blocks.length - 1}
                      onClick={() => moveBlock(block.id, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={submitting}
                      onClick={() => removeBlock(block.id)}
                      aria-label="Remove"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {block.type === 'note' ? (
                  <Textarea
                    value={block.text}
                    onChange={(e) => updateNoteText(block.id, e.target.value)}
                    placeholder="Write a note…"
                    rows={3}
                    disabled={submitting}
                  />
                ) : (
                  <StagedFileTile
                    file={block.file}
                    onRemove={() => removeBlock(block.id)}
                  />
                )}
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addNoteBlock}
                disabled={submitting}
              >
                <Plus className="size-3.5" />
                Add note
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
              >
                <Plus className="size-3.5" />
                Add upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                disabled={submitting}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) addUploadBlocks(files);
                  e.target.value = '';
                }}
              />
              {blocks.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Start the list with a note or upload
                </span>
              )}
            </div>
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <div>
            {submitting && uploadCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                Progress:{' '}
                <strong className="font-semibold text-foreground">
                  {overallProgress}%
                </strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-1.5">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Add Entry
                </>
              )}
            </Button>
          </div>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
