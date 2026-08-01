'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateFile } from '@/lib/upload/validation';
import { toast } from 'sonner';

interface DocumentDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function DocumentDropZone({ onFilesDropped, children, disabled }: DocumentDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      if (e.dataTransfer?.types.includes('Files')) {
        setDragCounter((c) => c + 1);
        setIsDragging(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) setIsDragging(false);
      return Math.max(0, next);
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setDragCounter(0);

      if (disabled) return;

      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;

      const validFiles: File[] = [];
      for (const file of files) {
        const result = validateFile(file);
        if (result.valid) {
          validFiles.push(file);
        } else {
          toast.error(`${file.name}: ${result.error}`);
        }
      }

      if (validFiles.length > 0) {
        onFilesDropped(validFiles);
      }
    },
    [disabled, onFilesDropped],
  );

  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return (
    <div className="relative">
      {children}
      {isDragging && (
        <div
          className={cn(
            'fixed inset-0 z-[100] flex items-center justify-center',
            'bg-primary/5 backdrop-blur-sm',
            'border-2 border-dashed border-primary/40',
          )}
        >
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-8 shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-semibold text-slate-900">Drop files to upload</p>
            <p className="text-sm text-slate-500">Files will be added to documents</p>
          </div>
        </div>
      )}
    </div>
  );
}
