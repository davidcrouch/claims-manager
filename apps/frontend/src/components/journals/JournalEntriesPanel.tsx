'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  File,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image as ImageIcon,
  MapPin,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JournalPage, JournalPageAttachment } from '@/types/api';
import {
  attachmentThumbSrc,
  countNoteBlocks,
  countUploadBlocks,
  resolvePageBlocks,
  type ResolvedNoteBlock,
  type ResolvedUploadBlock,
} from './page-blocks';

export interface JournalEntriesPanelProps {
  pages: JournalPage[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onAddEntry?: () => void;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function entryTitle(page: JournalPage): string {
  const firstNote = resolvePageBlocks(page).find(
    (b) => b.type === 'note' && b.text.trim(),
  );
  if (firstNote && firstNote.type === 'note') {
    const firstLine = firstNote.text.trim().split('\n')[0];
    return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
  }
  const firstUpload = resolvePageBlocks(page).find((b) => b.type === 'upload');
  if (firstUpload && firstUpload.type === 'upload' && firstUpload.attachment) {
    return firstUpload.attachment.fileName;
  }
  return 'Entry';
}

function contentSummary(page: JournalPage): string {
  const notes = countNoteBlocks(page);
  const uploads = countUploadBlocks(page);
  const parts: string[] = [];
  if (notes > 0) parts.push(`${notes} note${notes === 1 ? '' : 's'}`);
  if (uploads > 0) parts.push(`${uploads} upload${uploads === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' · ') : 'Empty';
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return FileSpreadsheet;
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType === 'text/plain')
    return FileText;
  return File;
}

function groupEntryBlocks(
  blocks: ReturnType<typeof resolvePageBlocks>,
): Array<
  | { kind: 'note'; block: ResolvedNoteBlock }
  | { kind: 'uploads'; blocks: ResolvedUploadBlock[] }
> {
  const groups: Array<
    | { kind: 'note'; block: ResolvedNoteBlock }
    | { kind: 'uploads'; blocks: ResolvedUploadBlock[] }
  > = [];

  for (const block of blocks) {
    if (block.type === 'note') {
      groups.push({ kind: 'note', block });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last?.kind === 'uploads') {
      last.blocks.push(block);
    } else {
      groups.push({ kind: 'uploads', blocks: [block] });
    }
  }

  return groups;
}

function UploadThumbnail({
  attachment,
  onExpand,
}: {
  attachment: JournalPageAttachment | null;
  onExpand: (url: string) => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);

  if (!attachment) {
    return (
      <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted/40 text-[11px] text-muted-foreground">
        Unavailable
      </div>
    );
  }

  const thumbSrc = attachmentThumbSrc(attachment);
  const fileSrc = attachment.fileUrl;
  const Icon = fileIcon(attachment.mimeType);

  const open = () => {
    if (attachment.mimeType.startsWith('image/')) {
      onExpand(fileSrc || thumbSrc || '');
      return;
    }
    if (fileSrc) {
      window.open(fileSrc, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={thumbFailed && !fileSrc}
      title={attachment.caption || attachment.fileName}
      className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-md border bg-muted text-left"
    >
      {!thumbFailed && thumbSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbSrc}
          alt={attachment.caption ?? attachment.fileName}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={() => setThumbFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-muted-foreground">
          <Icon className="size-7 shrink-0" />
          <span className="line-clamp-2 w-full text-center text-[10px] leading-tight">
            {attachment.fileName}
          </span>
        </span>
      )}
      {attachment.caption && (
        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[10px] leading-tight text-white line-clamp-2">
          {attachment.caption}
        </span>
      )}
    </button>
  );
}

function EntryContent({
  page,
  onExpand,
}: {
  page: JournalPage;
  onExpand: (url: string) => void;
}) {
  const blocks = resolvePageBlocks(page);
  const groups = groupEntryBlocks(blocks);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
        <FileText className="size-8 opacity-40" />
        <p className="text-sm">No notes or uploads in this entry</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) =>
        group.kind === 'note' ? (
          <div key={group.block.id} className="rounded-md border bg-muted/20 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Note
            </p>
            <p className="whitespace-pre-wrap text-sm">{group.block.text}</p>
          </div>
        ) : (
          <div key={group.blocks[0].id} className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {group.blocks.length === 1 ? 'Upload' : 'Uploads'}
            </p>
            <div className="flex flex-row flex-wrap gap-2">
              {group.blocks.map((block) => (
                <UploadThumbnail
                  key={block.id}
                  attachment={block.attachment}
                  onExpand={onExpand}
                />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export function JournalEntriesPanel({
  pages,
  selectedPageId,
  onSelectPage,
  onAddEntry,
}: JournalEntriesPanelProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const sortedPages = useMemo(
    () =>
      [...pages].sort(
        (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
      ),
    [pages],
  );

  const selectedPage =
    sortedPages.find((p) => p.id === selectedPageId) ?? sortedPages[0] ?? null;

  useEffect(() => {
    if (!selectedPageId && sortedPages[0]) {
      onSelectPage(sortedPages[0].id);
    }
  }, [selectedPageId, sortedPages, onSelectPage]);

  if (sortedPages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
        <FileText className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No entries yet</p>
        {onAddEntry && (
          <Button size="sm" onClick={onAddEntry} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Entry
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid min-h-[28rem] overflow-hidden rounded-lg border lg:grid-cols-[minmax(16rem,22rem)_1fr]">
        <aside className="border-b bg-muted/20 lg:border-b-0 lg:border-r">
          <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Entries ({sortedPages.length})
          </div>
          <ul className="max-h-[40vh] overflow-y-auto lg:max-h-[calc(100vh-16rem)]">
            {sortedPages.map((page) => {
              const active = selectedPage?.id === page.id;
              const imageCount =
                page.attachments?.filter((a) => a.mimeType.startsWith('image/')).length ?? 0;
              return (
                <li key={page.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPage(page.id)}
                    className={cn(
                      'w-full border-b px-3 py-3 text-left transition-colors hover:bg-muted/50',
                      active && 'bg-background shadow-[inset_3px_0_0_0_var(--primary)]',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="size-3 shrink-0" />
                      <span suppressHydrationWarning>{formatDate(page.capturedAt)}</span>
                      <span suppressHydrationWarning>{formatTime(page.capturedAt)}</span>
                    </div>
                    <p className="truncate text-sm font-medium">{entryTitle(page)}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{contentSummary(page)}</span>
                      {imageCount > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <ImageIcon className="size-3" />
                          {imageCount}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex min-h-0 flex-col">
          {selectedPage ? (
            <>
              <div className="space-y-2 border-b px-4 py-3">
                <h3 className="text-sm font-semibold">{entryTitle(selectedPage)}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                    <Clock className="size-3" />
                    {formatDate(selectedPage.capturedAt)} {formatTime(selectedPage.capturedAt)}
                  </span>
                  {selectedPage.locationLabel && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {selectedPage.locationLabel}
                    </span>
                  )}
                  {!selectedPage.locationLabel && selectedPage.latitude && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" />
                      {Number(selectedPage.latitude).toFixed(4)},{' '}
                      {Number(selectedPage.longitude).toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <EntryContent page={selectedPage} onExpand={setExpandedImage} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select an entry to view content
            </div>
          )}
        </section>
      </div>

      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedImage}
            alt="Expanded"
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </div>
      )}
    </>
  );
}
