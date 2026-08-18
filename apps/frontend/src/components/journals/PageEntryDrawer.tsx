'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  ProcessingStepsList,
  rowStateFromStep,
  type ProcessingRow,
} from '@/components/documents/DocumentProcessingStatus';
import { useDocumentPipelineProgress } from '@/hooks/useDocumentPipelineProgress';
import { validateFile, validateBatch, formatBytes } from '@/lib/upload';
import { useDocumentUpload } from '@/lib/upload/use-document-upload';
import type { UploadTask } from '@/lib/upload/types';
import type { ApiClient } from '@/lib/api-client';
import type { JournalPage, JournalPageAttachment, JournalPageBlock } from '@/types/api';

type NoteDraft = { id: string; type: 'note'; text: string };
type UploadDraft = { id: string; type: 'upload'; file: File; documentId?: string };
type ContentDraft = NoteDraft | UploadDraft;

function findUploadTask(tasks: UploadTask[], block: UploadDraft): UploadTask | undefined {
  return (
    tasks.find((t) => t.file === block.file) ??
    tasks.find((t) => t.fileName === block.file.name && t.fileSizeBytes === block.file.size)
  );
}

function isUploadSettled(task: UploadTask | undefined): boolean {
  return (
    task?.status === 'completed' ||
    task?.status === 'completing' ||
    task?.status === 'failed'
  );
}

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
  const [pageCreated, setPageCreated] = useState(false);
  const [attachmentsLinked, setAttachmentsLinked] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const pendingPageRef = useRef<JournalPage | null>(null);
  const pendingBlocksRef = useRef<JournalPageBlock[]>([]);
  const uploadSortRef = useRef(0);
  const finalizingRef = useRef(false);
  const resultPageRef = useRef<JournalPage | null>(null);
  const finishRef = useRef(false);

  const {
    addFiles,
    tasks: uploadTasks,
    isUploading,
    progress: overallProgress,
  } = useDocumentUpload({
    relatedRecordType: 'Journal',
    relatedRecordId: journalId,
  });

  const uploadDocumentIds = useMemo(
    () => uploadTasks.map((t) => t.documentId).filter(Boolean),
    [uploadTasks],
  );

  const pipelineActive = uploadTasks.some(
    (t) => t.pipelineStatus === 'pending' || t.pipelineStatus === 'running',
  );

  const pipeline = useDocumentPipelineProgress(uploadDocumentIds, {
    enabled: submitting && attachmentsLinked && pipelineActive,
    showIdle: true,
    assumeNoneAfterMs: 12_000,
  });

  // Attach files once GCS (+ thumbnail) is in place — do not wait for upload-complete.
  useEffect(() => {
    if (!submitting || !pendingPageRef.current || finalizingRef.current) return;

    const page = pendingPageRef.current;
    const allUploadBlocks = blocks.filter(
      (b): b is UploadDraft => b.type === 'upload',
    );
    if (allUploadBlocks.length === 0) return;

    const allDone = allUploadBlocks.every((b) => isUploadSettled(findUploadTask(uploadTasks, b)));
    if (!allDone) return;

    const anyFailed = allUploadBlocks.some((b) => {
      const task = findUploadTask(uploadTasks, b);
      return task?.status === 'failed';
    });
    if (anyFailed) {
      const failedTask = allUploadBlocks
        .map((b) => findUploadTask(uploadTasks, b))
        .find((t) => t?.status === 'failed');
      setError(`Upload failed: ${failedTask?.error ?? 'Unknown error'}`);
      setSubmitting(false);
      return;
    }

    finalizingRef.current = true;

    (async () => {
      try {
        for (const block of allUploadBlocks) {
          const task = findUploadTask(uploadTasks, block);
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

        resultPageRef.current = resultPage;
        setAttachmentsLinked(true);
      } catch (err) {
        console.error('[journals/PageEntryDrawer.finalize] failed', err);
        finalizingRef.current = false;
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
    setPageCreated(false);
    setAttachmentsLinked(false);
    setLocation(null);
    setLocationError(null);
    pendingPageRef.current = null;
    pendingBlocksRef.current = [];
    uploadSortRef.current = 0;
    finalizingRef.current = false;
    resultPageRef.current = null;
    finishRef.current = false;
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) resetForm();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetForm],
  );

  useEffect(() => {
    if (!submitting || !attachmentsLinked || !resultPageRef.current || finishRef.current) return;
    const uploadsBusy = uploadTasks.some(
      (t) => t.status === 'queued' || t.status === 'uploading' || t.status === 'completing',
    );
    if (uploadsBusy) return;
    if (pipelineActive && !pipeline.settled) return;

    finishRef.current = true;
    onCreated?.(resultPageRef.current);
    handleOpenChange(false);
  }, [
    submitting,
    attachmentsLinked,
    uploadTasks,
    pipelineActive,
    pipeline.settled,
    onCreated,
    handleOpenChange,
  ]);

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
      setPageCreated(true);

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

  const submitProgressRows = useMemo((): ProcessingRow[] => {
    if (!submitting) return [];
    const rows: ProcessingRow[] = [
      {
        id: 'create',
        label: 'Creating entry',
        state: pageCreated ? 'done' : 'active',
      },
    ];

    for (const task of uploadTasks) {
      let label = `Upload ${task.fileName}`;
      let state: ProcessingRow['state'] = 'pending';
      let hint: string | undefined;
      if (task.status === 'failed') {
        label = `Upload failed: ${task.fileName}`;
        state = 'failed';
        hint = task.error;
      } else if (task.status === 'completed') {
        label = `Uploaded ${task.fileName}`;
        state = 'done';
      } else if (task.status === 'completing') {
        label = `Finishing ${task.fileName}`;
        state = 'active';
      } else if (task.status === 'uploading') {
        label = `Uploading ${task.fileName}`;
        state = 'active';
        hint = `${task.progress}%`;
      } else {
        label = `Waiting to upload ${task.fileName}`;
        state = pageCreated ? 'active' : 'pending';
      }
      rows.push({ id: task.id, label, state, hint });
    }

    if (uploadTasks.length > 0) {
      const uploadsReady = uploadTasks.every(
        (t) => t.status === 'completed' || t.status === 'completing',
      );
      rows.push({
        id: 'link',
        label: 'Attaching files to entry',
        state: attachmentsLinked ? 'done' : uploadsReady ? 'active' : 'pending',
      });
    }

    if (attachmentsLinked && pipelineActive && pipeline.phase !== 'none') {
      if (pipeline.steps.length > 0) {
        for (const step of pipeline.steps) {
          rows.push({
            id: `pipe-${step.agentId}`,
            label: step.label,
            state: rowStateFromStep(step),
          });
        }
      } else if (!pipeline.settled) {
        rows.push({
          id: 'pipe-start',
          label: pipeline.headline || 'Starting document processing…',
          state: 'active',
        });
      }
    }

    return rows;
  }, [submitting, pageCreated, uploadTasks, attachmentsLinked, pipeline, pipelineActive]);

  const submitLabel = (() => {
    if (!submitting) return null;
    if (pipeline.phase === 'running' || pipeline.phase === 'pending' || pipeline.phase === 'idle') {
      return pipeline.headline || 'Processing…';
    }
    if (attachmentsLinked) return 'Finishing…';
    if (isUploading) return 'Uploading…';
    return 'Saving…';
  })();

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Add Entry"
      description="Build a running list of notes and uploads in any order."
      icon={<FilePlus2 className="h-5 w-5" />}
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

          {submitting && submitProgressRows.length > 0 && (
            <div
              className="mb-4 rounded-lg border bg-muted/30 px-3 py-2.5"
              role="status"
              aria-live="polite"
            >
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Processing
              </p>
              <ProcessingStepsList rows={submitProgressRows} />
              {pipeline.error ? (
                <p className="mt-2 text-xs text-destructive">{pipeline.error}</p>
              ) : null}
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
            {submitting && uploadCount > 0 && overallProgress > 0 && overallProgress < 100 && (
              <span className="text-[11px] text-muted-foreground">
                Upload{' '}
                <strong className="font-semibold text-foreground">{overallProgress}%</strong>
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
                  {submitLabel}
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
