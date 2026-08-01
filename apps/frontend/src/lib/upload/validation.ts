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

const ALLOWED_SET = new Set(ALLOWED_MIME_TYPES);

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
