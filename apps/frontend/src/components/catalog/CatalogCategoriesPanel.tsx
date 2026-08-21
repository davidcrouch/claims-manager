'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createCatalogCategoryAction,
  deleteCatalogCategoryAction,
  updateCatalogCategoryAction,
} from '@/app/(app)/admin/catalog/actions';
import type { CatalogCategory } from '@/types/api';

export interface CatalogCategoriesPanelProps {
  categories: CatalogCategory[];
  /** Prefill add form from AI. */
  initialCode?: string;
  initialName?: string;
  initialParentCategoryId?: string;
}

function flatten(nodes: CatalogCategory[], depth = 0): Array<CatalogCategory & { depth: number }> {
  const out: Array<CatalogCategory & { depth: number }> = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.children?.length) out.push(...flatten(n.children, depth + 1));
  }
  return out;
}

export function CatalogCategoriesPanel({
  categories,
  initialCode,
  initialName,
  initialParentCategoryId,
}: CatalogCategoriesPanelProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode ?? '');
  const [name, setName] = useState(initialName ?? '');
  const [parentCategoryId, setParentCategoryId] = useState(initialParentCategoryId ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const flat = flatten(categories);

  useEffect(() => {
    if (initialCode != null) setCode(initialCode);
    if (initialName != null) setName(initialName);
    if (initialParentCategoryId != null) setParentCategoryId(initialParentCategoryId);
  }, [initialCode, initialName, initialParentCategoryId]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createCatalogCategoryAction({
        code: code.trim(),
        name: name.trim(),
        parentCategoryId: parentCategoryId || undefined,
      });
      if (!result.success) {
        setMessage(result.error ?? 'Failed');
        return;
      }
      setCode('');
      setName('');
      setMessage('Category created');
      router.refresh();
    });
  }

  function startEdit(cat: CatalogCategory) {
    setEditingId(cat.id);
    setEditCode(cat.code);
    setEditName(cat.name);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditCode('');
    setEditName('');
  }

  function handleSaveEdit() {
    if (!editingId) return;
    setMessage(null);
    startTransition(async () => {
      const result = await updateCatalogCategoryAction(editingId, {
        code: editCode.trim(),
        name: editName.trim(),
      });
      if (!result.success) {
        setMessage(result.error ?? 'Failed');
        return;
      }
      cancelEdit();
      setMessage('Category updated');
      router.refresh();
    });
  }

  function handleDeactivate(id: string, label: string) {
    if (!window.confirm(`Deactivate category “${label}”? Items keep their category link.`)) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await deleteCatalogCategoryAction(id);
      if (!result.success) {
        setMessage(result.error ?? 'Failed');
        return;
      }
      if (editingId === id) cancelEdit();
      setMessage('Category deactivated');
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <h3 className="text-sm font-medium text-slate-900">Current categories</h3>
        {flat.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No categories yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
            {flat.map((cat) => (
              <li key={cat.id} style={{ paddingLeft: `${cat.depth * 16}px` }}>
                {editingId === cat.id ? (
                  <div className="flex flex-wrap items-center gap-2 py-1">
                    <Input
                      className="h-8 w-28"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      aria-label="Category code"
                    />
                    <Input
                      className="h-8 min-w-32 flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Category name"
                    />
                    <Button type="button" size="sm" disabled={pending} onClick={handleSaveEdit}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 py-0.5">
                    <span>
                      {cat.name}{' '}
                      <span className="font-mono text-xs text-slate-400">({cat.code})</span>
                      {!cat.isActive && (
                        <span className="ml-2 text-xs text-amber-600">inactive</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={pending}
                        onClick={() => startEdit(cat)}
                        aria-label={`Edit ${cat.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {cat.isActive !== false && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          disabled={pending}
                          onClick={() => handleDeactivate(cat.id, cat.name)}
                          aria-label={`Deactivate ${cat.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={handleAdd} className="space-y-4 border-t border-slate-200 pt-6">
        <h3 className="text-sm font-medium text-slate-900">Add category</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={parentCategoryId}
          onChange={(e) => setParentCategoryId(e.target.value)}
        >
          <option value="">Root level</option>
          {flat.map((c) => (
            <option key={c.id} value={c.id}>
              {'\u00A0'.repeat(c.depth * 2)}
              {c.name}
            </option>
          ))}
        </select>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Adding…' : 'Add category'}
        </Button>
      </form>
    </div>
  );
}
