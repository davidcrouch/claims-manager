import type { FilePart } from './chat-types';

const MAX_CHAT_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
export const MAX_CHAT_IMAGES_PER_MESSAGE = 10;
export const MAX_CHAT_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const CHAT_ACCEPTED_TYPES =
  '.pdf,.docx,.jpg,.jpeg,.png,.tiff,.txt,.csv,.gif,.webp';

export interface FileProcessingError {
  fileName: string;
  reason: string;
}

function isCsv(file: File): boolean {
  return (
    file.type === 'text/csv' ||
    file.name.toLowerCase().endsWith('.csv')
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export function validateChatFile(file: File): FileProcessingError | null {
  if (file.size > MAX_CHAT_FILE_SIZE) {
    return {
      fileName: file.name,
      reason: `File exceeds 20 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
    };
  }
  return null;
}

export function validateChatFileBatch(files: File[]): FileProcessingError[] {
  const errors: FileProcessingError[] = [];
  let imageCount = 0;
  let totalBytes = 0;

  for (const file of files) {
    const single = validateChatFile(file);
    if (single) {
      errors.push(single);
      continue;
    }

    totalBytes += file.size;
    if (file.type.startsWith('image/')) {
      imageCount += 1;
    }
  }

  if (imageCount > MAX_CHAT_IMAGES_PER_MESSAGE) {
    errors.push({
      fileName: 'attachments',
      reason: `Maximum ${MAX_CHAT_IMAGES_PER_MESSAGE} images per message`,
    });
  }

  if (totalBytes > MAX_CHAT_TOTAL_ATTACHMENT_BYTES) {
    errors.push({
      fileName: 'attachments',
      reason: `Total attachment size exceeds ${MAX_CHAT_TOTAL_ATTACHMENT_BYTES / (1024 * 1024)} MB limit`,
    });
  }

  return errors;
}

export async function prepareFilesForChat(
  files: File[],
): Promise<{ parts: FilePart[]; errors: FileProcessingError[] }> {
  const parts: FilePart[] = [];
  const errors = validateChatFileBatch(files);
  if (errors.length > 0) {
    return { parts, errors };
  }

  for (const file of files) {
    try {
      if (file.type.startsWith('image/')) {
        const url = await blobToDataUrl(file);
        parts.push({ type: 'file', url, mediaType: file.type, filename: file.name });
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const url = await blobToDataUrl(file);
        parts.push({ type: 'file', url, mediaType: 'application/pdf', filename: file.name });
      } else if (file.type.startsWith('text/') || isCsv(file)) {
        const url = await blobToDataUrl(file);
        const mediaType = isCsv(file) ? 'text/csv' : file.type;
        parts.push({ type: 'file', url, mediaType, filename: file.name });
      } else {
        const url = await blobToDataUrl(file);
        parts.push({ type: 'file', url, mediaType: file.type || 'application/octet-stream', filename: file.name });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ fileName: file.name, reason: `Processing failed: ${msg}` });
    }
  }

  return { parts, errors };
}

export async function uploadChatFile(
  file: File,
  conversationId: string,
): Promise<{ uri: string; signedUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('conversationId', conversationId);

  const response = await fetch('/api/chat/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('File upload failed');
  return response.json();
}
