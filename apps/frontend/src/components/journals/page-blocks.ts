import type { JournalPage, JournalPageAttachment, JournalPageBlock } from '@/types/api';

export type ResolvedNoteBlock = { id: string; type: 'note'; text: string };
export type ResolvedUploadBlock = {
  id: string;
  type: 'upload';
  attachmentId: string;
  attachment: JournalPageAttachment | null;
};
export type ResolvedPageBlock = ResolvedNoteBlock | ResolvedUploadBlock;

function isBlockArray(value: unknown): value is JournalPageBlock[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const block = item as Record<string, unknown>;
    return (
      typeof block.id === 'string' &&
      (block.type === 'note' || block.type === 'upload')
    );
  });
}

export function resolvePageBlocks(page: JournalPage): ResolvedPageBlock[] {
  const attachments = page.attachments ?? [];
  const byId = new Map(attachments.map((a) => [a.id, a]));
  const raw = page.metadata?.blocks;

  if (!isBlockArray(raw)) return [];

  return raw.map((block) => {
    if (block.type === 'note') {
      return {
        id: block.id,
        type: 'note' as const,
        text: typeof block.text === 'string' ? block.text : '',
      };
    }
    return {
      id: block.id,
      type: 'upload' as const,
      attachmentId: block.attachmentId,
      attachment: byId.get(block.attachmentId) ?? null,
    };
  });
}

export function countUploadBlocks(page: JournalPage): number {
  return resolvePageBlocks(page).filter((b) => b.type === 'upload').length;
}

const DOCUMENT_STORAGE_KEY_RE =
  /\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

/** Document id from the upload pipeline (response field, metadata, or storage key). */
export function attachmentDocumentId(attachment: JournalPageAttachment): string | null {
  if (attachment.documentId) return attachment.documentId;
  const meta = attachment.metadata?.documentId;
  if (typeof meta === 'string' && meta) return meta;
  const match = attachment.storageKey.match(DOCUMENT_STORAGE_KEY_RE);
  return match?.[1] ?? null;
}

/** Thumbnail `<img src>` — document thumbnail route, or the file itself for images. */
export function attachmentThumbSrc(attachment: JournalPageAttachment): string | null {
  const documentId = attachmentDocumentId(attachment);
  if (documentId) return `/api/documents/${documentId}/thumbnail`;
  if (attachment.mimeType.startsWith('image/') && attachment.fileUrl) return attachment.fileUrl;
  return null;
}

export function countNoteBlocks(page: JournalPage): number {
  return resolvePageBlocks(page).filter((b) => b.type === 'note').length;
}
