'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Check,
  X,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FilesystemCategory } from '@/lib/api-client';

export interface CategoryUpdate {
  id?: string;
  displayName: string;
  slug: string;
  parentCategoryId?: string | null;
  sortOrder: number;
  _action?: 'create' | 'update' | 'delete';
}

interface CategoryTreeEditorProps {
  categories: FilesystemCategory[];
  onSave: (categories: CategoryUpdate[]) => void;
  saving?: boolean;
}

interface EditableNode {
  id: string;
  displayName: string;
  slug: string;
  parentCategoryId: string | null;
  sortOrder: number;
  isNew?: boolean;
  deleted?: boolean;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CategoryTreeEditor({ categories, onSave, saving }: CategoryTreeEditorProps) {
  const [nodes, setNodes] = useState<EditableNode[]>(() =>
    categories
      .filter((c) => !c.archivedAt)
      .map((c) => ({
        id: c.id,
        displayName: c.displayName,
        slug: c.slug,
        parentCategoryId: c.parentCategoryId,
        sortOrder: c.sortOrder,
      })),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newName, setNewName] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const rootNodes = nodes
    .filter((n) => !n.parentCategoryId && !n.deleted)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const startEdit = (node: EditableNode) => {
    setEditingId(node.id);
    setEditValue(node.displayName);
  };

  const confirmEdit = () => {
    if (!editingId || !editValue.trim()) return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === editingId
          ? { ...n, displayName: editValue.trim(), slug: slugify(editValue.trim()) }
          : n,
      ),
    );
    setEditingId(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const addNew = () => {
    if (!newName.trim()) return;
    const maxSort = Math.max(0, ...nodes.map((n) => n.sortOrder));
    setNodes((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        displayName: newName.trim(),
        slug: slugify(newName.trim()),
        parentCategoryId: null,
        sortOrder: maxSort + 1,
        isNew: true,
      },
    ]);
    setNewName('');
    setAddingNew(false);
  };

  const deleteNode = (id: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, deleted: true } : n)),
    );
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDrop = useCallback(
    (dropIdx: number) => {
      if (dragIdx === null || dragIdx === dropIdx) return;
      const reordered = [...rootNodes];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(dropIdx, 0, moved);
      const updatedIds = new Map(reordered.map((n, i) => [n.id, i]));
      setNodes((prev) =>
        prev.map((n) => {
          const newOrder = updatedIds.get(n.id);
          return newOrder != null ? { ...n, sortOrder: newOrder } : n;
        }),
      );
      setDragIdx(null);
    },
    [dragIdx, rootNodes],
  );

  const handleSave = () => {
    const updates: CategoryUpdate[] = [];

    for (const node of nodes) {
      if (node.deleted && !node.isNew) {
        updates.push({
          id: node.id,
          displayName: node.displayName,
          slug: node.slug,
          sortOrder: node.sortOrder,
          _action: 'delete',
        });
      } else if (node.isNew && !node.deleted) {
        updates.push({
          displayName: node.displayName,
          slug: node.slug,
          parentCategoryId: node.parentCategoryId,
          sortOrder: node.sortOrder,
          _action: 'create',
        });
      } else if (!node.deleted) {
        const original = categories.find((c) => c.id === node.id);
        if (
          original &&
          (original.displayName !== node.displayName ||
            original.slug !== node.slug ||
            original.sortOrder !== node.sortOrder)
        ) {
          updates.push({
            id: node.id,
            displayName: node.displayName,
            slug: node.slug,
            parentCategoryId: node.parentCategoryId,
            sortOrder: node.sortOrder,
            _action: 'update',
          });
        }
      }
    }

    onSave(updates);
  };

  const hasChanges =
    nodes.some((n) => n.isNew && !n.deleted) ||
    nodes.some((n) => n.deleted && !n.isNew) ||
    nodes.some((n) => {
      const orig = categories.find((c) => c.id === n.id);
      return (
        orig &&
        (orig.displayName !== n.displayName ||
          orig.slug !== n.slug ||
          orig.sortOrder !== n.sortOrder)
      );
    });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {rootNodes.map((node, idx) => (
          <div
            key={node.id}
            className={cn(
              'flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors',
              'hover:bg-slate-50',
            )}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
          >
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300" />

            {editingId === node.id ? (
              <div className="flex flex-1 items-center gap-1">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  className="h-7 text-sm"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={confirmEdit}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-sm text-slate-700">{node.displayName}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => startEdit(node)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={() => deleteNode(node.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      {addingNew ? (
        <div className="flex items-center gap-2 px-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNew();
              if (e.key === 'Escape') {
                setAddingNew(false);
                setNewName('');
              }
            }}
            autoFocus
          />
          <Button size="sm" variant="default" onClick={addNew} disabled={!newName.trim()}>
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAddingNew(false);
              setNewName('');
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddingNew(true)}
          className="ml-2"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Category
        </Button>
      )}

      {hasChanges && (
        <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
