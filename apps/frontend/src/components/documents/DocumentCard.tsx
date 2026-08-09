'use client';

import { useCallback, useState, type CSSProperties, type DragEvent } from 'react';
import {
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  File,
  Download,
  FolderInput,
  Archive,
  Trash2,
  MoreVertical,
  Workflow,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { FSDocument, FilesystemCategory } from '@/lib/api-client';

export type DocumentAction = 'download' | 'move' | 'archive' | 'delete' | 'pipeline-history';

interface DocumentCardProps {
  document: FSDocument;
  categories?: FilesystemCategory[];
  onAction: (action: DocumentAction, documentId: string) => void;
  layout?: 'grid' | 'list';
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv')
    return FileSpreadsheet;
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType === 'text/plain')
    return FileText;
  return File;
}

function getFileIconColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'text-purple-500';
  if (mimeType.startsWith('video/')) return 'text-pink-500';
  if (mimeType.startsWith('audio/')) return 'text-orange-500';
  if (mimeType.includes('pdf')) return 'text-red-500';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'text-green-500';
  if (mimeType.includes('word')) return 'text-blue-500';
  return 'text-slate-500';
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getThumbSrc(doc: FSDocument): string {
  return `/api/documents/${doc.id}/thumbnail`;
}

function hasPossibleThumbnail(doc: FSDocument): boolean {
  if (doc.thumbnailUri) return true;
  if (doc.mimeType?.startsWith('image/') && doc.gcsBucket) return true;
  if (doc.mimeType === 'application/pdf' || doc.fileName?.toLowerCase().endsWith('.pdf')) {
    return true;
  }
  if (
    doc.mimeType?.includes('word') ||
    doc.fileName?.toLowerCase().endsWith('.docx') ||
    doc.fileName?.toLowerCase().endsWith('.doc')
  ) {
    return true;
  }
  return false;
}

export function DocumentCard({ document: doc, categories, onAction, layout = 'grid' }: DocumentCardProps) {
  const Icon = getFileIcon(doc.mimeType);
  const iconColor = getFileIconColor(doc.mimeType);
  const category = categories?.find((c) => c.id === doc.filesystemCategoryId);
  const showThumb = hasPossibleThumbnail(doc);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [thumbAspectStyle, setThumbAspectStyle] = useState<CSSProperties>({
    aspectRatio: '210 / 297',
  });

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      e.dataTransfer.setData('application/x-document-id', doc.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    [doc.id],
  );

  if (layout === 'list') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-slate-50 cursor-grab active:cursor-grabbing"
      >
        <Icon className={cn('h-5 w-5 shrink-0', iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{doc.fileName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">{formatFileSize(doc.fileSizeBytes)}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">{formatDate(doc.createdAt)}</span>
          </div>
        </div>
        {category && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {category.displayName}
          </Badge>
        )}
        <ContextMenu doc={doc} onAction={onAction} />
      </div>
    );
  }

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      className="group relative flex flex-col overflow-hidden transition-all hover:shadow-md cursor-grab active:cursor-grabbing p-0 gap-0"
    >
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <ContextMenu doc={doc} onAction={onAction} />
      </div>

      <div
        className="relative w-full overflow-hidden bg-slate-100"
        style={thumbAspectStyle}
      >
        {showThumb && !thumbFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getThumbSrc(doc)}
            alt={doc.fileName ?? 'Document thumbnail'}
            className="absolute inset-0 h-full w-full object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setThumbAspectStyle({
                  aspectRatio: `${img.naturalWidth} / ${img.naturalHeight}`,
                });
              }
            }}
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
            <Icon className={cn('h-10 w-10', iconColor)} />
            {showThumb && thumbFailed && (
              <span className="text-[11px]">Thumbnail unavailable</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        <p className="w-full truncate text-sm font-medium text-slate-900" title={doc.fileName}>
          {doc.fileName}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{formatFileSize(doc.fileSizeBytes)}</span>
          {category && (
            <Badge variant="secondary" className="text-xs">
              {category.displayName}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

function ContextMenu({
  doc,
  onAction,
}: {
  doc: FSDocument;
  onAction: (action: DocumentAction, id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-500 shadow-sm hover:bg-white hover:text-slate-700"
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onAction('download', doc.id)}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('move', doc.id)}>
          <FolderInput className="mr-2 h-4 w-4" />
          Move to Category
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('pipeline-history', doc.id)}>
          <Workflow className="mr-2 h-4 w-4" />
          Pipeline History
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAction('archive', doc.id)}>
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAction('delete', doc.id)}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
