'use client';

import { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Files,
  FileQuestion,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { FilesystemCategory } from '@/lib/api-client';

interface FilesystemBrowserProps {
  categories: FilesystemCategory[];
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null) => void;
  onDocumentDropped?: (documentId: string, categoryId: string | null) => void;
  documentCounts?: Record<string, number>;
  totalCount?: number;
  uncategorisedCount?: number;
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

function CategoryItem({
  node,
  depth,
  selectedId,
  onSelect,
  onDrop,
  documentCounts,
}: {
  node: CategoryNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDrop?: (documentId: string, categoryId: string | null) => void;
  documentCounts?: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;
  const count = documentCounts?.[node.id] ?? 0;

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
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex h-4 w-4 items-center justify-center"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}
        {isSelected ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="truncate flex-1">{node.displayName}</span>
        {count > 0 && (
          <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
            {count}
          </Badge>
        )}
      </button>
      {hasChildren && expanded && (
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
            />
          ))}
        </div>
      )}
    </div>
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
}: FilesystemBrowserProps) {
  const tree = buildTree(categories.filter((c) => !c.archivedAt));

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

  return (
    <div className="flex flex-col gap-1 py-2">
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          selectedCategoryId === null && selectedCategoryId !== undefined
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-slate-700 hover:bg-slate-100',
        )}
        onClick={() => onCategorySelect(null)}
      >
        <span className="w-4" />
        <Files className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1">All Documents</span>
        {totalCount != null && totalCount > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {totalCount}
          </Badge>
        )}
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
        <span className="w-4" />
        <FileQuestion className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1">Uncategorised</span>
        {uncategorisedCount != null && uncategorisedCount > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">
            {uncategorisedCount}
          </Badge>
        )}
      </button>

      {tree.length > 0 && (
        <div className="my-1 border-t border-slate-200" />
      )}

      {tree.map((node) => (
        <CategoryItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedCategoryId}
          onSelect={onCategorySelect}
          onDrop={onDocumentDropped}
          documentCounts={documentCounts}
        />
      ))}
    </div>
  );
}
