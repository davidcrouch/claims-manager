'use client';

import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentCard, type DocumentAction } from './DocumentCard';
import type { FSDocument, FilesystemCategory } from '@/lib/api-client';

interface DocumentsGridProps {
  documents: FSDocument[];
  categories?: FilesystemCategory[];
  layout: 'grid' | 'list';
  isLoading: boolean;
  onDocumentAction: (action: DocumentAction, documentId: string) => void;
  onUpload?: () => void;
}

function GridSkeleton({ layout }: { layout: 'grid' | 'list' }) {
  if (layout === 'list') {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function DocumentsGrid({
  documents,
  categories,
  layout,
  isLoading,
  onDocumentAction,
  onUpload,
}: DocumentsGridProps) {
  if (isLoading) {
    return <GridSkeleton layout={layout} />;
  }

  if (documents.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
            <Upload className="h-6 w-6 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">No documents yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload files to get started
            </p>
          </div>
          {onUpload && (
            <Button variant="outline" size="sm" onClick={onUpload} className="mt-2">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload Files
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (layout === 'list') {
    return (
      <div className="space-y-2">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            categories={categories}
            onAction={onDocumentAction}
            layout="list"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          categories={categories}
          onAction={onDocumentAction}
          layout="grid"
        />
      ))}
    </div>
  );
}
