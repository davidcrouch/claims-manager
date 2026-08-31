'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { StagedFileTile } from '@/components/documents/DocumentUploadTile';
import {
  ProcessingStepsList,
  type ProcessingRow,
} from '@/components/documents/DocumentProcessingStatus';
import { useDocumentPipelineProgress } from '@/hooks/useDocumentPipelineProgress';
import { validateFile, validateBatch, formatBytes, MAX_FILE_SIZE } from '@/lib/upload';
import { useDocumentUpload } from '@/lib/upload/use-document-upload';
import type { UploadTask } from '@/lib/upload/types';
import { useApiClient } from '@/hooks/useApiClient';
import { usePageContext } from '@/lib/ai/use-page-context';
import type { JournalPage, JournalPageAttachment, JournalPageBlock } from '@/types/api';

type StagedFile = { id: string; file: File };

function findUploadTask(tasks: UploadTask[], file: File): UploadTask | undefined {
  return (
    tasks.find((t) => t.file === file) ??
    tasks.find((t) => t.fileName === file.name && t.fileSizeBytes === file.size)
  );
}

function isUploadSettled(task: UploadTask | undefined): boolean {
  return (
    task?.status === 'completed' ||
    task?.status === 'completing' ||
    task?.status === 'failed'
  );
}

export interface JournalFileUploadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journalId?: string;
  id?: string;
  jobId?: string;
  /** When set, uploads go to this project filesystem category instead of creating a journal page. */
  categoryId?: string;
  name?: string;
  entryKind?: string;
  prompt?: string;
  companionChatOpen?: boolean;
  [key: string]: unknown;
}

export function JournalFileUploadDrawer({
  open,
  onOpenChange,
  journalId: journalIdProp,
  id,
  jobId,
  categoryId,
  name: nameProp,
  entryKind: entryKindProp,
  prompt,
  companionChatOpen = false,
}: JournalFileUploadDrawerProps) {
  const api = useApiClient();
  const router = useRouter();
  const pageContext = usePageContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const journalId = useMemo(() => {
    const fromProp = typeof journalIdProp === 'string' ? journalIdProp.trim() : '';
    if (fromProp) return fromProp;
    const fromId = typeof id === 'string' ? id.trim() : '';
    if (fromId) return fromId;
    if (pageContext.entityType === 'journal' && pageContext.entityId) {
      return pageContext.entityId;
    }
    return '';
  }, [journalIdProp, id, pageContext.entityType, pageContext.entityId]);

  const entryName = (typeof nameProp === 'string' && nameProp.trim()) || 'Inspection photos';
  const entryKind =
    (typeof entryKindProp === 'string' && entryKindProp.trim()) || 'observation';

  const folderMode = Boolean(categoryId);

  const [files, setFiles] = useState<StagedFile[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageCreated, setPageCreated] = useState(false);
  const [attachmentsLinked, setAttachmentsLinked] = useState(false);

  const pendingPageRef = useRef<JournalPage | null>(null);
  const pendingBlocksRef = useRef<JournalPageBlock[]>([]);
  const uploadSortRef = useRef(0);
  const finalizingRef = useRef(false);
  const resultPageRef = useRef<JournalPage | null>(null);
  const finishRef = useRef(false);
  const filesRef = useRef<StagedFile[]>([]);
  filesRef.current = files;

  const { addFiles, tasks: uploadTasks, isUploading } = useDocumentUpload(
    folderMode
      ? {
          categoryId: categoryId || undefined,
          jobId: jobId || null,
        }
      : {
          relatedRecordType: 'Journal',
          relatedRecordId: journalId || undefined,
          jobId: jobId || null,
        },
  );

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

  const resetForm = useCallback(() => {
    setFiles([]);
    setNote('');
    setError(null);
    setDragOver(false);
    setSubmitting(false);
    setPageCreated(false);
    setAttachmentsLinked(false);
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
    if (!submitting || !pageCreated || finalizingRef.current) return;
    if (!folderMode) return;

    const staged = filesRef.current;
    if (staged.length === 0) return;

    const allDone = staged.every((b) => isUploadSettled(findUploadTask(uploadTasks, b.file)));
    if (!allDone) return;

    const failedTask = staged
      .map((b) => findUploadTask(uploadTasks, b.file))
      .find((t) => t?.status === 'failed');
    if (failedTask) {
      setError(`Upload failed: ${failedTask.error ?? 'Unknown error'}`);
      setSubmitting(false);
      return;
    }

    finalizingRef.current = true;
    toast.success(
      `Uploaded ${staged.length} file${staged.length === 1 ? '' : 's'} to project folder`,
    );
    router.refresh();
    handleOpenChange(false);
  }, [submitting, pageCreated, folderMode, uploadTasks, handleOpenChange, router]);

  useEffect(() => {
    if (!submitting || !pendingPageRef.current || finalizingRef.current) return;
    if (folderMode) return;

    const page = pendingPageRef.current;
    const staged = filesRef.current;
    if (staged.length === 0) return;

    const allDone = staged.every((b) => isUploadSettled(findUploadTask(uploadTasks, b.file)));
    if (!allDone) return;

    const failedTask = staged
      .map((b) => findUploadTask(uploadTasks, b.file))
      .find((t) => t?.status === 'failed');
    if (failedTask) {
      setError(`Upload failed: ${failedTask.error ?? 'Unknown error'}`);
      setSubmitting(false);
      return;
    }

    finalizingRef.current = true;

    void (async () => {
      try {
        for (const block of staged) {
          const task = findUploadTask(uploadTasks, block.file);
          if (!task) continue;

          const attachment = (await api.createJournalPageAttachment(journalId, page.id, {
            fileName: block.file.name,
            mimeType: block.file.type || 'application/octet-stream',
            fileSize: block.file.size,
            storageKey: task.storageKey,
            documentId: task.documentId,
            thumbnailStorageKey: task.thumbnailObjectPath,
            sortIndex: uploadSortRef.current++,
          })) as JournalPageAttachment;

          pendingBlocksRef.current.push({
            id: block.id,
            type: 'upload',
            attachmentId: attachment.id,
          });
        }

        const body = note.trim();
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
        console.error('[frontend:JournalFileUploadDrawer.finalize]', err);
        finalizingRef.current = false;
        setError(err instanceof Error ? err.message : 'Failed to attach files to the journal entry');
        setSubmitting(false);
      }
    })();
  }, [api, journalId, note, uploadTasks, submitting]);

  useEffect(() => {
    if (!submitting || !attachmentsLinked || !resultPageRef.current || finishRef.current) return;
    const uploadsBusy = uploadTasks.some(
      (t) => t.status === 'queued' || t.status === 'uploading' || t.status === 'completing',
    );
    if (uploadsBusy) return;
    if (pipelineActive && !pipeline.settled) return;

    finishRef.current = true;
    toast.success(
      `Added ${filesRef.current.length} file${filesRef.current.length === 1 ? '' : 's'} to the journal`,
    );
    router.refresh();
    handleOpenChange(false);
  }, [
    submitting,
    attachmentsLinked,
    uploadTasks,
    pipelineActive,
    pipeline.settled,
    handleOpenChange,
    router,
  ]);

  const addStagedFiles = useCallback((incoming: File[]) => {
    setError(null);
    const batchError = validateBatch(incoming);
    if (batchError) {
      setError(batchError);
      return;
    }

    const valid: StagedFile[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      const result = validateFile(file);
      if (!result.valid) {
        errors.push(result.error ?? file.name);
      } else {
        valid.push({ id: crypto.randomUUID(), file });
      }
    }

    if (errors.length > 0 && valid.length === 0) {
      setError(errors.join('\n'));
      return;
    }
    if (errors.length > 0) {
      setError(`${errors.length} file(s) skipped: ${errors[0]}`);
    }
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (submitting) return;
      addStagedFiles(Array.from(e.dataTransfer.files));
    },
    [addStagedFiles, submitting],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderMode && !journalId) {
      setError('No journal is selected. Ask the assistant to create or open a journal first.');
      return;
    }
    if (files.length === 0) {
      setError('Add at least one file');
      return;
    }

    setSubmitting(true);
    setError(null);
    pendingBlocksRef.current = [];
    uploadSortRef.current = 0;

    if (folderMode) {
      try {
        await addFiles(files.map((f) => f.file));
        setPageCreated(true);
      } catch (err) {
        console.error('[frontend:JournalFileUploadDrawer.handleSubmit:folderMode]', err);
        setError(err instanceof Error ? err.message : 'Failed to upload files');
        setSubmitting(false);
      }
      return;
    }

    try {
      const body = note.trim();
      const page = await api.createJournalPage(journalId, {
        name: entryName,
        body: body || undefined,
        bodyFormat: 'plaintext',
        blocks: body
          ? [{ id: crypto.randomUUID(), type: 'note', text: body }]
          : undefined,
        metadata: {
          entryKind,
          generatedBy: 'journal-assistant',
        },
      });

      pendingPageRef.current = page;
      setPageCreated(true);

      if (body) {
        pendingBlocksRef.current.push({
          id: crypto.randomUUID(),
          type: 'note',
          text: body,
        });
      }

      await addFiles(files.map((f) => f.file));
    } catch (err) {
      console.error('[frontend:JournalFileUploadDrawer.handleSubmit]', err);
      setError(err instanceof Error ? err.message : 'Failed to create journal entry');
      setSubmitting(false);
    }
  };

  const stagedBytes = files.reduce((sum, b) => sum + b.file.size, 0);

  const submitProgressRows = useMemo((): ProcessingRow[] => {
    if (!submitting) return [];
    const rows: ProcessingRow[] = [];

    if (!folderMode) {
      rows.push({
        id: 'create',
        label: 'Creating journal entry',
        state: pageCreated ? 'done' : 'active',
      });
    }

    for (const task of uploadTasks) {
      let label = `Upload ${task.fileName}`;
      let state: ProcessingRow['state'] = 'pending';
      if (task.status === 'failed') {
        label = `Upload failed: ${task.fileName}`;
        state = 'failed';
      } else if (task.status === 'completed') {
        label = `Uploaded ${task.fileName}`;
        state = 'done';
      } else if (task.status === 'completing' || task.status === 'uploading') {
        label = `Uploading ${task.fileName}`;
        state = 'active';
      }
      rows.push({ id: task.id, label, state });
    }

    if (!folderMode && pageCreated && files.length > 0) {
      rows.push({
        id: 'link',
        label: 'Attaching files to entry',
        state: attachmentsLinked ? 'done' : 'active',
      });
    }

    return rows;
  }, [submitting, folderMode, pageCreated, uploadTasks, files.length, attachmentsLinked]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={folderMode ? 'Upload inspection photos' : 'Upload to journal'}
      description={prompt?.trim() || (folderMode ? 'Drop inspection photos. They are saved to the project folder.' : 'Drop inspection photos or files. They are saved as a journal entry.')}
      icon={<Upload className="h-5 w-5" />}
      companionChatOpen={companionChatOpen}
      preventClose={submitting || isUploading}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <BottomFormDrawerBody>
          {!folderMode && !journalId && (
            <BottomFormDrawerError error="No journal is selected. Ask the assistant to create a site journal first." />
          )}
          <BottomFormDrawerError error={error} />

          <button
            type="button"
            disabled={(!folderMode && !journalId) || submitting}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!submitting) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/40'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <Upload className="mb-3 h-8 w-8 text-slate-500" />
            <p className="text-sm font-medium text-slate-800">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-slate-500">Photos, PDFs, and documents. Up to {formatBytes(MAX_FILE_SIZE)} each.</p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addStagedFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />

          {files.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-sm font-medium text-slate-700">
                {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(stagedBytes)}
              </p>
              <div className="flex flex-wrap gap-3">
                {files.map((item) => (
                  <StagedFileTile
                    key={item.id}
                    file={item.file}
                    onRemove={() => {
                      if (!submitting) {
                        setFiles((prev) => prev.filter((f) => f.id !== item.id));
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-2">
            <Label htmlFor="journal-upload-note">Note (optional)</Label>
            <Textarea
              id="journal-upload-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What these files show…"
              rows={3}
              disabled={submitting}
              className="resize-none"
            />
          </div>

          {submitting && submitProgressRows.length > 0 && (
            <div className="mt-6">
              <ProcessingStepsList rows={submitProgressRows} />
            </div>
          )}
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={(!folderMode && !journalId) || files.length === 0 || submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {folderMode ? 'Uploading…' : 'Adding…'}
              </>
            ) : (
              folderMode
                ? `Upload ${files.length || ''} file${files.length === 1 ? '' : 's'}`.trim()
                : `Add ${files.length || ''} to journal`.trim()
            )}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
