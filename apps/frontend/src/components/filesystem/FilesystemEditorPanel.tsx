'use client';

import { useState, useCallback } from 'react';
import { FolderOpen, Info } from 'lucide-react';
import {
  CategoryTreeEditor,
  CategoryConfigPanel,
  getNodeAtPathStatic,
  updateNodeAtPathStatic,
} from './CategoryTreeEditor';
import type { FilesystemCategoryNode } from '@/lib/api-client';

interface FilesystemEditorPanelProps {
  categories: FilesystemCategoryNode[];
  onCategoriesChange: (categories: FilesystemCategoryNode[]) => void;
  readOnly?: boolean;
  filesystemId?: string;
}

export function FilesystemEditorPanel({
  categories,
  onCategoriesChange,
  readOnly = false,
  filesystemId,
}: FilesystemEditorPanelProps) {
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);

  const selectedPathKey = selectedPath?.join(',') ?? null;

  const selectedNode = selectedPath
    ? getNodeAtPathStatic(categories, selectedPath)
    : null;

  const handleSelectNode = useCallback(
    (path: number[] | null) => {
      setSelectedPath(path);
    },
    [],
  );

  const handleUpdateSelected = useCallback(
    (updates: Partial<FilesystemCategoryNode>) => {
      if (!selectedPath) return;
      const next = updateNodeAtPathStatic(categories, selectedPath, (n) => ({
        ...n,
        ...updates,
      }));
      onCategoriesChange(next);
    },
    [selectedPath, categories, onCategoriesChange],
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Left panel: category tree */}
      <div className="flex w-[340px] shrink-0 flex-col border-r border-slate-200">
        <div className="border-b border-slate-200 px-4 py-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Category Tree
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <CategoryTreeEditor
            categories={categories}
            onCategoriesChange={onCategoriesChange}
            selectedPath={selectedPathKey}
            onSelectNode={(path) => handleSelectNode(path)}
            readOnly={readOnly}
          />
        </div>
      </div>

      {/* Right panel: category settings */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Category Settings
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {selectedNode ? (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-amber-500" />
                <span className="text-base font-medium text-slate-800">
                  {selectedNode.displayName}
                </span>
                {selectedNode.config?.color && (
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: selectedNode.config.color }}
                  />
                )}
              </div>
              <CategoryConfigPanel
                node={selectedNode}
                onUpdate={handleUpdateSelected}
                allCategories={categories}
                filesystemId={filesystemId}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Info className="mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">
                Select a category
              </p>
              <p className="mt-1 max-w-[14rem] text-xs text-slate-400">
                Click a category in the tree to configure its display name,
                description, slug, colour, and retention settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
