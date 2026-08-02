'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { LayoutTemplate, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
  BottomFormDrawerError,
} from '@/components/forms/BottomFormDrawer';
import { FilesystemEditorPanel } from './FilesystemEditorPanel';
import { buildCategoryTree, flattenCategoryTree } from './CategoryTreeEditor';
import type {
  FilesystemTemplate,
  FilesystemTemplateKind,
  FilesystemCategoryNode,
} from '@/lib/api-client';

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
  const isPlatform = template?.tenantId == null && isEditing;
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [kind, setKind] = useState<FilesystemTemplateKind>(template?.kind ?? 'company');
  const [categories, setCategories] = useState<FilesystemCategoryNode[]>(() =>
    buildCategoryTree(template?.categories ?? []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(template?.name ?? '');
      setDescription(template?.description ?? '');
      setKind(template?.kind ?? 'company');
      setCategories(buildCategoryTree(template?.categories ?? []));
      setError(null);
    }
  }, [open, template]);

  const handleOpen = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (isPlatform) {
      setError('Platform templates are read-only. Duplicate by creating a new org template.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let savedTemplate: FilesystemTemplate;

      if (isEditing && template) {
        const res = await fetch(`/api/filesystem-templates/${template.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            kind,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message || 'Failed to save template');
        }
        savedTemplate = await res.json();
      } else {
        const res = await fetch('/api/filesystem-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            kind,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { message?: string }).message || 'Failed to create template');
        }
        savedTemplate = await res.json();
      }

      const flat = flattenCategoryTree(categories);
      const categoriesRes = await fetch(
        `/api/filesystem-templates/${savedTemplate.id}/categories`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: flat }),
        },
      );
      if (!categoriesRes.ok) {
        throw new Error('Template saved, but failed to save categories');
      }

      toast.success(isEditing ? 'Template updated' : 'Template created');
      onSaved?.({ ...savedTemplate, kind, categories: undefined });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }, [name, description, kind, categories, isEditing, isPlatform, template, onSaved, onOpenChange]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpen}
      title={
        isEditing
          ? isPlatform
            ? 'View Template'
            : 'Edit Template'
          : 'New Filesystem Template'
      }
      description={
        kind === 'project'
          ? 'Category blueprint for a job/project filesystem (Jobs workspace).'
          : 'Category blueprint for the organisation document filesystem.'
      }
      icon={<LayoutTemplate className="h-5 w-5" />}
      widthClassName="w-[85%]"
    >
      <BottomFormDrawerBody className="flex h-full flex-col !px-0 !py-0">
        <div className="mx-auto w-full max-w-lg shrink-0 space-y-5 border-b border-slate-200 px-12 py-6">
          <div className="space-y-2">
            <Label htmlFor="template-kind">Type</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as FilesystemTemplateKind)}
              disabled={isPlatform || isEditing}
            >
              <SelectTrigger id="template-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Company — org-wide documents</SelectItem>
                <SelectItem value="project">Project — per-job documents</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'project' ? 'e.g. Restoration Job' : 'e.g. Company Docs'}
              autoFocus
              disabled={isPlatform}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this template's purpose"
              rows={2}
              disabled={isPlatform}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <FilesystemEditorPanel
            categories={categories}
            onCategoriesChange={setCategories}
            readOnly={isPlatform}
          />
        </div>
      </BottomFormDrawerBody>

      <BottomFormDrawerError error={error} />

      <BottomFormDrawerFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          {isPlatform ? 'Close' : 'Cancel'}
        </Button>
        {!isPlatform && (
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Template'}
          </Button>
        )}
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
