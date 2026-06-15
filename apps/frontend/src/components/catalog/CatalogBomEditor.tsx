'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { replaceCatalogBomAction } from '@/app/(app)/admin/catalog/actions';
import type { CatalogItem } from '@/types/api';

export interface CatalogBomEditorProps {
  assemblyId: string;
  components: Array<{
    id: string;
    componentId: string;
    quantity: string;
    wasteFactor: string;
    component?: { code?: string; name?: string };
    resolvedUnitCost?: string | null;
  }>;
  candidateItems: CatalogItem[];
}

export function CatalogBomEditor({
  assemblyId,
  components,
  candidateItems,
}: CatalogBomEditorProps) {
  const [lines, setLines] = useState(
    components.map((c) => ({
      componentId: c.componentId,
      quantity: c.quantity,
      wasteFactor: c.wasteFactor,
    })),
  );
  const [newComponentId, setNewComponentId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addLine() {
    if (!newComponentId) return;
    setLines((prev) => [
      ...prev,
      { componentId: newComponentId, quantity: '1', wasteFactor: '1' },
    ]);
    setNewComponentId('');
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await replaceCatalogBomAction(assemblyId, lines);
      setMessage(result.success ? 'BOM saved' : (result.error ?? 'Save failed'));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bill of materials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No components yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {lines.map((line, index) => {
              const item = candidateItems.find((i) => i.id === line.componentId);
              return (
                <li key={`${line.componentId}-${index}`} className="grid gap-2 sm:grid-cols-4">
                  <span className="sm:col-span-2 truncate">
                    {item ? `${item.code} — ${item.name}` : line.componentId}
                  </span>
                  <Input
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...lines];
                      next[index] = { ...line, quantity: e.target.value };
                      setLines(next);
                    }}
                    placeholder="Qty"
                  />
                  <Input
                    value={line.wasteFactor}
                    onChange={(e) => {
                      const next = [...lines];
                      next[index] = { ...line, wasteFactor: e.target.value };
                      setLines(next);
                    }}
                    placeholder="Waste"
                  />
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
          <select
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
            value={newComponentId}
            onChange={(e) => setNewComponentId(e.target.value)}
          >
            <option value="">Add component…</option>
            {candidateItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            Add
          </Button>
        </div>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save BOM'}
        </Button>
      </CardContent>
    </Card>
  );
}
