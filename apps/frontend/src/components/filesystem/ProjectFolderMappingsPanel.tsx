'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FilesystemCategoryNode } from '@/lib/api-client';

interface FlatCategory {
  value: string;
  label: string;
}

function flattenCategories(
  categories: FilesystemCategoryNode[],
  prefix = '',
): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const cat of categories) {
    const label = prefix ? `${prefix} / ${cat.displayName}` : cat.displayName;
    result.push({ value: cat.slug, label: `${label} (${cat.slug})` });
    if (cat.children?.length) {
      result.push(...flattenCategories(cat.children, label));
    }
  }
  return result;
}

interface ProjectFolderMappings {
  photos?: string | null;
}

const ROLES: { key: keyof ProjectFolderMappings; label: string; description: string }[] = [
  {
    key: 'photos',
    label: 'Photos',
    description: 'Where inspection and site photos are stored when uploaded via the Journal Assistant.',
  },
];

interface ProjectFolderMappingsPanelProps {
  categories: FilesystemCategoryNode[];
  templateId?: string;
}

export function ProjectFolderMappingsPanel({
  categories,
  templateId,
}: ProjectFolderMappingsPanelProps) {
  const flatCategories = useMemo(
    () => flattenCategories(categories),
    [categories],
  );
  const [mappings, setMappings] = useState<ProjectFolderMappings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/filesystems/folder-mappings')
      .then((r) => (r.ok ? r.json() : {}))
      .then(setMappings)
      .catch(() => setMappings({}))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      const res = await fetch('/api/filesystems/folder-mappings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(templateId ? { templateId } : {}),
          ...mappings,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMappings(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading folder mappings…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Project folder mappings</h4>
      <p className="mt-1 text-xs text-slate-500">
        Map named roles to specific project folders. These are used by AI agents
        and tools to store files in the correct location.
      </p>

      <div className="mt-4 space-y-3">
        {ROLES.map(({ key, label, description }) => (
          <label key={key} className="block text-xs font-medium text-slate-700">
            {label}
            <select
              value={mappings[key] ?? ''}
              onChange={(e) =>
                setMappings((prev) => ({
                  ...prev,
                  [key]: e.target.value || null,
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              <option value="">— Select folder —</option>
              {flatCategories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[10px] text-slate-400">{description}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save folder mappings'}
        </Button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>
    </div>
  );
}
