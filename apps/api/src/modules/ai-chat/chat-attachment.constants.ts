export const MAX_CHAT_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_CHAT_IMAGES_PER_MESSAGE = 10;
export const MAX_CHAT_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const CHAT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/tif',
  'image/gif',
  'image/webp',
]);

export function isChatMimeTypeAllowed(mimeType: string, fileName: string): boolean {
  if (CHAT_ALLOWED_MIME_TYPES.has(mimeType)) return true;
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith('.pdf') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.tiff') ||
    lower.endsWith('.tif') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  );
}

export function isVisionMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
