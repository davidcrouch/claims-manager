'use client';

import { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTransformEditor } from './TransformEditorContext';

export function LoadSampleDataButton() {
  const { documentType, setTestData } = useTransformEditor();
  const [open, setOpen] = useState(false);
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    if (!entityId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/document-templates/transforms/${encodeURIComponent(documentType)}/sample-data`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId: entityId.trim() }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Failed to load sample data (${res.status})`);
      }
      const result = await res.json();
      setTestData(JSON.stringify(result.data, null, 2));
      toast.success('Sample data loaded from entity');
      setOpen(false);
      setEntityId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sample data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        <Database className="size-3.5" />
        Load entity data
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Load sample data</p>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Enter an entity ID to fetch its real data from the mapper. This replaces the
              current test data.
            </p>
          </div>
          <Input
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Entity UUID…"
            className="font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleLoad();
            }}
          />
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => void handleLoad()}
            disabled={loading || !entityId.trim()}
          >
            {loading ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Database className="mr-1 size-3.5" />
            )}
            Load data
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
