'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { UploadEngine } from './upload-engine';
import { validateFile } from './validation';
import type { UploadTask, UploadUrlResponse } from './types';

interface UseDocumentUploadOptions {
  categoryId?: string | null;
  relatedRecordType?: string;
  relatedRecordId?: string;
  onComplete?: () => void;
}

export function useDocumentUpload(options?: UseDocumentUploadOptions) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const engineRef = useRef<UploadEngine | null>(null);

  useEffect(() => {
    const engine = new UploadEngine();

    engine.on('progress', ({ taskId, progress }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress, status: 'uploading' } : t)),
      );
    });

    engine.on('complete', ({ taskId }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'completed', progress: 100 } : t)),
      );
    });

    engine.on('error', ({ taskId, error }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: 'failed', error } : t)),
      );
      toast.error(`Upload failed: ${error}`);
    });

    engine.on('queue-complete', () => {
      setIsUploading(false);
      options?.onComplete?.();
    });

    engineRef.current = engine;
  }, []);

  const upload = useCallback(
    async (files: File[]) => {
      const validFiles: File[] = [];

      for (const file of files) {
        const result = validateFile(file);
        if (!result.valid) {
          toast.error(`${file.name}: ${result.error}`);
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length === 0) return;

      setIsUploading(true);

      try {
        const res = await fetch('/api/documents/upload-urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: validFiles.map((f) => ({
              fileName: f.name,
              mimeType: f.type,
              fileSizeBytes: f.size,
              categoryId: options?.categoryId ?? undefined,
              relatedRecordType: options?.relatedRecordType,
              relatedRecordId: options?.relatedRecordId,
            })),
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message || `Failed to get upload URLs (${res.status})`);
        }

        const { uploads } = (await res.json()) as { uploads: UploadUrlResponse[] };

        const newTasks: UploadTask[] = validFiles.map((file, i) => ({
          id: `upload-${Date.now()}-${i}`,
          file,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          uploadUrl: uploads[i].uploadUrl,
          documentId: uploads[i].documentId,
          storageKey: uploads[i].storageKey,
          status: 'queued' as const,
          progress: 0,
          categoryId: options?.categoryId,
          relatedRecordType: options?.relatedRecordType,
          relatedRecordId: options?.relatedRecordId,
        }));

        setTasks((prev) => [...prev, ...newTasks]);
        engineRef.current?.enqueue(newTasks);
      } catch (err) {
        setIsUploading(false);
        const msg = err instanceof Error ? err.message : 'Upload failed';
        toast.error(msg);
      }
    },
    [options?.categoryId, options?.relatedRecordType, options?.relatedRecordId],
  );

  const cancelTask = useCallback((taskId: string) => {
    engineRef.current?.cancel(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed' && t.status !== 'failed'));
  }, []);

  const overallProgress =
    tasks.length > 0
      ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length)
      : 0;

  return {
    upload,
    tasks,
    isUploading,
    progress: overallProgress,
    cancelTask,
    clearCompleted,
  };
}
