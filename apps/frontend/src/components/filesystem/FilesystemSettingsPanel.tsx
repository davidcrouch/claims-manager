'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FolderCog, FolderTree, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
  BottomFormDrawerError,
} from '@/components/forms/BottomFormDrawer';
import { FilesystemEditorPanel } from './FilesystemEditorPanel';
import { ArtifactExportDefaultsPanel } from './ArtifactExportDefaultsPanel';
import { PipelineEditorPanel } from './PipelineEditorPanel';
import { buildCategoryTree, flattenCategoryTree } from './CategoryTreeEditor';
import type {
  FilesystemResponse,
  FilesystemTemplate,
  FilesystemCategoryNode,
} from '@/lib/api-client';

interface FilesystemSettingsPanelProps {
  initialFilesystem?: FilesystemResponse | null;
  initialTemplates?: FilesystemTemplate[];
}

function needsSetup(filesystem: FilesystemResponse | null): boolean {
  if (!filesystem) return true;
  if (filesystem.sourceTemplateId) return false;
  return !filesystem.categories || filesystem.categories.length === 0;
}

function normalizeTemplates(payload: unknown): FilesystemTemplate[] {
  if (Array.isArray(payload)) return payload as FilesystemTemplate[];
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: FilesystemTemplate[] }).data;
  }
  return [];
}

function countCategories(nodes: FilesystemCategoryNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count += 1;
    if (n.children?.length) count += countCategories(n.children);
  }
  return count;
}

export function FilesystemSettingsPanel({
  initialFilesystem,
  initialTemplates,
}: FilesystemSettingsPanelProps) {
  const [filesystem, setFilesystem] = useState<FilesystemResponse | null>(
    initialFilesystem ?? null,
  );
  const [templates, setTemplates] = useState<FilesystemTemplate[]>(initialTemplates ?? []);
  const [loading, setLoading] = useState(!initialFilesystem && !initialTemplates);
  const [settingUp, setSettingUp] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (initialFilesystem !== undefined) return;

    (async () => {
      try {
        const [fsRes, tplRes] = await Promise.all([
          fetch('/api/filesystems').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/filesystem-templates').then((r) => (r.ok ? r.json() : null)),
        ]);
        setFilesystem(fsRes);
        setTemplates(normalizeTemplates(tplRes));
      } catch {
        toast.error('Failed to load filesystem settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialFilesystem]);

  const handleSetup = useCallback(async (templateId: string) => {
    setSettingUp(true);
    try {
      const res = await fetch('/api/filesystems/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) throw new Error('Setup failed');
      const data = await res.json();
      setFilesystem(data);
      toast.success('Filesystem configured successfully');
    } catch {
      toast.error('Failed to set up filesystem');
    } finally {
      setSettingUp(false);
    }
  }, []);

  const handleSetupDefault = useCallback(async () => {
    setSettingUp(true);
    try {
      const res = await fetch('/api/filesystems/setup-default', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Setup failed');
      const data = await res.json();
      setFilesystem(data);
      toast.success('Filesystem configured successfully');
    } catch {
      toast.error('Failed to set up filesystem');
    } finally {
      setSettingUp(false);
    }
  }, []);

  const handleCategoriesSaved = useCallback((updated: FilesystemResponse) => {
    setFilesystem(updated);
    setEditorOpen(false);
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (needsSetup(filesystem)) {
    // Org setup only offers company templates (project templates are for jobs).
    const companyTemplates = templates.filter((t) => (t.kind ?? 'company') === 'company');
    const defaultTemplate = companyTemplates.find((t) => t.isDefault);
    const orderedTemplates = [...companyTemplates].sort(
      (a, b) => Number(b.isDefault) - Number(a.isDefault),
    );

    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <FolderCog className="h-7 w-7 text-slate-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Set Up Document Filesystem
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Choose a template to configure your document categories.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {orderedTemplates.length > 0 ? (
              orderedTemplates.map((tpl) => (
                <Button
                  key={tpl.id}
                  variant={tpl.isDefault ? 'default' : 'outline'}
                  onClick={() => handleSetup(tpl.id)}
                  disabled={settingUp}
                >
                  {settingUp ? 'Setting up…' : tpl.name}
                </Button>
              ))
            ) : (
              <Button onClick={handleSetupDefault} disabled={settingUp}>
                {settingUp
                  ? 'Setting up…'
                  : defaultTemplate
                    ? defaultTemplate.name
                    : 'Use Default Template'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  const categoryTree = buildCategoryTree(filesystem!.categories);
  const categoryCount = countCategories(categoryTree);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Document Categories
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {categoryCount} {categoryCount === 1 ? 'category' : 'categories'} configured
              {filesystem!.sourceTemplateId && ' · based on a filesystem template'}
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setEditorOpen(true)} className="gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Edit Categories
          </Button>
        </div>

        <CategoryTreeSummary categories={categoryTree} />

        <ArtifactExportDefaultsPanel categories={categoryTree} />

        <div className="mt-5 border-t border-slate-100 pt-5">
          <PipelineEditorPanel filesystemId={filesystem!.id} />
        </div>
      </Card>

      <CategoryEditorDrawer
        filesystem={filesystem!}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={handleCategoriesSaved}
      />
    </div>
  );
}

function CategoryTreeSummary({
  categories,
  depth = 0,
}: {
  categories: FilesystemCategoryNode[];
  depth?: number;
}) {
  if (categories.length === 0 && depth === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-400">
        No categories yet. Click &ldquo;Edit Categories&rdquo; to get started.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {categories.map((cat) => (
        <div key={cat.id ?? cat.slug} style={{ marginLeft: depth * 20 }}>
          <div className="flex items-center gap-1.5 rounded-md px-2 py-1">
            {(cat.children?.length ?? 0) > 0 ? (
              <span className="text-slate-400">▾</span>
            ) : (
              <span className="w-3" />
            )}

            {cat.config?.color && (
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: cat.config.color }}
              />
            )}

            <FolderTree className="h-4 w-4 shrink-0 text-amber-500/70" />
            <span className="text-sm text-slate-900">{cat.displayName}</span>
            <span className="text-xs text-slate-400">{cat.slug}</span>

            {cat.config?.retentionDays && (
              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {cat.config.retentionDays}d
              </span>
            )}
          </div>

          {cat.children && cat.children.length > 0 && (
            <CategoryTreeSummary categories={cat.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryEditorDrawer({
  filesystem,
  open,
  onOpenChange,
  onSaved,
}: {
  filesystem: FilesystemResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (fs: FilesystemResponse) => void;
}) {
  const [categories, setCategories] = useState<FilesystemCategoryNode[]>(() =>
    buildCategoryTree(filesystem.categories),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategories(buildCategoryTree(filesystem.categories));
      setError(null);
    }
  }, [open, filesystem.categories]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const flat = flattenCategoryTree(categories);
      const res = await fetch(`/api/filesystems/${filesystem.id}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: flat }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || 'Failed to save categories');
      }

      const refreshed = await fetch('/api/filesystems').then((r) => (r.ok ? r.json() : null));
      if (refreshed) onSaved(refreshed);
      toast.success('Categories updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save category changes';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [categories, filesystem.id, onSaved]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Categories"
      description={filesystem.name}
      icon={<FolderTree className="h-5 w-5" />}
      widthClassName="w-[85%]"
    >
      <BottomFormDrawerBody className="h-full !px-0 !py-0">
        <FilesystemEditorPanel
          categories={categories}
          onCategoriesChange={setCategories}
          filesystemId={filesystem.id}
        />
      </BottomFormDrawerBody>

      <BottomFormDrawerError error={error} />

      <BottomFormDrawerFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
