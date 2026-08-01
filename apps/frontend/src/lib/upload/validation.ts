export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_BATCH_SIZE = 50;

const ALLOWED_SET = new Set(ALLOWED_MIME_TYPES);

export type FileCategory = 'image' | 'pdf' | 'word' | 'excel' | 'powerpoint' | 'video' | 'audio' | 'other';

export function getFileCategory(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'word';
  }
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/csv'
  ) {
    return 'excel';
  }
  if (
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) {
    return 'powerpoint';
  }
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'other';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateBatch(files: File[]): string | null {
  if (files.length > MAX_BATCH_SIZE) {
    return `Too many files (${files.length}). Maximum batch size is ${MAX_BATCH_SIZE}.`;
  }
  return null;
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file.type || !ALLOWED_SET.has(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type || 'unknown'}" is not supported.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeMB} MB). Maximum allowed is 50 MB.`,
    };
  }

  if (!file.name || file.name.trim().length === 0) {
    return { valid: false, error: 'File name is empty.' };
  }

  return { valid: true };
}
