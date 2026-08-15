'use client';

import { useCallback, useState } from 'react';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTransformEditor } from './TransformEditorContext';

interface TransformVersion {
  id: string;
  version: number;
  jsonataRules: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface VersionHistoryResponse {
  current: {
    id: string;
    version: number;
    jsonataRules: string | null;
  } | null;
  versions: TransformVersion[];
}

export function TransformVersionHistoryButton() {
  const { documentType, setJsonataRules, isCustom } = useTransformEditor();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VersionHistoryResponse | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/document-templates/transforms/${encodeURIComponent(documentType)}/versions`,
      );
      if (!res.ok) throw new Error('Failed to load version history');
      const result = (await res.json()) as VersionHistoryResponse;
      setData(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  function handleOpen() {
    setOpen(true);
    void loadHistory();
  }

  function handleRestore(version: TransformVersion) {
    if (version.jsonataRules) {
      setJsonataRules(version.jsonataRules);
      toast.success(`Restored version ${version.version} — save to persist`);
    }
    setOpen(false);
  }

  if (!isCustom) return null;

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="gap-1.5"
      >
        <History className="size-3.5" />
        History
      </Button>
    );
  }

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-800">Version history</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Close
        </Button>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-4 animate-spin text-slate-400" />
          </div>
        ) : !data?.versions?.length ? (
          <p className="py-6 text-center text-sm text-slate-400">
            No previous versions found
          </p>
        ) : (
          <div className="space-y-2">
            {data.current && (
              <div className="rounded border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-blue-800">
                    Version {data.current.version} (current)
                  </span>
                </div>
                {data.current.jsonataRules && (
                  <pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-slate-600">
                    {data.current.jsonataRules.substring(0, 300)}
                    {data.current.jsonataRules.length > 300 ? '…' : ''}
                  </pre>
                )}
              </div>
            )}

            {data.versions.map((v) => (
              <div
                key={v.id}
                className="rounded border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-medium text-slate-700">
                      Version {v.version}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-400">
                      {formatDate(v.createdAt)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => handleRestore(v)}
                    disabled={!v.jsonataRules}
                  >
                    <RotateCcw className="size-3" />
                    Restore
                  </Button>
                </div>
                {v.jsonataRules && (
                  <pre className="mt-2 max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-slate-600">
                    {v.jsonataRules.substring(0, 300)}
                    {v.jsonataRules.length > 300 ? '…' : ''}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}
