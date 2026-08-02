'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilesystemBrowser } from './FilesystemBrowser';
import { PipelineRunHistoryDrawer } from './PipelineRunHistoryDrawer';
import { DocumentsToolbar } from '@/components/documents/DocumentsToolbar';
import { DocumentsGrid } from '@/components/documents/DocumentsGrid';
import { DocumentUploadDrawer } from '@/components/documents/DocumentUploadDrawer';
import { DocumentDropZone } from '@/components/documents/DocumentDropZone';
import { TablePagination } from '@/components/shared/table-pagination';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import type { FSDocument, FilesystemResponse } from '@/lib/api-client';
import type { DocumentAction } from '@/components/documents/DocumentCard';
import {
  assignCategoryAction,
  archiveDocumentAction,
  deleteDocumentAction,
} from '@/app/(app)/documents/actions';

const PAGE_SIZE = 24;

interface FilesystemViewProps {
  initialFilesystem: FilesystemResponse | null;
  initialDocuments: FSDocument[];
  initialTotal: number;
}

export function FilesystemView({
  initialFilesystem,
  initialDocuments,
  initialTotal,
}: FilesystemViewProps) {
  const [filesystem] = useState<FilesystemResponse | null>(initialFilesystem);
  const [documents, setDocuments] = useState<FSDocument[]>(initialDocuments);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [pipelineDoc, setPipelineDoc] = useState<FSDocument | null>(null);
  const fetchRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchDocuments = useCallback(async () => {
    const fetchId = ++fetchRef.current;
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedCategoryId === '__uncategorised') {
      params.set('uncategorised', 'true');
    } else if (selectedCategoryId) {
      params.set('categoryId', selectedCategoryId);
    }

    try {
      const res = await fetch(`/api/documents?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      if (fetchRef.current !== fetchId) return;
      setDocuments(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      if (fetchRef.current === fetchId) {
        toast.error('Failed to load documents');
      }
    } finally {
      if (fetchRef.current === fetchId) {
        setLoading(false);
      }
    }
  }, [page, debouncedSearch, selectedCategoryId]);

  useEffect(() => {
    if (page === 1 && !debouncedSearch && selectedCategoryId === null) return;
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCategorySelect = (id: string | null) => {
    setSelectedCategoryId(id);
    setPage(1);
  };

  const handleDocumentDropped = useCallback(
    async (documentId: string, categoryId: string | null) => {
      try {
        await assignCategoryAction(documentId, categoryId);
        toast.success('Document moved');
        fetchDocuments();
      } catch {
        toast.error('Failed to move document');
      }
    },
    [fetchDocuments],
  );

  const handleDocumentAction = useCallback(
    async (action: DocumentAction, documentId: string) => {
      switch (action) {
        case 'download': {
          const res = await fetch(`/api/documents/${documentId}/download`);
          if (res.ok) {
            const { downloadUrl } = await res.json();
            window.open(downloadUrl, '_blank');
          } else {
            toast.error('Failed to get download URL');
          }
          break;
        }
        case 'move':
          toast.info('Drag the document to a category in the sidebar to move it');
          break;
        case 'pipeline-history': {
          const doc = documents.find((d) => d.id === documentId) ?? null;
          setPipelineDoc(doc);
          break;
        }
        case 'archive':
          try {
            await archiveDocumentAction(documentId);
            toast.success('Document archived');
            fetchDocuments();
          } catch {
            toast.error('Failed to archive document');
          }
          break;
        case 'delete':
          if (confirm('Permanently delete this document? This cannot be undone.')) {
            try {
              await deleteDocumentAction(documentId);
              toast.success('Document deleted');
              fetchDocuments();
            } catch {
              toast.error('Failed to delete document');
            }
          }
          break;
      }
    },
    [fetchDocuments, documents],
  );

  const handleFilesDropped = useCallback(
    (files: File[]) => {
      setUploadDrawerOpen(true);
      // Upload is handled by the drawer's internal hook once it receives the trigger
      // We need a small delay to ensure drawer is mounted
      setTimeout(() => {
        const event = new CustomEvent('filesystem-upload-files', { detail: { files } });
        window.dispatchEvent(event);
      }, 100);
    },
    [],
  );

  const handleUploadComplete = useCallback(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const categories = filesystem?.categories ?? [];

  return (
    <DocumentDropZone onFilesDropped={handleFilesDropped}>
      <SetPageHeader>
        <ListPageHeader
          icon={FolderOpen}
          title="Documents"
          total={total}
          showing={documents.length}
          search={debouncedSearch}
          accent="slate"
        />
      </SetPageHeader>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setUploadDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Upload
        </Button>
      </SetHeaderActions>
      <div className="flex h-full min-h-0">
        {categories.length > 0 && (
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 px-3 lg:block">
            <FilesystemBrowser
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onCategorySelect={handleCategorySelect}
              onDocumentDropped={handleDocumentDropped}
              totalCount={total}
            />
          </aside>
        )}

        <main className="flex flex-1 flex-col gap-4 overflow-hidden p-6">
          <DocumentsToolbar
            search={search}
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            layout={layout}
            onLayoutChange={setLayout}
          />

          <div className="flex-1 overflow-y-auto">
            <DocumentsGrid
              documents={documents}
              categories={categories}
              layout={layout}
              isLoading={loading}
              onDocumentAction={handleDocumentAction}
              onUpload={() => setUploadDrawerOpen(true)}
            />
          </div>

          {total > PAGE_SIZE && (
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          )}
        </main>
      </div>

      <DocumentUploadDrawer
        open={uploadDrawerOpen}
        onOpenChange={setUploadDrawerOpen}
        categoryId={selectedCategoryId !== '__uncategorised' ? selectedCategoryId : null}
        onComplete={handleUploadComplete}
      />

      {pipelineDoc && (
        <PipelineRunHistoryDrawer
          documentId={pipelineDoc.id}
          documentName={pipelineDoc.fileName}
          open={!!pipelineDoc}
          onOpenChange={(open) => {
            if (!open) setPipelineDoc(null);
          }}
        />
      )}
    </DocumentDropZone>
  );
}
