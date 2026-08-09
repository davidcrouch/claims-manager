'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Folder, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { buildCategoryTree } from '@/components/filesystem/CategoryTreeEditor';
import type { FilesystemCategory, FilesystemCategoryNode } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export interface FolderTreeSection {
  label: string;
  categories: FilesystemCategory[];
}

interface FolderTreePickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  sections: FolderTreeSection[];
  selectedCategoryId: string | null;
  allowNone?: boolean;
  noneLabel?: string;
  onConfirm: (categoryId: string | null) => void;
}

export function FolderTreePickerDrawer({
  open,
  onOpenChange,
  title = 'Select folder',
  description = 'Choose a destination folder.',
  sections,
  selectedCategoryId,
  allowNone = false,
  noneLabel = 'Download to this computer',
  onConfirm,
}: FolderTreePickerDrawerProps) {
  const [draftId, setDraftId] = useState<string | null>(selectedCategoryId);

  useEffect(() => {
    if (open) setDraftId(selectedCategoryId);
  }, [open, selectedCategoryId]);

  const sectionTrees = useMemo(
    () =>
      sections.map((section) => ({
        label: section.label,
        tree: buildCategoryTree(section.categories.filter((cat) => !cat.archivedAt)),
      })),
    [sections],
  );

  const hasAnyFolders = sectionTrees.some((section) => section.tree.length > 0);

  const draftLabel = useMemo(() => {
    if (!draftId) return allowNone ? noneLabel : null;
    for (const section of sections) {
      const cat = section.categories.find((c) => c.id === draftId);
      if (cat) {
        return section.label ? `${section.label} / ${cat.displayName}` : cat.displayName;
      }
    }
    return null;
  }, [allowNone, draftId, noneLabel, sections]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      icon={<FolderOpen className="h-5 w-5" />}
      widthClassName="w-[60%]"
    >
      <BottomFormDrawerBody>
        <div className="mx-auto max-w-xl space-y-3">
          {allowNone && (
            <button
              type="button"
              onClick={() => setDraftId(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm',
                draftId === null
                  ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <Download className="h-4 w-4 shrink-0 text-slate-500" />
              <span className={draftId === null ? 'font-medium text-slate-900' : 'text-slate-700'}>
                {noneLabel}
              </span>
            </button>
          )}

          {!hasAnyFolders ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No folders found. Set up the company filesystem first.
            </p>
          ) : (
            sectionTrees.map((section) =>
              section.tree.length === 0 ? null : (
                <div key={section.label}>
                  <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                    {section.label}
                  </p>
                  <div className="rounded-md border border-slate-200 bg-white py-1">
                    {section.tree.map((node) => (
                      <FolderTreeNode
                        key={node.id ?? node.slug}
                        node={node}
                        depth={0}
                        selectedId={draftId}
                        onSelect={setDraftId}
                      />
                    ))}
                  </div>
                </div>
              ),
            )
          )}

          {draftLabel && (
            <p className="text-xs text-slate-500">
              Selected: <span className="font-medium text-slate-700">{draftLabel}</span>
            </p>
          )}
        </div>
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!allowNone && !draftId}
          className="bg-blue-600 text-white hover:bg-blue-500"
          onClick={() => {
            onConfirm(draftId);
            onOpenChange(false);
          }}
        >
          {draftId ? 'Use this folder' : noneLabel}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}

function FolderTreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: FilesystemCategoryNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(true);
  const id = node.id;
  const isSelected = Boolean(id && id === selectedId);

  return (
    <div>
      <div
        className={cn(
          'flex w-full items-center gap-1 py-1 pr-2 text-sm',
          isSelected ? 'bg-slate-100' : 'hover:bg-slate-50',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="flex h-5 w-5 shrink-0 items-center justify-center text-slate-400"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left"
          disabled={!id}
          onClick={() => {
            if (id) onSelect(id);
          }}
        >
          {isSelected || expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          )}
          <span className={cn('truncate', isSelected ? 'font-medium text-slate-900' : 'text-slate-700')}>
            {node.displayName}
          </span>
        </button>
      </div>
      {hasChildren && expanded &&
        node.children!.map((child) => (
          <FolderTreeNode
            key={child.id ?? child.slug}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}
