'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCatalogCategoryAction } from '@/app/(app)/admin/catalog/actions';
import type { CatalogCategory } from '@/types/api';

export interface CatalogCategoriesPanelProps {
  categories: CatalogCategory[];
}

function flatten(nodes: CatalogCategory[], depth = 0): Array<CatalogCategory & { depth: number }> {
  const out: Array<CatalogCategory & { depth: number }> = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.children?.length) out.push(...flatten(n.children, depth + 1));
  }
  return out;
}

export function CatalogCategoriesPanel({ categories }: CatalogCategoriesPanelProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const flat = flatten(categories);

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
                {cat.name}{' '}
                <span className="font-mono text-xs text-slate-400">({cat.code})</span>
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
