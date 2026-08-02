'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  ArtifactContentType,
  ArtifactExportSettings,
  FilesystemCategoryNode,
} from '@/lib/api-client';

interface FlatCategory {
  id: string;
  label: string;
  slug: string;
}

function flattenCategories(
  categories: FilesystemCategoryNode[],
  prefix = '',
): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const cat of categories) {
    const label = prefix ? `${prefix} / ${cat.displayName}` : cat.displayName;
    if (cat.id) {
      result.push({ id: cat.id, label, slug: cat.slug });
    }
    if (cat.children?.length) {
      result.push(...flattenCategories(cat.children, label));
    }
  }
  return result;
}

const CONTENT_TYPES: { key: ArtifactContentType; label: string }[] = [
  { key: 'markdown', label: 'Markdown' },
  { key: 'code', label: 'Code' },
  { key: 'json', label: 'JSON' },
  { key: 'html', label: 'HTML' },
  { key: 'image', label: 'Generated images' },
];

interface ArtifactExportDefaultsPanelProps {
  categories: FilesystemCategoryNode[];
}

export function ArtifactExportDefaultsPanel({
  categories,
}: ArtifactExportDefaultsPanelProps) {
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const [settings, setSettings] = useState<ArtifactExportSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/filesystems/artifact-export')
      .then((r) => (r.ok ? r.json() : {}))
      .then(setSettings)
      .catch(() => setSettings({}))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      const res = await fetch('/api/filesystems/artifact-export', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const updateContentTypeMapping = (key: ArtifactContentType, categoryId: string) => {
    setSettings((prev) => ({
      ...prev,
      categoryByContentType: {
        ...prev.categoryByContentType,
        [key]: categoryId || undefined,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading export settings…
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">AI export defaults</h4>
      <p className="mt-1 text-xs text-slate-500">
        Where chat and canvas artifacts are saved when no category is specified.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-slate-700">
          Default category
          <select
            value={settings.defaultCategoryId ?? ''}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                defaultCategoryId: e.target.value || null,
              }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
          >
            <option value="">— Select category —</option>
            {flatCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="text-xs font-medium text-slate-700">Content-type overrides (optional)</p>
          <div className="mt-2 space-y-2">
            {CONTENT_TYPES.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="w-16 shrink-0">{label}</span>
                <select
                  value={settings.categoryByContentType?.[key] ?? ''}
                  onChange={(e) => updateContentTypeMapping(key, e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="">Use default</option>
                  {flatCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <label className="block text-xs font-medium text-slate-700">
          Filename template
          <input
            type="text"
            value={settings.fileNameTemplate ?? '{title}-{date}'}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, fileNameTemplate: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono text-slate-900"
            placeholder="{title}-{date}"
          />
          <span className="mt-0.5 block text-[10px] text-slate-400">
            Tokens: {'{title}'}, {'{date}'}, {'{conversationId}'}
          </span>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save export defaults'}
        </Button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>
    </div>
  );
}
