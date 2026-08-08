'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Files,
  FileQuestion,
  Building2,
  Briefcase,
  Loader2,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { FilesystemCategory, FilesystemOverviewProject } from '@/lib/api-client';
import type { Journal } from '@/types/api';

export interface CategorySelectContext {
  filesystemId?: string | null;
  jobId?: string | null;
  /** Categories for the filesystem that owns the selection (for grid labels). */
  categories?: FilesystemCategory[];
}

interface FilesystemBrowserProps {
  categories: FilesystemCategory[];
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null, context?: CategorySelectContext) => void;
  onDocumentDropped?: (documentId: string, categoryId: string | null) => void;
  documentCounts?: Record<string, number>;
  totalCount?: number;
  uncategorisedCount?: number;
  /** When set, shows Company + Projects roots above the company category tree. */
  overviewProjects?: FilesystemOverviewProject[];
  showOverviewRoots?: boolean;
  companyFilesystemId?: string | null;
  selectedJournalId?: string | null;
  onJournalSelect?: (journal: Journal) => void;
  /** Fired when a project tree is loaded so the parent can resolve category labels. */
  onProjectTreeLoaded?: (payload: {
    jobId: string;
    filesystemId: string;
    categories: FilesystemCategory[];
  }) => void;
}

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

function filterTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return nodes;

  return nodes.flatMap((node) => {
    if (node.displayName.toLocaleLowerCase().includes(normalized)) {
      return [node];
    }
    const matchingChildren = filterTree(node.children, normalized);
    return matchingChildren.length > 0
      ? [{ ...node, children: matchingChildren }]
      : [];
  });
}

function CategoryItem({
  node,
  depth,
  selectedId,
  onSelect,
  onDrop,
  documentCounts,
  forceExpanded = false,
}: {
  node: CategoryNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDrop?: (documentId: string, categoryId: string | null) => void;
  documentCounts?: Record<string, number>;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const count = documentCounts?.[node.id] ?? 0;
  const folderColor = node.config?.color?.trim() || null;
  const isExpanded = forceExpanded || expanded;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const documentId = e.dataTransfer.getData('application/x-document-id');
      if (documentId && onDrop) {
        onDrop(documentId, node.id);
      }
    },
    [node.id, onDrop],
  );

  return (
    <div>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-slate-700 hover:bg-slate-100',
          dragOver && 'ring-2 ring-primary/50 bg-primary/5',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {hasChildren ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          {isSelected ? (
            <FolderOpen
              className={cn('h-4 w-4 shrink-0', !folderColor && 'text-primary')}
              style={folderColor ? { color: folderColor } : undefined}
            />
          ) : (
            <Folder
              className={cn('h-4 w-4 shrink-0', !folderColor && 'text-slate-400')}
              style={folderColor ? { color: folderColor } : undefined}
            />
          )}
          <span className="truncate">{node.displayName}</span>
        </span>
        {count > 0 ? (
          <Badge variant="secondary" className="ml-auto shrink-0 text-xs px-1.5 py-0">
            {count}
          </Badge>
        ) : null}
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <CategoryItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDrop={onDrop}
              documentCounts={documentCounts}
              forceExpanded={forceExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JournalNode({
  journal,
  selected,
  onSelect,
}: {
  journal: Journal;
  selected: boolean;
  onSelect?: (journal: Journal) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors',
        selected
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-slate-700 hover:bg-slate-100',
      )}
      style={{ paddingLeft: '56px' }}
      onClick={() => onSelect?.(journal)}
    >
      <span className="w-4 shrink-0" />
      <BookOpen
        className={cn(
          'h-4 w-4 shrink-0',
          selected ? 'text-primary' : 'text-violet-500',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{journal.name}</span>
    </button>
  );
}

function JobJournalsNode({
  jobId,
  selectedJournalId,
  onJournalSelect,
}: {
  jobId: string;
  selectedJournalId?: string | null;
  onJournalSelect?: (journal: Journal) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const hasJournals = journals.length > 0;

  useEffect(() => {
    let cancelled = false;

    const loadJournals = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const allJournals: Journal[] = [];
        let page = 1;
        let total = 0;

        do {
          const res = await fetch(
            `/api/v1/journals?jobId=${encodeURIComponent(jobId)}&limit=100&page=${page}`,
          );
          if (!res.ok) throw new Error('Failed to load job journals');
          const payload = (await res.json()) as {
            data?: Journal[];
            total?: number;
          };
          const next = payload.data ?? [];
          allJournals.push(...next);
          total = payload.total ?? allJournals.length;
          page += 1;
          if (next.length === 0) break;
        } while (allJournals.length < total);

        if (!cancelled) {
          setJournals(allJournals);
          // Expand only when there are journals to show.
          setExpanded(allJournals.length > 0);
        }
      } catch (err) {
        console.error(
          'frontend:FilesystemBrowser.JobJournalsNode - loadJournals failed:',
          err instanceof Error ? err.message : err,
        );
        if (!cancelled) {
          setLoadError(true);
          setExpanded(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadJournals();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <div>
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
        style={{ paddingLeft: '40px' }}
        onClick={() => {
          if (!hasJournals) return;
          setExpanded((current) => !current);
        }}
        aria-expanded={hasJournals ? expanded : false}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          ) : hasJournals ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>
        {hasJournals && expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="min-w-0 flex-1 truncate">Journals</span>
        {hasJournals ? (
          <Badge variant="secondary" className="ml-auto shrink-0 px-1.5 py-0 text-xs">
            {journals.length}
          </Badge>
        ) : null}
      </button>

      {expanded &&
        (loadError ? (
          <p className="py-1.5 pr-2 text-xs text-red-500" style={{ paddingLeft: '56px' }}>
            Failed to load journals
          </p>
        ) : (
          journals.map((journal) => (
            <JournalNode
              key={journal.id}
              journal={journal}
              selected={selectedJournalId === journal.id}
              onSelect={onJournalSelect}
            />
          ))
        ))}
    </div>
  );
}

function ProjectJobNode({
  project,
  selectedId,
  onSelect,
  onDrop,
  documentCounts,
  onTreeLoaded,
  selectedJournalId,
  onJournalSelect,
  folderFilter,
}: {
  project: FilesystemOverviewProject;
  selectedId: string | null;
  onSelect: (id: string | null, context?: CategorySelectContext) => void;
  onDrop?: (documentId: string, categoryId: string | null) => void;
  documentCounts?: Record<string, number>;
  selectedJournalId?: string | null;
  onJournalSelect?: (journal: Journal) => void;
  folderFilter: string;
  onTreeLoaded?: (payload: {
    jobId: string;
    filesystemId: string;
    categories: FilesystemCategory[];
  }) => void;
}) {
  const initialCategories = project.filesystem?.categories ?? [];
  const [expanded, setExpanded] = useState(false);
  const [categories, setCategories] = useState<FilesystemCategory[]>(initialCategories);
  const [filesystemId, setFilesystemId] = useState<string | null>(
    project.filesystem?.id ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadingRef = useRef(false);
  // Overview never preloads category trees — always lazy-load on first expand.
  const loadedRef = useRef(false);

  const loadCategories = useCallback(async () => {
    if (loadedRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/filesystems/jobs/${project.jobId}`);
      if (!res.ok) throw new Error('Failed to load project folders');
      const data = await res.json();
      const next = (data.categories ?? []) as FilesystemCategory[];
      const nextFilesystemId = (data.id as string | undefined) ?? null;
      setCategories(next);
      if (nextFilesystemId) setFilesystemId(nextFilesystemId);
      loadedRef.current = true;
      if (nextFilesystemId) {
        onTreeLoaded?.({
          jobId: project.jobId,
          filesystemId: nextFilesystemId,
          categories: next,
        });
      }
    } catch (err) {
      console.error(
        'frontend:FilesystemBrowser.ProjectJobNode - loadCategories failed:',
        err instanceof Error ? err.message : err,
      );
      setLoadError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [onTreeLoaded, project.jobId]);

  const tree = filterTree(
    buildTree(categories.filter((c) => !c.archivedAt)),
    folderFilter,
  );

  const handleToggle = () => {
    setExpanded((v) => {
      const next = !v;
      if (next && !loadedRef.current) {
        void loadCategories();
      }
      return next;
    });
  };

  const handleCategorySelect = (id: string | null) => {
    onSelect(id, {
      filesystemId,
      jobId: project.jobId,
      categories,
    });
  };

  return (
    <div>
      <div
        className="flex w-full items-center rounded-md pr-1 text-sm text-slate-700 hover:bg-slate-100"
        style={{ paddingLeft: '24px' }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
          onClick={handleToggle}
          aria-expanded={expanded}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
            ) : expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
          {expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="min-w-0 flex-1 truncate">{project.jobLabel}</span>
        </button>
        <Link
          href={`/jobs/${project.jobId}`}
          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
          title={`Open ${project.jobLabel} home`}
          aria-label={`Open ${project.jobLabel} home`}
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      {expanded && (
        <div>
          {!folderFilter.trim() && (
            <JobJournalsNode
              jobId={project.jobId}
              selectedJournalId={selectedJournalId}
              onJournalSelect={onJournalSelect}
            />
          )}
          {loadError && (
            <p
              className="px-2 py-1.5 text-xs text-red-500"
              style={{ paddingLeft: '40px' }}
            >
              Failed to load folders
            </p>
          )}
          {!loading && !loadError && loadedRef.current && tree.length === 0 && (
            <p
              className="px-2 py-1.5 text-xs text-slate-400"
              style={{ paddingLeft: '40px' }}
            >
              {folderFilter.trim() ? 'No matching folders' : 'No folders'}
            </p>
          )}
          {tree.map((node) => (
            <CategoryItem
              key={node.id}
              node={node}
              depth={2}
              selectedId={selectedId}
              onSelect={handleCategorySelect}
              onDrop={onDrop}
              documentCounts={documentCounts}
              forceExpanded={Boolean(folderFilter.trim())}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SearchResultFs {
  id: string;
  kind: string;
  jobId: string | null;
  jobLabel: string | null;
}

interface SearchResult {
  matches: FilesystemCategory[];
  ancestors: FilesystemCategory[];
  filesystems: SearchResultFs[];
  projects: FilesystemOverviewProject[];
}

function SearchResultsView({
  result,
  selectedCategoryId,
  onCategorySelect,
  onDocumentDropped,
  documentCounts,
  selectedJournalId,
  onJournalSelect,
  onProjectTreeLoaded,
}: {
  result: SearchResult;
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null, context?: CategorySelectContext) => void;
  onDocumentDropped?: (documentId: string, categoryId: string | null) => void;
  documentCounts?: Record<string, number>;
  selectedJournalId?: string | null;
  onJournalSelect?: (journal: Journal) => void;
  onProjectTreeLoaded?: (payload: {
    jobId: string;
    filesystemId: string;
    categories: FilesystemCategory[];
  }) => void;
}) {
  const allCategories = useMemo(
    () => [...result.matches, ...result.ancestors],
    [result.matches, result.ancestors],
  );

  const grouped = useMemo(() => {
    const byFs = new Map<string, FilesystemCategory[]>();
    for (const cat of allCategories) {
      const list = byFs.get(cat.filesystemId) || [];
      list.push(cat);
      byFs.set(cat.filesystemId, list);
    }
    return byFs;
  }, [allCategories]);

  if (result.matches.length === 0 && result.projects.length === 0) {
    return (
      <p className="px-2 py-3 text-center text-xs text-slate-400">
        No matching folders
      </p>
    );
  }

  return (
    <>
      {result.projects.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-500">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span>Projects</span>
          </div>
          {result.projects.map((project) => (
            <ProjectJobNode
              key={project.jobId}
              project={project}
              selectedId={selectedCategoryId}
              onSelect={onCategorySelect}
              onDrop={onDocumentDropped}
              documentCounts={documentCounts}
              selectedJournalId={selectedJournalId}
              onJournalSelect={onJournalSelect}
              folderFilter=""
              onTreeLoaded={onProjectTreeLoaded}
            />
          ))}
        </div>
      )}
      {result.filesystems
        .filter((fs) => grouped.has(fs.id))
        .map((fs) => {
          const fsCats = grouped.get(fs.id)!;
          const tree = filterTree(buildTree(fsCats), '');
          const label = fs.kind === 'company' ? 'Company' : (fs.jobLabel ?? 'Project');
          const Icon = fs.kind === 'company' ? Building2 : Briefcase;

          const handleSelect = (id: string | null) => {
            onCategorySelect(id, {
              filesystemId: fs.id,
              jobId: fs.jobId,
              categories: fsCats,
            });
          };

          return (
            <div key={fs.id}>
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-500">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </div>
              {tree.map((node) => (
                <CategoryItem
                  key={node.id}
                  node={node}
                  depth={1}
                  selectedId={selectedCategoryId}
                  onSelect={handleSelect}
                  documentCounts={{}}
                  forceExpanded
                />
              ))}
            </div>
          );
        })}
    </>
  );
}

export function FilesystemBrowser({
  categories,
  selectedCategoryId,
  onCategorySelect,
  onDocumentDropped,
  documentCounts,
  totalCount,
  uncategorisedCount,
  overviewProjects,
  showOverviewRoots,
  companyFilesystemId,
  selectedJournalId,
  onJournalSelect,
  onProjectTreeLoaded,
}: FilesystemBrowserProps) {
  const [folderFilter, setFolderFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [searchResponse, setSearchResponse] = useState<{
    query: string;
    result: SearchResult | null;
  } | null>(null);
  const searchRef = useRef(0);

  const tree = buildTree(categories.filter((c) => !c.archivedAt));
  const [companyOpen, setCompanyOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const activeQuery = debouncedFilter.trim();
  const isSearching = Boolean(activeQuery);
  const searchLoading =
    isSearching && searchResponse?.query !== activeQuery;
  const searchResult =
    searchResponse?.query === activeQuery ? searchResponse.result : null;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(folderFilter), 300);
    return () => clearTimeout(t);
  }, [folderFilter]);

  useEffect(() => {
    const query = debouncedFilter.trim();
    if (!query) return;
    const fetchId = ++searchRef.current;

    fetch(`/api/filesystems/categories/search?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SearchResult | null) => {
        if (searchRef.current !== fetchId) return;
        setSearchResponse({ query, result: data });
      })
      .catch(() => {
        if (searchRef.current === fetchId) {
          setSearchResponse({ query, result: null });
        }
      });
  }, [debouncedFilter]);

  const handleUncategorisedDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const documentId = e.dataTransfer.getData('application/x-document-id');
      if (documentId && onDocumentDropped) {
        onDocumentDropped(documentId, null);
      }
    },
    [onDocumentDropped],
  );

  const selectCompanyCategory = useCallback(
    (id: string | null) => {
      onCategorySelect(id, {
        filesystemId: companyFilesystemId ?? null,
        jobId: null,
        categories,
      });
    },
    [categories, companyFilesystemId, onCategorySelect],
  );

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={folderFilter}
          onChange={(event) => setFolderFilter(event.target.value)}
          placeholder="Search folders"
          aria-label="Search folders"
          className="h-8 w-full rounded-md border border-slate-200 bg-white py-1 pl-8 pr-8 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {folderFilter && (
          <button
            type="button"
            onClick={() => setFolderFilter('')}
            className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Clear folder search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isSearching ? (
        searchLoading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        ) : searchResult ? (
          <SearchResultsView
            result={searchResult}
            selectedCategoryId={selectedCategoryId}
            onCategorySelect={onCategorySelect}
            onDocumentDropped={onDocumentDropped}
            documentCounts={documentCounts}
            selectedJournalId={selectedJournalId}
            onJournalSelect={onJournalSelect}
            onProjectTreeLoaded={onProjectTreeLoaded}
          />
        ) : (
          <p className="px-2 py-3 text-center text-xs text-slate-400">
            No matching folders
          </p>
        )
      ) : (
        <>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              selectedCategoryId === null && !selectedJournalId
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-slate-700 hover:bg-slate-100',
            )}
            onClick={() => onCategorySelect(null)}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="w-4 shrink-0" />
              <Files className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">All Documents</span>
            </span>
            {totalCount != null && totalCount > 0 ? (
              <Badge variant="secondary" className="ml-auto shrink-0 text-xs px-1.5 py-0">
                {totalCount}
              </Badge>
            ) : null}
          </button>

          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
              selectedCategoryId === '__uncategorised'
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-slate-700 hover:bg-slate-100',
            )}
            onClick={() => onCategorySelect('__uncategorised')}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={handleUncategorisedDrop}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="w-4 shrink-0" />
              <FileQuestion className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">Uncategorised</span>
            </span>
            {uncategorisedCount != null && uncategorisedCount > 0 ? (
              <Badge variant="secondary" className="ml-auto shrink-0 text-xs px-1.5 py-0">
                {uncategorisedCount}
              </Badge>
            ) : null}
          </button>

          {(tree.length > 0 || showOverviewRoots) && (
            <div className="my-1 border-t border-slate-200" />
          )}

          {showOverviewRoots ? (
            <>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
                onClick={() => setCompanyOpen((v) => !v)}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {companyOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 truncate">Company</span>
              </button>
              {companyOpen &&
                tree.map((node) => (
                  <CategoryItem
                    key={node.id}
                    node={node}
                    depth={1}
                    selectedId={selectedCategoryId}
                    onSelect={selectCompanyCategory}
                    onDrop={onDocumentDropped}
                    documentCounts={documentCounts}
                  />
                ))}

              <button
                type="button"
                className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-100"
                onClick={() => setProjectsOpen((v) => !v)}
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {projectsOpen ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
                <Briefcase className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 truncate">Projects</span>
                {overviewProjects && overviewProjects.length > 0 ? (
                  <Badge variant="secondary" className="ml-auto shrink-0 text-xs px-1.5 py-0">
                    {overviewProjects.length}
                  </Badge>
                ) : null}
              </button>
              {projectsOpen &&
                (overviewProjects?.length ? (
                  overviewProjects.map((p) => (
                    <ProjectJobNode
                      key={p.jobId}
                      project={p}
                      selectedId={selectedCategoryId}
                      onSelect={onCategorySelect}
                      onDrop={onDocumentDropped}
                      documentCounts={documentCounts}
                      selectedJournalId={selectedJournalId}
                      onJournalSelect={onJournalSelect}
                      folderFilter=""
                      onTreeLoaded={onProjectTreeLoaded}
                    />
                  ))
                ) : (
                  <p className="px-2 py-1.5 text-xs text-slate-400" style={{ paddingLeft: '24px' }}>
                    No jobs yet
                  </p>
                ))}
            </>
          ) : (
            tree.map((node) => (
              <CategoryItem
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedCategoryId}
                onSelect={onCategorySelect}
                onDrop={onDocumentDropped}
                documentCounts={documentCounts}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
