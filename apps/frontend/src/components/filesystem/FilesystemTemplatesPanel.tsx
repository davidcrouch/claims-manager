'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Briefcase, Building2, ListTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { AdminPageHeader } from '@/components/layout/PageHeaderLayout';
import { Card } from '@/components/ui/card';
import { FilesystemTemplateDrawer } from './FilesystemTemplateDrawer';
import type { FilesystemTemplate } from '@/lib/api-client';

interface FilesystemTemplatesPanelProps {
  templates: FilesystemTemplate[];
}

function KindBadge({ kind }: { kind?: string }) {
  const isProject = kind === 'project';
  return (
    <span
      className={
        isProject
          ? 'inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200'
          : 'inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800 ring-1 ring-sky-200'
      }
    >
      {isProject ? <Briefcase className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
      {isProject ? 'Project' : 'Company'}
    </span>
  );
}

export function FilesystemTemplatesPanel({
  templates: initialTemplates,
}: FilesystemTemplatesPanelProps) {
  const [templates, setTemplates] = useState<FilesystemTemplate[]>(initialTemplates);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<FilesystemTemplate | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const handleCreate = useCallback(() => {
    setEditTemplate(null);
    setDrawerOpen(true);
  }, []);

  const handleEdit = useCallback(async (template: FilesystemTemplate) => {
    setLoadingId(template.id);
    try {
      const res = await fetch(`/api/filesystem-templates/${template.id}`);
      if (!res.ok) throw new Error('Failed to load template');
      const full: FilesystemTemplate = await res.json();
      setEditTemplate(full);
      setDrawerOpen(true);
    } catch {
      toast.error('Failed to load template');
    } finally {
      setLoadingId(null);
    }
  }, []);

  const handleArchive = useCallback((template: FilesystemTemplate) => {
    if (template.tenantId == null) {
      toast.error('Platform templates cannot be archived');
      return;
    }
    if (
      !confirm(
        `Are you sure you want to archive "${template.name}"? Existing filesystems copied from this template will not be affected.`,
      )
    ) {
      return;
    }

    setArchivingId(template.id);
    (async () => {
      try {
        const res = await fetch(`/api/filesystem-templates/${template.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to archive template');
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        toast.success('Template archived');
      } catch {
        toast.error('Failed to archive template');
      } finally {
        setArchivingId(null);
      }
    })();
  }, []);

  const handleSaved = useCallback((saved: FilesystemTemplate) => {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      return exists
        ? prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t))
        : [...prev, saved];
    });
  }, []);

  const company = templates.filter((t) => (t.kind ?? 'company') === 'company');
  const project = templates.filter((t) => t.kind === 'project');

  const renderList = (items: FilesystemTemplate[], emptyLabel: string) => {
    if (items.length === 0) {
      return <p className="px-4 py-6 text-sm text-slate-500">{emptyLabel}</p>;
    }
    return (
      <div className="divide-y divide-slate-100">
        {items.map((template) => {
          const isPlatform = template.tenantId == null;
          return (
            <div
              key={template.id}
              className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  {template.kind === 'project' ? (
                    <Briefcase className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Building2 className="h-4 w-4 text-slate-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">{template.name}</p>
                    <KindBadge kind={template.kind} />
                    {template.isDefault && (
                      <span className="inline-flex shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        Org default
                      </span>
                    )}
                    {isPlatform && (
                      <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Platform
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="truncate text-xs text-slate-500">{template.description}</p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleEdit(template)}
                  disabled={loadingId === template.id}
                  title={isPlatform ? 'View template' : 'Edit template'}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {!isPlatform && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleArchive(template)}
                    disabled={archivingId === template.id}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    title="Archive template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <SetPageHeader>
        <AdminPageHeader
          icon={ListTree}
          title="Filesystem Templates"
          description="Company templates set up the organisation document library. Project templates define the folder structure for each job."
        />
      </SetPageHeader>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={handleCreate}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Plus className="h-3.5 w-3.5" />
          New Template
        </Button>
      </SetHeaderActions>

      {templates.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <ListTree className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No filesystem templates configured.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Company</h3>
              <p className="text-xs text-slate-500">
                Used for Admin → Filesystem Categories (org filesystem).
              </p>
            </div>
            {renderList(company, 'No company templates yet.')}
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Project</h3>
              <p className="text-xs text-slate-500">
                Used when a job gets its own document filesystem (Jobs → Documents).
              </p>
            </div>
            {renderList(project, 'No project templates yet.')}
          </Card>
        </div>
      )}

      <FilesystemTemplateDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditTemplate(null);
        }}
        template={editTemplate}
        onSaved={handleSaved}
      />
    </>
  );
}
