'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { LayoutTemplate, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
  BottomFormDrawerError,
} from '@/components/forms/BottomFormDrawer';
import { CategoryTreeEditor, type CategoryUpdate } from './CategoryTreeEditor';
import type { FilesystemTemplate, FilesystemTemplateCategory } from '@/lib/api-client';

interface FilesystemTemplateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: FilesystemTemplate | null;
  onSaved?: (template: FilesystemTemplate) => void;
}

export function FilesystemTemplateDrawer({
  open,
  onOpenChange,
  template,
  onSaved,
}: FilesystemTemplateDrawerProps) {
  const isEditing = !!template;
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setName(template?.name ?? '');
        setDescription(template?.description ?? '');
        setError(null);
      }
      onOpenChange(nextOpen);
    },
    [template, onOpenChange],
  );

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = isEditing
        ? `/api/filesystem-templates/${template!.id}`
        : '/api/filesystem-templates';

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || 'Failed to save template');
      }

      const saved = await res.json();
      toast.success(isEditing ? 'Template updated' : 'Template created');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }, [name, description, isEditing, template, onSaved, onOpenChange]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpen}
      title={isEditing ? 'Edit Template' : 'New Filesystem Template'}
      description="Define a category blueprint that can be applied to tenant filesystems."
      icon={<LayoutTemplate className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <div className="mx-auto max-w-lg space-y-5">
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Insurance Claims"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this template's purpose"
              rows={3}
            />
          </div>

          {isEditing && template?.categories && (
            <div className="space-y-2">
              <Label>Category Tree</Label>
              <p className="text-sm text-slate-500">
                Edit the categories for this template. Changes are saved separately.
              </p>
              <CategoryTreeEditor
                categories={template.categories.map((c: FilesystemTemplateCategory) => ({
                  id: c.id,
                  filesystemId: c.templateId,
                  parentCategoryId: c.parentCategoryId,
                  displayName: c.displayName,
                  slug: c.slug,
                  config: c.config,
                  sortOrder: c.sortOrder,
                  archivedAt: null,
                  createdAt: '',
                  updatedAt: '',
                }))}
                onSave={async (updates: CategoryUpdate[]) => {
                  try {
                    const res = await fetch(
                      `/api/filesystem-templates/${template.id}/categories`,
                      {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ categories: updates }),
                      },
                    );
                    if (!res.ok) throw new Error('Failed to update categories');
                    toast.success('Template categories updated');
                  } catch {
                    toast.error('Failed to update template categories');
                  }
                }}
                saving={false}
              />
            </div>
          )}

          <BottomFormDrawerError error={error} />
        </div>
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Create Template'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
