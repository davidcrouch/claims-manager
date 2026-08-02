'use client';

import { useState, useCallback, useRef } from 'react';
import {
  prepareFilesForChat,
  uploadChatFile,
  validateChatFileBatch,
} from '@/lib/ai/file-processing';
import type { FileProcessingError } from '@/lib/ai/file-processing';
import type { FilePart } from '@/lib/ai/chat-types';

export function useFileUpload(conversationId?: string) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<FileProcessingError[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      setFileErrors([]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const processFiles = useCallback(async (): Promise<{ parts: FilePart[]; hadErrors: boolean }> => {
    if (selectedFiles.length === 0) return { parts: [], hadErrors: false };

    const batchErrors = validateChatFileBatch(selectedFiles);
    if (batchErrors.length > 0) {
      setFileErrors(batchErrors);
      return { parts: [], hadErrors: true };
    }

    setIsProcessingFiles(true);
    setFileErrors([]);
    try {
      if (conversationId) {
        const parts: FilePart[] = [];
        const errors: FileProcessingError[] = [];
        for (const file of selectedFiles) {
          try {
            const { uri, signedUrl } = await uploadChatFile(file, conversationId);
            parts.push({
              type: 'file',
              uri,
              url: signedUrl,
              mediaType: file.type || 'application/octet-stream',
              filename: file.name,
            });
          } catch {
            errors.push({ fileName: file.name, reason: 'Upload failed, using local processing' });
            const { parts: fallbackParts, errors: fallbackErrors } = await prepareFilesForChat([file]);
            parts.push(...fallbackParts);
            errors.push(...fallbackErrors);
          }
        }
        if (errors.length > 0) setFileErrors(errors);
        return { parts, hadErrors: errors.length > 0 && parts.length === 0 };
      }
      const { parts, errors } = await prepareFilesForChat(selectedFiles);
      if (errors.length > 0) setFileErrors(errors);
      return { parts, hadErrors: errors.length > 0 && parts.length === 0 };
    } finally {
      setIsProcessingFiles(false);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [selectedFiles, conversationId]);

  const addFiles = useCallback((files: File[]) => {
    const batchErrors = validateChatFileBatch(files);
    if (batchErrors.length > 0) {
      setFileErrors(batchErrors);
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files]);
    setFileErrors([]);
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    setFileErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return {
    selectedFiles,
    fileErrors,
    isProcessingFiles,
    fileInputRef,
    handleFilesSelected,
    addFiles,
    removeFile,
    processFiles,
    clearFiles,
  };
}
