'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  ArtifactContentType,
  ArtifactExportScope,
  ArtifactExportSettings,
  FilesystemCategoryNode,
} from '@/lib/api-client';

interface FlatCategory {
  value: string;
  label: string;
  slug: string;
}

function flattenCategories(
  categories: FilesystemCategoryNode[],
  valueMode: 'id' | 'slug',
  prefix = '',
): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const cat of categories) {
    const label = prefix ? `${prefix} / ${cat.displayName}` : cat.displayName;
    const value = valueMode === 'slug' ? cat.slug : cat.id;
    if (value) {
      result.push({ value, label, slug: cat.slug });
    }
    if (cat.children?.length) {
      result.push(...flattenCategories(cat.children, valueMode, label));
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
  scope?: ArtifactExportScope;
  /** company → category id; project → category slug */
  valueMode?: 'id' | 'slug';
  /** Project: template used to validate slugs when org default is not saved yet */
  templateId?: string;
}

export function ArtifactExportDefaultsPanel({
  categories,
  scope = 'company',
  valueMode = scope === 'project' ? 'slug' : 'id',
  templateId,
}: ArtifactExportDefaultsPanelProps) {
  const flatCategories = useMemo(
    () => flattenCategories(categories, valueMode),
    [categories, valueMode],
  );
  const [settings, setSettings] = useState<ArtifactExportSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const qs = scope === 'company' ? '' : `?scope=${encodeURIComponent(scope)}`;
    setIsLoading(true);
    fetch(`/api/filesystems/artifact-export${qs}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then(setSettings)
      .catch(() => setSettings({}))
      .finally(() => setIsLoading(false));
  }, [scope]);

  const handleSave = () => {
    startTransition(async () => {
      const res = await fetch('/api/filesystems/artifact-export', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          ...(scope === 'project' && templateId ? { templateId } : {}),
          ...settings,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  const updateContentTypeMapping = (key: ArtifactContentType, categoryValue: string) => {
    setSettings((prev) => ({
      ...prev,
      categoryByContentType: {
        ...prev.categoryByContentType,
        [key]: categoryValue || undefined,
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

  const description =
    scope === 'project'
      ? 'Where chat and canvas artifacts are saved on a job filesystem when no category is specified.'
      : 'Where chat and canvas artifacts are saved when no category is specified.';

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">AI export defaults</h4>
      <p className="mt-1 text-xs text-slate-500">{description}</p>

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
              <option key={cat.value} value={cat.value}>
                {cat.label}
                {valueMode === 'slug' ? ` (${cat.slug})` : ''}
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
                    <option key={cat.value} value={cat.value}>
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
