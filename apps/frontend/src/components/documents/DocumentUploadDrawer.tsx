'use client';

import { useCallback, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDocumentUpload } from '@/lib/upload';
import type { UploadTask } from '@/lib/upload';

interface DocumentUploadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId?: string | null;
  relatedRecordType?: string;
  relatedRecordId?: string;
  onComplete?: () => void;
}

function TaskStatusIcon({ status }: { status: UploadTask['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'uploading':
    case 'completing':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-slate-300" />;
  }
}

export function DocumentUploadDrawer({
  open,
  onOpenChange,
  categoryId,
  relatedRecordType,
  relatedRecordId,
  onComplete,
}: DocumentUploadDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { upload, tasks, isUploading, progress, cancelTask, clearCompleted } =
    useDocumentUpload({
      categoryId,
      relatedRecordType,
      relatedRecordId,
      onComplete,
    });

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      upload(Array.from(files));
    },
    [upload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  if (!open) return null;

  const hasCompleted = tasks.some((t) => t.status === 'completed' || t.status === 'failed');

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg animate-in slide-in-from-bottom-4">
      <div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-white shadow-xl">
        <div
          data-slot="drawer-header"
          className="flex items-center justify-between border-b border-sidebar-border px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-sidebar-foreground" />
            <h3 className="text-sm font-semibold text-sidebar-foreground">Upload Documents</h3>
            {isUploading && (
              <span className="text-xs text-sidebar-foreground/65">{progress}%</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {hasCompleted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCompleted}
                className="text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className="p-4"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handleDrop}
        >
          {tasks.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 p-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <Upload className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Drop files here or click to browse
                </p>
                <p className="text-xs text-slate-400 mt-1">Max 50 MB per file</p>
              </div>
            </button>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-md border border-slate-100 px-3 py-2"
                >
                  <TaskStatusIcon status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium text-slate-700">
                      {task.fileName}
                    </p>
                    {task.status === 'uploading' && (
                      <div className="mt-1 h-1 w-full rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                    {task.error && (
                      <p className="text-xs text-red-500 mt-0.5">{task.error}</p>
                    )}
                  </div>
                  {(task.status === 'queued' || task.status === 'uploading') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => cancelTask(task.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {tasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              Add More Files
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
}
