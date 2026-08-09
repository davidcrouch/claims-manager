'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildCategoryTree } from '@/components/filesystem/CategoryTreeEditor';
import type { FilesystemCategory, FilesystemCategoryNode } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface TemplatesFolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FilesystemCategory[];
  selectedCategoryId: string | null;
  onConfirm: (categoryId: string) => void;
}

export function TemplatesFolderPickerDialog({
  open,
  onOpenChange,
  categories,
  selectedCategoryId,
  onConfirm,
}: TemplatesFolderPickerDialogProps) {
  const tree = useMemo(
    () => buildCategoryTree(categories.filter((cat) => !cat.archivedAt)),
    [categories],
  );
  const [draftId, setDraftId] = useState<string | null>(selectedCategoryId);

  const draftLabel = useMemo(() => {
    if (!draftId) return null;
    const cat = categories.find((c) => c.id === draftId);
    return cat?.displayName ?? null;
  }, [categories, draftId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraftId(selectedCategoryId);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select templates folder</DialogTitle>
          <DialogDescription>
            Choose a folder in the company filesystem. Word templates in this folder
            (and its subfolders) appear in the assignment lists.
          </DialogDescription>
        </DialogHeader>

        {tree.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            No company folders found. Set up the company filesystem first.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white py-1">
            {tree.map((node) => (
              <FolderTreeNode
                key={node.id ?? node.slug}
                node={node}
                depth={0}
                selectedId={draftId}
                onSelect={setDraftId}
              />
            ))}
          </div>
        )}

        {draftLabel && (
          <p className="text-xs text-slate-500">
            Selected: <span className="font-medium text-slate-700">{draftLabel}</span>
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!draftId}
            onClick={() => {
              if (!draftId) return;
              onConfirm(draftId);
              onOpenChange(false);
            }}
          >
            Use this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
