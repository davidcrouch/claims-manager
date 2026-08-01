'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FolderCog, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CategoryTreeEditor, type CategoryUpdate } from './CategoryTreeEditor';
import type { FilesystemResponse, FilesystemTemplate } from '@/lib/api-client';

interface FilesystemSettingsPanelProps {
  initialFilesystem?: FilesystemResponse | null;
  initialTemplates?: FilesystemTemplate[];
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
  const [saving, setSaving] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  useEffect(() => {
    if (initialFilesystem !== undefined) return;

    (async () => {
      try {
        const [fsRes, tplRes] = await Promise.all([
          fetch('/api/filesystems').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/filesystem-templates').then((r) => (r.ok ? r.json() : null)),
        ]);
        setFilesystem(fsRes);
        setTemplates(tplRes?.data ?? []);
      } catch {
        toast.error('Failed to load filesystem settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialFilesystem]);

  const handleSetup = useCallback(
    async (templateId: string) => {
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
    },
    [],
  );

  const handleSaveCategories = useCallback(
    async (updates: CategoryUpdate[]) => {
      if (!filesystem) return;
      setSaving(true);
      try {
        for (const update of updates) {
          if (update._action === 'create') {
            await fetch(`/api/filesystems/${filesystem.id}/categories`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                displayName: update.displayName,
                slug: update.slug,
                parentCategoryId: update.parentCategoryId,
                sortOrder: update.sortOrder,
              }),
            });
          } else if (update._action === 'update' && update.id) {
            await fetch(
              `/api/filesystems/${filesystem.id}/categories/${update.id}`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  displayName: update.displayName,
                  slug: update.slug,
                  sortOrder: update.sortOrder,
                }),
              },
            );
          } else if (update._action === 'delete' && update.id) {
            await fetch(
              `/api/filesystems/${filesystem.id}/categories/${update.id}`,
              { method: 'DELETE' },
            );
          }
        }
        toast.success('Categories updated');
        const refreshed = await fetch('/api/filesystems').then((r) =>
          r.ok ? r.json() : null,
        );
        if (refreshed) setFilesystem(refreshed);
      } catch {
        toast.error('Failed to save category changes');
      } finally {
        setSaving(false);
      }
    },
    [filesystem],
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!filesystem) {
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
            {templates.length > 0 ? (
              templates.map((tpl) => (
                <Button
                  key={tpl.id}
                  variant="outline"
                  onClick={() => handleSetup(tpl.id)}
                  disabled={settingUp}
                >
                  {tpl.name}
                </Button>
              ))
            ) : (
              <Button onClick={() => handleSetup('default')} disabled={settingUp}>
                {settingUp ? 'Setting up…' : 'Use Default Template'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          Document Categories
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Organise your documents into categories. Drag to reorder, click to rename.
        </p>
        <CategoryTreeEditor
          categories={filesystem.categories}
          onSave={handleSaveCategories}
          saving={saving}
        />
      </Card>
    </div>
  );
}
