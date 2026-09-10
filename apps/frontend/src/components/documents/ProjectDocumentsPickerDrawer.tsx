'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { cn } from '@/lib/utils';
import type { FSDocument, FilesystemCategory } from '@/lib/api-client';

interface CategoryNode extends FilesystemCategory {
  children: CategoryNode[];
}

function buildTree(categories: FilesystemCategory[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }
  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentCategoryId && map.has(cat.parentCategoryId)) {
      map.get(cat.parentCategoryId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ProjectDocumentsPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  relatedRecordType: string;
  onConfirm: (params: {
    documentIds: string[];
    documentTypeExternalReference?: string;
  }) => Promise<void>;
  showDocumentTypeField?: boolean;
}

export function ProjectDocumentsPickerDrawer({
  open,
  onOpenChange,
  jobId,
  relatedRecordType,
  onConfirm,
  showDocumentTypeField = false,
}: ProjectDocumentsPickerDrawerProps) {
  const [loadingFs, setLoadingFs] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<FilesystemCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<FSDocument[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  const [documentTypeExternalReference, setDocumentTypeExternalReference] = useState('');

  const tree = useMemo(() => buildTree(categories.filter((c) => !c.archivedAt)), [categories]);
  const selectedCount = selectedDocumentIds.size;

  const loadFilesystem = useCallback(async () => {
    setLoadingFs(true);
    setError(null);
    try {
      const res = await fetch(`/api/filesystems/jobs/${jobId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.message === 'string' ? data.message : 'Failed to load project documents',
        );
      }
      setCategories(Array.isArray(data?.categories) ? data.categories : []);
      setSelectedCategoryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project documents');
      setCategories([]);
    } finally {
      setLoadingFs(false);
    }
  }, [jobId]);

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ jobId, limit: '100' });
      if (selectedCategoryId) sp.set('categoryId', selectedCategoryId);
      const res = await fetch(`/api/documents?${sp}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.message === 'string' ? data.message : 'Failed to load documents',
        );
      }
      setDocuments(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [jobId, selectedCategoryId]);

  useEffect(() => {
    if (!open) return;
    setSelectedDocumentIds(new Set());
    setDocumentTypeExternalReference('');
    void loadFilesystem();
  }, [open, loadFilesystem]);

  useEffect(() => {
    if (!open) return;
    void loadDocuments();
  }, [open, loadDocuments]);

  function toggleDocument(documentId: string) {
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedDocumentIds((prev) => {
      const next = new Set(prev);
      for (const doc of documents) next.add(doc.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedDocumentIds(new Set());
  }

  async function handleConfirm() {
    if (selectedCount === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        documentIds: Array.from(selectedDocumentIds),
        documentTypeExternalReference:
          showDocumentTypeField && documentTypeExternalReference.trim()
            ? documentTypeExternalReference.trim()
            : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach documents');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Attach from project documents"
      description={`Select one or more files from this job’s document repository to attach to the ${relatedRecordType.toLowerCase()}.`}
      icon={<Paperclip className="h-5 w-5" />}
      preventClose={submitting}
    >
      <BottomFormDrawerBody>
        {error && (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid min-h-[360px] gap-4 md:grid-cols-[240px_1fr]">
          <div className="rounded-md border border-border bg-muted/20 p-2">
            <button
              type="button"
              className={cn(
                'mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                selectedCategoryId === null ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
              onClick={() => setSelectedCategoryId(null)}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              All folders
            </button>
            {loadingFs ? (
              <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading folders…
              </div>
            ) : (
              <CategoryTreeList
                nodes={tree}
                selectedCategoryId={selectedCategoryId}
                onSelect={setSelectedCategoryId}
              />
            )}
          </div>

          <div className="min-h-0">
            {!loadingDocs && documents.length > 0 && (
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {selectedCount > 0
                    ? `${selectedCount} selected`
                    : `${documents.length} document${documents.length === 1 ? '' : 's'}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="hover:text-foreground hover:underline"
                    onClick={selectAllVisible}
                  >
                    Select all
                  </button>
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      className="hover:text-foreground hover:underline"
                      onClick={clearSelection}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
            {loadingDocs ? (
              <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading documents…
              </div>
            ) : documents.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                No documents in this folder
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {documents.map((doc) => {
                  const selected = selectedDocumentIds.has(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDocument(doc.id)}
                      className={cn(
                        'relative flex flex-col overflow-hidden rounded-lg border bg-white text-left transition-all',
                        selected
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-border hover:border-primary/40 hover:shadow-sm',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-slate-300 bg-white text-transparent',
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <div className="relative aspect-[210/297] w-full bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/documents/${doc.id}/thumbnail`}
                          alt={doc.fileName}
                          className="absolute inset-0 z-[1] h-full w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                          <FileText className="h-8 w-8" />
                        </div>
                      </div>
                      <div className="space-y-0.5 p-2">
                        <p className="truncate text-xs font-medium" title={doc.fileName}>
                          {doc.fileName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatFileSize(doc.fileSizeBytes)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {showDocumentTypeField && selectedCount > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="attach-doc-type">Document type (external reference)</Label>
              <Input
                id="attach-doc-type"
                value={documentTypeExternalReference}
                onChange={(e) => setDocumentTypeExternalReference(e.target.value)}
                placeholder='e.g. "Assessment Report"'
              />
            </div>
          </div>
        )}
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={() => void handleConfirm()} disabled={selectedCount === 0 || submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Attaching…
            </>
          ) : (
            <>
              <Paperclip className="mr-1.5 h-4 w-4" />
              {selectedCount > 1 ? `Attach ${selectedCount} Items` : 'Attach Item'}
            </>
          )}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}

function CategoryTreeList({
  nodes,
  selectedCategoryId,
  onSelect,
  depth = 0,
}: {
  nodes: CategoryNode[];
  selectedCategoryId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <CategoryTreeNode
          key={node.id}
          node={node}
          selectedCategoryId={selectedCategoryId}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </ul>
  );
}

function CategoryTreeNode({
  node,
  selectedCategoryId,
  onSelect,
  depth,
}: {
  node: CategoryNode;
  selectedCategoryId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const selected = selectedCategoryId === node.id;

  return (
    <li>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          type="button"
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-sm',
            selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
          )}
          onClick={() => onSelect(node.id)}
        >
          {selected || expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{node.displayName}</span>
        </button>
      </div>
      {hasChildren && expanded && (
        <CategoryTreeList
          nodes={node.children}
          selectedCategoryId={selectedCategoryId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      )}
    </li>
  );
}
