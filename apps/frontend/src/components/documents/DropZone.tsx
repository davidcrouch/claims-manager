'use client';

import { useCallback, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALLOWED_MIME_TYPES } from '@/lib/upload';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  children?: ReactNode;
}

const ACCEPT = ALLOWED_MIME_TYPES.join(',');

export function DropZone({ onFilesSelected, disabled, children }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [disabled, onFilesSelected],
  );

  const handleBrowseClick = useCallback(() => {
    if (disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ACCEPT;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length > 0) {
        onFilesSelected(files);
      }
      fileInputRef.current = null;
    };
    fileInputRef.current = input;
    input.click();
  }, [disabled, onFilesSelected]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop files here or click to browse"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleBrowseClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBrowseClick();
        }
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-slate-300 bg-white hover:border-primary/50 hover:bg-slate-50',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      {children ?? (
        <>
          <Upload className="mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-700">
            Drop files here, or click to browse
          </p>
          <p className="mt-1 text-xs text-slate-500">
            PDF, Word, Excel, Images — up to 50 MB each
          </p>
        </>
      )}
    </div>
  );
}
