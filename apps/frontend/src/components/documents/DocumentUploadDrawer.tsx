'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { DropZone } from './DropZone';
import { DocumentUploadTile, StagedFileTile } from './DocumentUploadTile';
import { useDocumentUpload, validateFile, validateBatch, formatBytes } from '@/lib/upload';

interface StagedFile {
  id: string;
  file: File;
}

interface DocumentUploadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId?: string | null;
  relatedRecordType?: string;
  relatedRecordId?: string;
  onComplete?: () => void;
}

export function DocumentUploadDrawer({
  open,
  onOpenChange,
  categoryId,
  relatedRecordType,
  relatedRecordId,
  onComplete,
}: DocumentUploadDrawerProps) {
  const {
    tasks,
    isUploading,
    progress,
    addFiles,
    cancelTask,
    cancelAll,
    removeTask,
    clearCompleted,
  } = useDocumentUpload({
    categoryId,
    relatedRecordType,
    relatedRecordId,
  });

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStartingUpload, setIsStartingUpload] = useState(false);
  const seenCompletedTaskIdsRef = useRef<Set<string>>(new Set());

  const handleFilesSelected = useCallback((files: File[]) => {
    setError(null);

    const batchError = validateBatch(files);
    if (batchError) {
      setError(batchError);
      return;
    }

    const valid: StagedFile[] = [];
    const errors: string[] = [];
    for (const file of files) {
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

    setStagedFiles((prev) => [...prev, ...valid]);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ files: File[] }>).detail;
      if (detail?.files?.length) {
        handleFilesSelected(detail.files);
      }
    };

    window.addEventListener('filesystem-upload-files', handler);
    return () => window.removeEventListener('filesystem-upload-files', handler);
  }, [open, handleFilesSelected]);

  const handleRemoveStaged = useCallback((id: string) => {
    setStagedFiles((prev) => prev.filter((sf) => sf.id !== id));
  }, []);

  const handleStartUpload = useCallback(async () => {
    if (stagedFiles.length === 0 || isStartingUpload) return;
    setError(null);
    setIsStartingUpload(true);
    const files = stagedFiles.map((sf) => sf.file);
    try {
      await addFiles(files);
      setStagedFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start upload');
    } finally {
      setIsStartingUpload(false);
    }
  }, [stagedFiles, addFiles, isStartingUpload]);

  const pendingCount = tasks.filter((t) => t.status === 'queued').length;
  const uploadingCount = tasks.filter(
    (t) => t.status === 'uploading' || t.status === 'completing',
  ).length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const taskCount = tasks.length;
  const stagedTotalBytes = stagedFiles.reduce((sum, sf) => sum + sf.file.size, 0);

  useEffect(() => {
    if (!open) {
      seenCompletedTaskIdsRef.current = new Set();
      return;
    }
    seenCompletedTaskIdsRef.current = new Set(
      tasks.filter((task) => task.status === 'completed').map((task) => task.id),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot only on drawer open
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let hadNewCompletion = false;
    for (const task of tasks) {
      if (task.status === 'completed' && !seenCompletedTaskIdsRef.current.has(task.id)) {
        seenCompletedTaskIdsRef.current.add(task.id);
        hadNewCompletion = true;
      }
    }
    if (hadNewCompletion) {
      onComplete?.();
    }
  }, [open, tasks, onComplete]);

  const handleDrawerOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        clearCompleted();
        setStagedFiles([]);
        setError(null);
        seenCompletedTaskIdsRef.current = new Set();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, clearCompleted],
  );

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleDrawerOpenChange}
      title="Upload Documents"
      description="Drag and drop or browse. Supports PDF, Word, Excel, and images."
      icon={<Upload className="h-5 w-5" />}
      widthClassName="w-[50%]"
    >
      <BottomFormDrawerBody>
        {taskCount > 0 && (
          <div className="mb-5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-medium text-sidebar-foreground/65">
              {completedCount}/{taskCount} complete
            </span>
            {completedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearCompleted}
                className="gap-1.5 text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
        )}

        <DropZone onFilesSelected={handleFilesSelected} />

        <BottomFormDrawerError error={error} />

        {stagedFiles.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-sidebar-foreground">
                Ready to Upload ({stagedFiles.length})
              </h3>
              <span className="text-xs text-sidebar-foreground/65">
                {formatBytes(stagedTotalBytes)} total
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {stagedFiles.map((sf) => (
                <StagedFileTile
                  key={sf.id}
                  file={sf.file}
                  onRemove={() => handleRemoveStaged(sf.id)}
                />
              ))}
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-sidebar-foreground">
                Uploads ({taskCount})
              </h3>
              {isUploading && (
                <span className="text-xs text-sidebar-foreground/65">
                  Uploading {uploadingCount} of {uploadingCount + pendingCount} remaining…
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {tasks.map((task) => (
                <DocumentUploadTile
                  key={task.id}
                  task={task}
                  onRemove={removeTask}
                  onCancel={cancelTask}
                />
              ))}
            </div>
          </div>
        )}
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <div>
          {isUploading && (
            <span className="text-[11px] text-sidebar-foreground/65">
              Progress:{' '}
              <strong className="font-semibold text-sidebar-foreground">{progress}%</strong>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isUploading && (
            <Button type="button" variant="outline" onClick={cancelAll}>
              Cancel All
            </Button>
          )}
          {stagedFiles.length > 0 && (
            <Button
              type="button"
              onClick={handleStartUpload}
              disabled={isStartingUpload}
              className="gap-1.5"
            >
              {isStartingUpload ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {stagedFiles.length} {stagedFiles.length === 1 ? 'File' : 'Files'}
                </>
              )}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => handleDrawerOpenChange(false)}>
            Close
          </Button>
        </div>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
