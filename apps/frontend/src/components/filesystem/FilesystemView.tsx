'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { BookOpen, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilesystemBrowser, type CategorySelectContext } from './FilesystemBrowser';
import { PipelineRunHistoryDrawer } from './PipelineRunHistoryDrawer';
import { DocumentsToolbar } from '@/components/documents/DocumentsToolbar';
import { DocumentsGrid } from '@/components/documents/DocumentsGrid';
import { DocumentUploadDrawer } from '@/components/documents/DocumentUploadDrawer';
import { DocumentDropZone } from '@/components/documents/DocumentDropZone';
import { TablePagination } from '@/components/shared/table-pagination';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { EntityPageHeader } from '@/components/shared/EntityPageHeader';
import type {
  FSDocument,
  FilesystemCategory,
  FilesystemOverviewResponse,
  FilesystemResponse,
} from '@/lib/api-client';
import type { DocumentAction } from '@/components/documents/DocumentCard';
import type { Job, Claim, Journal } from '@/types/api';
import {
  assignCategoryAction,
  archiveDocumentAction,
  deleteDocumentAction,
} from '@/app/(app)/documents/actions';

const PAGE_SIZE = 24;


interface FilesystemViewProps {
  mode?: 'overview' | 'job' | 'single';
  initialFilesystem: FilesystemResponse | null;
  initialOverview?: FilesystemOverviewResponse | null;
  initialDocuments: FSDocument[];
  initialTotal: number;
  initialCategoryId?: string | null;
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function FilesystemView({
  mode = 'single',
  initialFilesystem,
  initialOverview = null,
  initialDocuments,
  initialTotal,
  initialCategoryId = null,
  job,
  parentClaim,
}: FilesystemViewProps) {
  const [filesystem] = useState<FilesystemResponse | null>(initialFilesystem);
  const [overview] = useState(initialOverview);
  const [documents, setDocuments] = useState<FSDocument[]>(initialDocuments);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialCategoryId,
  );
  /** Overview: filesystem/job for the selected folder (does not change header job). */
  const [scopeFilesystemId, setScopeFilesystemId] = useState<string | null>(
    initialCategoryId && mode === 'overview' ? (initialFilesystem?.id ?? null) : null,
  );
  const [scopeJobId, setScopeJobId] = useState<string | null>(null);
  const [loadedProjectCategories, setLoadedProjectCategories] = useState<FilesystemCategory[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [pipelineDoc, setPipelineDoc] = useState<FSDocument | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [documentCounts, setDocumentCounts] = useState<Record<string, number>>({});
  const [uncategorisedCount, setUncategorisedCount] = useState(0);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [journalDocuments, setJournalDocuments] = useState<FSDocument[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalLoadError, setJournalLoadError] = useState(false);
  const fetchRef = useRef(0);
  const journalFetchRef = useRef(0);

  const isJobMode = mode === 'job' || Boolean(job?.id);
  const isOverview = mode === 'overview';
  const filesystemId = filesystem?.id ?? null;
  const jobId = job?.id ?? null;
  const uploadFilesystemId = isOverview
    ? (scopeFilesystemId ?? filesystemId)
    : filesystemId;
  const uploadJobId = isOverview ? scopeJobId : jobId;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCounts = useCallback(async () => {
    const params = new URLSearchParams();
    if (isJobMode && jobId) {
      const projectFs = await fetch(`/api/filesystems/jobs/${jobId}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (projectFs?.id) params.set('filesystemId', projectFs.id);
    }
    try {
      const res = await fetch(`/api/documents/counts?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setDocumentCounts(data.counts ?? {});
      setUncategorisedCount(data.uncategorised ?? 0);
    } catch {
      /* silent */
    }
  }, [isJobMode, jobId]);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  const fetchDocuments = useCallback(async () => {
    const fetchId = ++fetchRef.current;
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedCategoryId === '__uncategorised') {
      params.set('uncategorised', 'true');
      if (isJobMode && jobId) {
        params.set('jobId', jobId);
      } else if (isOverview && scopeFilesystemId) {
        params.set('filesystemId', scopeFilesystemId);
      } else if (filesystemId && !isOverview) {
        params.set('filesystemId', filesystemId);
      }
    } else if (selectedCategoryId) {
      // Category ids are unique across filesystems. Do not also send filesystemId —
      // a stale job scope + company folder id returns an empty list.
      params.set('categoryId', selectedCategoryId);
    } else if (isJobMode && jobId) {
      params.set('jobId', jobId);
    } else if (filesystemId && !isOverview) {
      params.set('filesystemId', filesystemId);
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
  }, [
    page,
    debouncedSearch,
    selectedCategoryId,
    isJobMode,
    jobId,
    filesystemId,
    isOverview,
    scopeFilesystemId,
  ]);

  useEffect(() => {
    if (page === 1 && !debouncedSearch && selectedCategoryId === null) return;
    fetchDocuments();
  }, [fetchDocuments, page, debouncedSearch, selectedCategoryId, scopeFilesystemId]);

  const handleJournalSelect = useCallback(async (journal: Journal) => {
    const fetchId = ++journalFetchRef.current;
    setSelectedJournal(journal);
    setSelectedCategoryId(null);
    setJournalDocuments([]);
    setJournalLoading(true);
    setJournalLoadError(false);

    try {
      const params = new URLSearchParams();
      params.set('relatedRecordType', 'Journal');
      params.set('relatedRecordId', journal.id);
      params.set('limit', '200');

      const res = await fetch(`/api/documents?${params}`);
      if (!res.ok) throw new Error('Failed to load journal documents');
      const data = await res.json();

      if (journalFetchRef.current !== fetchId) return;
      setJournalDocuments(data.data ?? []);
    } catch (err) {
      if (journalFetchRef.current !== fetchId) return;
      console.error(
        'frontend:FilesystemView.handleJournalSelect - load documents failed:',
        err instanceof Error ? err.message : err,
      );
      setJournalLoadError(true);
      toast.error('Failed to load journal documents');
    } finally {
      if (journalFetchRef.current === fetchId) setJournalLoading(false);
    }
  }, []);

  const handleCategorySelect = (id: string | null, context?: CategorySelectContext) => {
    journalFetchRef.current += 1;
    setSelectedJournal(null);
    setJournalDocuments([]);
    setJournalLoading(false);
    setJournalLoadError(false);
    setSelectedCategoryId(id);
    setPage(1);
    if (!isOverview) return;
    if (id === null || id === '__uncategorised') {
      setScopeFilesystemId(null);
      setScopeJobId(null);
      return;
    }
    const known = [...(filesystem?.categories ?? []), ...loadedProjectCategories].find(
      (cat) => cat.id === id,
    );
    setScopeFilesystemId(
      known?.filesystemId ?? context?.filesystemId ?? filesystemId,
    );
    setScopeJobId(context?.jobId ?? null);
  };

  const handleProjectTreeLoaded = useCallback(
    (payload: { jobId: string; filesystemId: string; categories: FilesystemCategory[] }) => {
      setLoadedProjectCategories((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        for (const c of payload.categories) {
          byId.set(c.id, c);
        }
        return Array.from(byId.values());
      });
    },
    [],
  );

  const handleDocumentDropped = useCallback(
    async (documentId: string, categoryId: string | null) => {
      try {
        await assignCategoryAction(documentId, categoryId);
        toast.success('Document moved');
        fetchDocuments();
        fetchCounts();
      } catch {
        toast.error('Failed to move document');
      }
    },
    [fetchDocuments, fetchCounts],
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
            fetchCounts();
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
              fetchCounts();
            } catch {
              toast.error('Failed to delete document');
            }
          }
          break;
      }
    },
    [fetchDocuments, fetchCounts, documents],
  );

  const handleFilesDropped = useCallback((files: File[]) => {
    setUploadDrawerOpen(true);
    setTimeout(() => {
      const event = new CustomEvent('filesystem-upload-files', { detail: { files } });
      window.dispatchEvent(event);
    }, 100);
  }, []);

  const handleUploadComplete = useCallback(() => {
    fetchDocuments();
    fetchCounts();
  }, [fetchDocuments, fetchCounts]);

  const handleSetupProjectFs = useCallback(async () => {
    if (!jobId) return;
    setSetupBusy(true);
    try {
      const res = await fetch(`/api/filesystems/jobs/${jobId}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error('Setup failed');
      toast.success('Project document folders ready');
      window.location.reload();
    } catch {
      toast.error('Failed to set up project folders');
    } finally {
      setSetupBusy(false);
    }
  }, [jobId]);

  const companyCategories = filesystem?.categories ?? [];
  const categories = isOverview
    ? [...companyCategories, ...loadedProjectCategories]
    : companyCategories;
  const showSidebar = isOverview || companyCategories.length > 0;

  return (
    <DocumentDropZone
      onFilesDropped={
        selectedJournal
          ? () => toast.info('Add uploads from the journal page')
          : handleFilesDropped
      }
    >
      <SetPageHeader>
        <EntityPageHeader
          icon={FolderOpen}
          title="Documents"
          total={selectedJournal ? journalDocuments.length : total}
          showing={selectedJournal ? journalDocuments.length : documents.length}
          search={selectedJournal ? '' : debouncedSearch}
          accent="slate"
          job={job}
          parentClaim={parentClaim}
        />
      </SetPageHeader>
      <SetHeaderActions>
        {!selectedJournal && (
          <Button
            size="default"
            onClick={() => setUploadDrawerOpen(true)}
            className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            disabled={isJobMode && !filesystem}
          >
            Upload
          </Button>
        )}
      </SetHeaderActions>
      <div className="flex h-full min-h-0">
        {showSidebar && (
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 px-3 lg:block">
            <FilesystemBrowser
              categories={companyCategories}
              selectedCategoryId={selectedCategoryId}
              onCategorySelect={handleCategorySelect}
              onDocumentDropped={handleDocumentDropped}
              documentCounts={documentCounts}
              totalCount={total}
              uncategorisedCount={uncategorisedCount}
              showOverviewRoots={isOverview}
              overviewProjects={overview?.projects}
              companyFilesystemId={filesystemId}
              selectedJournalId={selectedJournal?.id}
              onJournalSelect={handleJournalSelect}
              onProjectTreeLoaded={handleProjectTreeLoaded}
            />
          </aside>
        )}

        <main className="flex flex-1 flex-col gap-4 overflow-hidden p-6">
          {selectedJournal ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
                <BookOpen className="h-5 w-5 shrink-0 text-violet-500" />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-900">
                    {selectedJournal.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {journalDocuments.length} upload
                    {journalDocuments.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <DocumentsToolbar
                search=""
                onSearch={() => {}}
                layout={layout}
                onLayoutChange={setLayout}
              />

              <div className="flex-1 overflow-y-auto">
                <DocumentsGrid
                  documents={journalDocuments}
                  categories={[]}
                  layout={layout}
                  isLoading={journalLoading}
                  onDocumentAction={handleDocumentAction}
                />
              </div>
            </>
          ) : isJobMode && !filesystem ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-slate-600">
                This job does not have a document filesystem yet.
              </p>
              <Button onClick={handleSetupProjectFs} disabled={setupBusy}>
                {setupBusy ? 'Setting up…' : 'Set up document folders'}
              </Button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </main>
      </div>

      <DocumentUploadDrawer
        open={uploadDrawerOpen}
        onOpenChange={setUploadDrawerOpen}
        categoryId={selectedCategoryId !== '__uncategorised' ? selectedCategoryId : null}
        filesystemId={uploadFilesystemId}
        jobId={uploadJobId}
        relatedRecordType={uploadJobId ? 'Job' : undefined}
        relatedRecordId={uploadJobId ?? undefined}
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
