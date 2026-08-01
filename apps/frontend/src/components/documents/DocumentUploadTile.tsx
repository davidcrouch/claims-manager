'use client';

import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileThumbnail, getFileCategory, formatBytes } from '@/lib/upload';
import type { UploadTask } from '@/lib/upload';

interface DocumentUploadTileProps {
  task: UploadTask;
  onRemove: (id: string) => void;
  onCancel: (id: string) => void;
}

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const category = getFileCategory(mimeType);
  switch (category) {
    case 'pdf':
      return <FileText className={cn('text-red-500', className)} />;
    case 'word':
      return <FileText className={cn('text-blue-500', className)} />;
    case 'excel':
      return <FileSpreadsheet className={cn('text-green-600', className)} />;
    case 'image':
      return <ImageIcon className={cn('text-purple-500', className)} />;
    default:
      return <File className={cn('text-slate-400', className)} />;
  }
}

export function DocumentUploadTile({ task, onRemove, onCancel }: DocumentUploadTileProps) {
  const thumbnail = useFileThumbnail(task.file);
  const category = getFileCategory(task.file.type);

  return (
    <div className="group relative flex w-[140px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative flex h-[100px] items-center justify-center overflow-hidden bg-slate-100">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={`Preview of ${task.file.name}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <FileTypeIcon mimeType={task.file.type} className="h-10 w-10" />
        )}

        {task.status === 'completed' && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-50/80">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
              <Check className="h-4 w-4 text-white" />
            </div>
          </div>
        )}
        {task.status === 'failed' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50/80">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
              <X className="h-4 w-4 text-white" />
            </div>
          </div>
        )}
        {(task.status === 'uploading' || task.status === 'completing') && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {(task.status === 'queued' || task.status === 'completed') && (
          <button
            type="button"
            onClick={() => onRemove(task.id)}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/70 text-white opacity-0 transition-opacity hover:bg-slate-800/90 group-hover:opacity-100"
            aria-label={`Remove ${task.file.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {task.status === 'uploading' && (
          <button
            type="button"
            onClick={() => onCancel(task.id)}
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/70 text-white opacity-0 transition-opacity hover:bg-slate-800/90 group-hover:opacity-100"
            aria-label={`Cancel upload of ${task.file.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5 px-2 py-1.5">
        <p className="truncate text-xs font-medium text-slate-700" title={task.file.name}>
          {task.file.name}
        </p>
        <p className="text-[10px] text-slate-500">
          {formatBytes(task.file.size)}
          {category && ` • ${category.toUpperCase()}`}
        </p>

        {(task.status === 'uploading' || task.status === 'queued' || task.status === 'completing') && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        )}

        {task.status === 'failed' && task.error && (
          <p className="mt-0.5 truncate text-[10px] text-red-600" title={task.error}>
            {task.error}
          </p>
        )}
      </div>
    </div>
  );
}

interface StagedFileTileProps {
  file: File;
  onRemove: () => void;
}

export function StagedFileTile({ file, onRemove }: StagedFileTileProps) {
  const thumbnail = useFileThumbnail(file);
  const category = getFileCategory(file.type);

  return (
    <div className="group relative flex w-[140px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative flex h-[100px] items-center justify-center overflow-hidden bg-slate-100">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={`Preview of ${file.name}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <FileTypeIcon mimeType={file.type} className="h-10 w-10" />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/70 text-white opacity-0 transition-opacity hover:bg-slate-800/90 group-hover:opacity-100"
          aria-label={`Remove ${file.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-1.5">
        <p className="truncate text-xs font-medium text-slate-700" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-slate-500">
          {formatBytes(file.size)}
          {category && ` • ${category.toUpperCase()}`}
        </p>
      </div>
    </div>
  );
}
