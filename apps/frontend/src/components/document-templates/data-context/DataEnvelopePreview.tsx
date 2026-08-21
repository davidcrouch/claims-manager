'use client';

import { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DataEnvelopePreviewProps {
  documentType: string;
  enabledSlugs: string[];
}

export function DataEnvelopePreview({
  documentType,
  enabledSlugs,
}: DataEnvelopePreviewProps) {
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewJson, setPreviewJson] = useState<string | null>(null);

  async function handlePreview() {
    const id = entityId.trim();
    if (!id) {
      toast.error('Enter an entity ID to preview');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/document-templates/data-context/${encodeURIComponent(documentType)}/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId: id, enabledSlugs }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message ?? `Preview failed (${res.status})`,
        );
      }
      const data = await res.json();
      setPreviewJson(JSON.stringify(data.envelope ?? data, null, 2));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Preview data shape
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Resolve the envelope for a real entity using the current (unsaved) toggles.
          </p>
          <Input
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Entity UUID…"
            className="mt-2 font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handlePreview();
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void handlePreview()}
          disabled={loading || !entityId.trim()}
        >
          {loading ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : (
            <Database className="mr-1.5 size-3.5" />
          )}
          Preview
        </Button>
      </div>

      {previewJson && (
        <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">
          {previewJson}
        </pre>
      )}
    </div>
  );
}
