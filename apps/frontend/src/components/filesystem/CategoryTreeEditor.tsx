'use client';

import { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
  GripVertical,
  Plus,
  Palette,
  Clock,
  Sparkles,
  Loader2,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  FilesystemCategoryNode,
  CategoryConfig,
  FlatCategoryUpsert,
} from '@/lib/api-client';
import { PipelineEditorPanel } from './PipelineEditorPanel';

export const DEFAULT_CATEGORY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export interface CategoryTreeEditorProps {
  categories: FilesystemCategoryNode[];
  onCategoriesChange: (categories: FilesystemCategoryNode[]) => void;
  /** When set, clicking a node calls this instead of opening an inline panel. */
  selectedPath?: string | null;
  onSelectNode?: (path: number[] | null, node: FilesystemCategoryNode | null) => void;
  readOnly?: boolean;
}

export function slugify(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isAutoSlug(slug: string, displayName: string): boolean {
  return slug === slugify(displayName) || /^NEW_CATEGORY_\d+$/.test(slug);
}

export function getNodeAtPathStatic(
  categories: FilesystemCategoryNode[],
  path: number[],
): FilesystemCategoryNode | null {
  let nodes = categories;
  for (let i = 0; i < path.length - 1; i++) {
    const node = nodes[path[i]];
    if (!node) return null;
    nodes = node.children ?? [];
  }
  return nodes[path[path.length - 1]] ?? null;
}

export function updateNodeAtPathStatic(
  categories: FilesystemCategoryNode[],
  path: number[],
  updater: (node: FilesystemCategoryNode) => FilesystemCategoryNode,
): FilesystemCategoryNode[] {
  const updateRecursive = (
    nodes: FilesystemCategoryNode[],
    pathIdx: number,
  ): FilesystemCategoryNode[] => {
    return nodes.map((node, idx) => {
      if (idx !== path[pathIdx]) return node;
      if (pathIdx === path.length - 1) return updater(node);
      return {
        ...node,
        children: updateRecursive(node.children ?? [], pathIdx + 1),
      };
    });
  };
  return updateRecursive(categories, 0);
}

/**
 * Builds a nested `FilesystemCategoryNode[]` tree from a flat list of categories
 * (as returned by the filesystem/template APIs, keyed by `parentCategoryId`).
 */
export function buildCategoryTree(
  flat: Array<{
    id: string;
    parentCategoryId: string | null;
    displayName: string;
    description?: string | null;
    slug: string;
    config?: CategoryConfig | Record<string, unknown>;
    sortOrder: number;
  }>,
): FilesystemCategoryNode[] {
  const nodeMap = new Map<string, FilesystemCategoryNode>();
  for (const cat of flat) {
    nodeMap.set(cat.id, {
      id: cat.id,
      parentCategoryId: cat.parentCategoryId,
      displayName: cat.displayName,
      description: cat.description ?? null,
      slug: cat.slug,
      config: (cat.config as CategoryConfig) ?? {},
      sortOrder: cat.sortOrder,
      children: [],
    });
  }

  const roots: FilesystemCategoryNode[] = [];
  for (const cat of flat) {
    const node = nodeMap.get(cat.id)!;
    if (cat.parentCategoryId && nodeMap.has(cat.parentCategoryId)) {
      nodeMap.get(cat.parentCategoryId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (nodes: FilesystemCategoryNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const n of nodes) {
      if (n.children?.length) sortTree(n.children);
    }
  };
  sortTree(roots);

  return roots;
}

/**
 * Flattens a nested `FilesystemCategoryNode[]` tree into the flat array expected
 * by the bulk-upsert (PUT .../categories) endpoints. New nodes (without a real id)
 * are assigned a fresh UUID here; parents are always pushed before their children
 * so the backend can insert self-referencing rows in a single statement.
 */
export function flattenCategoryTree(
  nodes: FilesystemCategoryNode[],
  parentCategoryId: string | null = null,
): FlatCategoryUpsert[] {
  const result: FlatCategoryUpsert[] = [];
  nodes.forEach((node, index) => {
    const id = node.id ?? crypto.randomUUID();
    result.push({
      id,
      parentCategoryId,
      displayName: node.displayName,
      description: node.description ?? null,
      slug: node.slug,
      config: node.config ?? {},
      sortOrder: node.sortOrder ?? index,
    });
    if (node.children?.length) {
      result.push(...flattenCategoryTree(node.children, id));
    }
  });
  return result;
}

export function CategoryTreeEditor({
  categories,
  onCategoriesChange,
  selectedPath: externalSelectedPath,
  onSelectNode,
  readOnly = false,
}: CategoryTreeEditorProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    const collectExpanded = (nodes: FilesystemCategoryNode[]) => {
      for (const n of nodes) {
        if (n.children?.length) {
          const nodeId = n.id ?? n.slug;
          ids.add(nodeId);
          collectExpanded(n.children);
        }
      }
    };
    collectExpanded(categories);
    return ids;
  });
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const isExternalSelection = onSelectNode !== undefined;

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updateNodeAtPath = useCallback(
    (
      path: number[],
      updater: (node: FilesystemCategoryNode) => FilesystemCategoryNode,
    ) => {
      onCategoriesChange(updateNodeAtPathStatic(categories, path, updater));
    },
    [categories, onCategoriesChange],
  );

  const addChild = useCallback(
    (parentPath: number[]) => {
      const parentNode = getNodeAtPathStatic(categories, parentPath);
      const parentId = parentNode?.id ?? `node-${parentPath.join('-')}`;

      setExpanded((prev) => new Set([...prev, parentId]));

      updateNodeAtPath(parentPath, (node) => ({
        ...node,
        children: [
          ...(node.children ?? []),
          {
            displayName: 'New Category',
            slug: `NEW_CATEGORY_${Date.now()}`,
            sortOrder: (node.children?.length ?? 0),
            config: {},
            children: [],
          },
        ],
      }));
    },
    [categories, updateNodeAtPath],
  );

  const addRoot = useCallback(() => {
    onCategoriesChange([
      ...categories,
      {
        displayName: 'New Category',
        slug: `NEW_CATEGORY_${Date.now()}`,
        sortOrder: categories.length,
        config: {},
        children: [],
      },
    ]);
  }, [categories, onCategoriesChange]);

  const removeNodeAtPath = useCallback(
    (path: number[]) => {
      const pathKey = path.join(',');
      const removeRecursive = (
        nodes: FilesystemCategoryNode[],
        pathIdx: number,
      ): FilesystemCategoryNode[] => {
        if (pathIdx === path.length - 1) {
          return nodes.filter((_, idx) => idx !== path[pathIdx]);
        }
        return nodes.map((node, idx) => {
          if (idx !== path[pathIdx]) return node;
          return {
            ...node,
            children: removeRecursive(node.children ?? [], pathIdx + 1),
          };
        });
      };
      onCategoriesChange(removeRecursive(categories, 0));
      if (externalSelectedPath === pathKey) {
        onSelectNode?.(null, null);
      }
    },
    [categories, onCategoriesChange, externalSelectedPath, onSelectNode],
  );

  const handleNodeClick = useCallback(
    (path: number[], node: FilesystemCategoryNode) => {
      if (readOnly) return;
      const pathKey = path.join(',');
      if (isExternalSelection) {
        onSelectNode?.(
          externalSelectedPath === pathKey ? null : path,
          externalSelectedPath === pathKey ? null : node,
        );
      }
    },
    [readOnly, isExternalSelection, externalSelectedPath, onSelectNode],
  );

  const renderNode = (
    node: FilesystemCategoryNode,
    path: number[],
    depth: number,
  ) => {
    const nodeId = node.id ?? `node-${path.join('-')}`;
    const pathKey = path.join(',');
    const isExpanded = expanded.has(nodeId);
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isSelected = externalSelectedPath === pathKey;
    const isRenaming = renamingPath === pathKey;
    const config = node.config ?? {};

    return (
      <div key={nodeId}>
        <div
          className={cn(
            'group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors',
            !readOnly && 'cursor-pointer hover:bg-slate-100',
            depth > 0 && 'ml-5',
            isSelected && 'bg-blue-50 ring-1 ring-blue-200',
          )}
          onClick={() => handleNodeClick(path, node)}
        >
          {!readOnly && (
            <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-300 opacity-0 group-hover:opacity-100" />
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(nodeId);
            }}
            className="flex shrink-0 items-center"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )
            ) : (
              <span className="w-4" />
            )}
          </button>

          {config.color && (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: config.color }}
            />
          )}

          <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />

          {isRenaming ? (
            <Input
              autoFocus
              defaultValue={node.displayName}
              className="h-6 w-40 px-1.5 py-0 text-sm"
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val) {
                  updateNodeAtPath(path, (n) => ({
                    ...n,
                    displayName: val,
                    slug: isAutoSlug(n.slug, n.displayName) ? slugify(val) : n.slug,
                  }));
                }
                setRenamingPath(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRenamingPath(null);
              }}
            />
          ) : (
            <span
              className={cn(
                'truncate text-sm font-medium text-slate-800',
                isSelected && 'text-blue-900',
              )}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!readOnly) setRenamingPath(pathKey);
              }}
            >
              {node.displayName}
            </span>
          )}

          {config.retentionDays && (
            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
              {config.retentionDays}d
            </span>
          )}

          {!readOnly && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setRenamingPath(pathKey); }}
                className="rounded p-0.5 hover:bg-slate-200"
                title="Rename"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); addChild(path); }}
                className="rounded p-0.5 hover:bg-slate-200"
                title="Add child"
              >
                <FolderPlus className="h-3.5 w-3.5 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeNodeAtPath(path); }}
                className="rounded p-0.5 hover:bg-slate-200"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          )}
        </div>

        {isExpanded &&
          node.children?.map((child, childIdx) =>
            renderNode(child, [...path, childIdx], depth + 1),
          )}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      {categories.map((node, idx) => renderNode(node, [idx], 0))}

      {!readOnly && (
        <button
          type="button"
          onClick={addRoot}
          className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <Plus className="h-4 w-4" />
          Add root category
        </button>
      )}
    </div>
  );
}

// ── Standalone category settings panel (used in right panel of split layout) ──

function collectAllCategories(
  nodes: FilesystemCategoryNode[],
  exclude?: string,
): Array<{ name: string; description: string | null }> {
  const result: Array<{ name: string; description: string | null }> = [];
  const walk = (items: FilesystemCategoryNode[]) => {
    for (const item of items) {
      if (item.slug !== exclude) {
        result.push({ name: item.displayName, description: item.description ?? null });
      }
      if (item.children?.length) walk(item.children);
    }
  };
  walk(nodes);
  return result;
}

export function CategoryConfigPanel({
  node,
  onUpdate,
  variant = 'light',
  allCategories,
  filesystemId,
}: {
  node: FilesystemCategoryNode;
  onUpdate: (updates: Partial<FilesystemCategoryNode>) => void;
  variant?: 'light' | 'dark';
  allCategories?: FilesystemCategoryNode[];
  filesystemId?: string;
}) {
  const config = node.config ?? {};
  const isDark = variant === 'dark';
  const [generating, setGenerating] = useState(false);

  const handleGenerateDescription = useCallback(async () => {
    if (!allCategories) return;
    setGenerating(true);
    try {
      const siblings = collectAllCategories(allCategories, node.slug);
      const res = await fetch('/api/filesystems/generate-category-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryName: node.displayName,
          siblingCategories: siblings,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate description');
      const result = await res.json();
      if (result.description) {
        onUpdate({ description: result.description });
      }
    } catch (err) {
      console.error('[CategoryConfigPanel.handleGenerateDescription] failed:', err);
    } finally {
      setGenerating(false);
    }
  }, [allCategories, node.slug, node.displayName, onUpdate]);

  const updateConfig = (patch: Partial<CategoryConfig>) => {
    onUpdate({ config: { ...config, ...patch } });
  };

  const labelCls = isDark ? 'text-xs text-white/70' : 'text-xs text-slate-600';
  const inputCls = isDark
    ? 'mt-0.5 h-8 border-white/20 bg-white/10 text-white text-sm'
    : 'mt-0.5 h-8 text-sm';
  const textareaCls = isDark
    ? 'mt-0.5 border-white/20 bg-white/10 text-white text-sm'
    : 'mt-0.5 text-sm';
  const sublabelCls = isDark ? 'text-white/40' : 'text-slate-400';

  const canGenerate = !!allCategories;

  const handleDisplayNameBlur = useCallback(() => {
    if (isAutoSlug(node.slug, node.displayName)) {
      onUpdate({ slug: slugify(node.displayName) });
    }
    if (
      canGenerate &&
      !generating &&
      !node.description &&
      node.displayName.trim() &&
      node.displayName !== 'New Category'
    ) {
      handleGenerateDescription();
    }
  }, [canGenerate, generating, node.slug, node.displayName, node.description, onUpdate, handleGenerateDescription]);

  return (
    <div className="space-y-4">
      <div>
        <Label className={labelCls}>Display Name</Label>
        <Input
          value={node.displayName}
          onChange={(e) => onUpdate({ displayName: e.target.value })}
          onBlur={handleDisplayNameBlur}
          placeholder="e.g. Scope of Works"
          className={inputCls}
        />
        <p className={cn('mt-0.5 text-[11px]', sublabelCls)}>
          Short folder name shown in the UI
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className={labelCls}>
            Description
          </Label>
          {canGenerate && (
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={generating}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                isDark
                  ? 'text-purple-300 hover:bg-purple-500/20 disabled:text-white/30'
                  : 'text-purple-600 hover:bg-purple-50 disabled:text-slate-300',
              )}
              title="Generate description using AI"
            >
              {generating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {generating ? 'Generating…' : 'AI Generate'}
            </button>
          )}
        </div>
        <Textarea
          value={node.description ?? ''}
          onChange={(e) => onUpdate({ description: e.target.value || null })}
          rows={3}
          placeholder="Describe what documents belong in this category. This is passed to the AI for auto-classification..."
          className={textareaCls}
        />
        <p className={cn('mt-0.5 text-[11px]', sublabelCls)}>
          Used by the AI to decide where to file documents
        </p>
      </div>

      <div>
        <Label className={labelCls}>Slug</Label>
        <Input
          value={node.slug}
          onChange={(e) => onUpdate({ slug: e.target.value })}
          className={inputCls}
        />
        <p className={cn('mt-0.5 text-[11px]', sublabelCls)}>
          Machine-friendly identifier passed to LLMs
        </p>
      </div>

      <div>
        <Label className={labelCls}>
          <Palette className="mr-1 inline h-3 w-3" />
          Colour
        </Label>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {DEFAULT_CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateConfig({ color: c })}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform',
                config.color === c
                  ? isDark ? 'scale-110 border-white' : 'scale-110 border-slate-700'
                  : 'border-transparent hover:scale-105',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          {config.color && (
            <button
              type="button"
              onClick={() => updateConfig({ color: null })}
              className={cn('text-[10px]', isDark ? 'text-white/40 hover:text-white/60' : 'text-slate-400 hover:text-slate-600')}
            >
              clear
            </button>
          )}
        </div>
      </div>

      <div>
        <Label className={labelCls}>
          <Clock className="mr-1 inline h-3 w-3" />
          Retention Period (days)
        </Label>
        <Input
          type="number"
          value={config.retentionDays?.toString() ?? ''}
          onChange={(e) =>
            updateConfig({
              retentionDays: e.target.value ? parseInt(e.target.value, 10) : null,
            })
          }
          placeholder="No limit"
          className={cn(inputCls, 'w-32')}
        />
        <p className={cn('mt-0.5 text-[11px]', sublabelCls)}>
          Auto-delete documents after this many days
        </p>
      </div>

      <div>
        <Label className={cn(labelCls, 'flex items-center gap-1')}>
          <Workflow className="h-3 w-3" />
          Filesystem upload pipelines
        </Label>
        <label className={cn('mt-1.5 flex items-start gap-2 text-sm', isDark ? 'text-white/80' : 'text-slate-700')}>
          <input
            type="checkbox"
            className="mt-1"
            checked={config.runFilesystemPipelinesOnUpload === true}
            onChange={(e) =>
              updateConfig({ runFilesystemPipelinesOnUpload: e.target.checked ? true : false })
            }
          />
          <span>
            Run filesystem-level pipelines (e.g. Document Classifier) for files already in this
            folder
          </span>
        </label>
        <p className={cn('mt-0.5 text-[11px]', sublabelCls)}>
          Off by default — an explicit folder is treated as already filed. Category-specific
          pipelines below still run.
        </p>
      </div>

      {filesystemId && node.id && (
        <div className="border-t border-slate-200 pt-4">
          <PipelineEditorPanel filesystemId={filesystemId} categoryId={node.id} />
        </div>
      )}
    </div>
  );
}
