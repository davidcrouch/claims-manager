'use client';

import { useState } from 'react';
import {
  Database,
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { generateAndDownloadDocument } from '@/lib/generate-document';
import { useTemplateEditor } from './TemplateEditorContext';

export function TemplateTestPanel({ className = '' }: { className?: string }) {
  const { documentType, hasTemplate } = useTemplateEditor();

  const [testData, setTestData] = useState('{\n  \n}');
  /** Entity ID entered in the Load entity popover (transient). */
  const [entityIdInput, setEntityIdInput] = useState('');
  /** Entity ID used for generation — set when sample data is loaded, or parsed from JSON. */
  const [sourceEntityId, setSourceEntityId] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [loadEntityOpen, setLoadEntityOpen] = useState(false);

  async function handleLoadSampleData() {
    const id = entityIdInput.trim();
    if (!id) return;
    setLoadingData(true);
    try {
      const res = await fetch(
        `/api/document-templates/transforms/${encodeURIComponent(documentType)}/sample-data`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId: id }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `Failed to load sample data (${res.status})`);
      }
      const result = await res.json();
      // Mapper output is merge-tag shaped and has no id — keep entityId for generation.
      const payload =
        result.data && typeof result.data === 'object' && !Array.isArray(result.data)
          ? { entityId: id, ...(result.data as Record<string, unknown>) }
          : { entityId: id, data: result.data };
      setTestData(JSON.stringify(payload, null, 2));
      setSourceEntityId(id);
      toast.success('Sample data loaded from entity');
      setLoadEntityOpen(false);
      setEntityIdInput('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sample data');
    } finally {
      setLoadingData(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateResult(null);
    setGenerateError(null);

    let parsedEntityId: string | undefined;
    try {
      const parsed = JSON.parse(testData) as Record<string, unknown>;
      const fromJson = parsed?.id ?? parsed?.entityId;
      if (typeof fromJson === 'string' && fromJson.trim()) {
        parsedEntityId = fromJson.trim();
      }
    } catch {
      setGenerateError('Test data is not valid JSON');
      setGenerating(false);
      return;
    }

    const resolvedEntityId = parsedEntityId || sourceEntityId.trim() || undefined;

    if (!resolvedEntityId) {
      setGenerateError(
        'Load an entity first (or add an "id" / "entityId" field to the test JSON) so generation knows which record to use.',
      );
      setGenerating(false);
      return;
    }

    try {
      const result = await generateAndDownloadDocument({
        documentType,
        entityId: resolvedEntityId,
      });
      setSourceEntityId(resolvedEntityId);
      setGenerateResult(
        `Document generated (${result.format.toUpperCase()})${result.savedToFolder ? ' and saved to folder' : ''}`,
      );
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  if (!hasTemplate) {
    return (
      <div className={className}>
        <p className="text-sm text-slate-400">
          Assign a template to test document generation.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Test generation
        </h3>
        <Popover open={loadEntityOpen} onOpenChange={setLoadEntityOpen}>
          <PopoverTrigger
            className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
          >
            <Database className="size-3" />
            Load entity
          </PopoverTrigger>
          <PopoverContent className="w-72" align="end">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Load sample data</p>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  Enter an entity ID to fetch its real data from the mapper. Generation uses
                  this same entity.
                </p>
              </div>
              <Input
                value={entityIdInput}
                onChange={(e) => setEntityIdInput(e.target.value)}
                placeholder="Entity UUID…"
                className="font-mono text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleLoadSampleData();
                }}
              />
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => void handleLoadSampleData()}
                disabled={loadingData || !entityIdInput.trim()}
              >
                {loadingData ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Database className="mr-1 size-3.5" />
                )}
                Load data
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <textarea
        value={testData}
        onChange={(e) => setTestData(e.target.value)}
        className="h-48 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[12px] leading-relaxed text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        spellCheck={false}
        placeholder="Load an entity to preview merge-tag values…"
      />

      {sourceEntityId ? (
        <p className="truncate font-mono text-[11px] text-slate-500" title={sourceEntityId}>
          Source entity: {sourceEntityId}
        </p>
      ) : (
        <p className="text-[11px] text-slate-400">
          Use Load entity, then Generate test document.
        </p>
      )}

      <Button
        type="button"
        size="sm"
        onClick={() => void handleGenerate()}
        disabled={generating || !testData.trim()}
      >
        {generating ? (
          <Loader2 className="mr-1 size-3.5 animate-spin" />
        ) : (
          <Play className="mr-1 size-3.5" />
        )}
        Generate test document
      </Button>

      {generateError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
          <p className="text-[13px] text-red-600">{generateError}</p>
        </div>
      )}

      {generateResult && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
          <p className="text-[13px] text-green-700">{generateResult}</p>
        </div>
      )}
    </div>
  );
}
