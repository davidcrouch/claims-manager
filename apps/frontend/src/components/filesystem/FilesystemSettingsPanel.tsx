'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Briefcase,
  Building2,
  FolderCog,
  FolderOpen,
  FolderTree,
  Loader2,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
  BottomFormDrawerError,
} from '@/components/forms/BottomFormDrawer';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { FilesystemEditorPanel } from './FilesystemEditorPanel';
import { ArtifactExportDefaultsPanel } from './ArtifactExportDefaultsPanel';
import { ProjectFolderMappingsPanel } from './ProjectFolderMappingsPanel';
import { PipelineEditorPanel } from './PipelineEditorPanel';
import { buildCategoryTree, flattenCategoryTree } from './CategoryTreeEditor';
import type {
  FilesystemDefaultsResponse,
  FilesystemResponse,
  FilesystemTemplate,
  FilesystemCategoryNode,
} from '@/lib/api-client';

type DocCategoriesTab = 'company' | 'project';

const TABS: Array<{ id: DocCategoriesTab; label: string; icon: typeof Building2 }> = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'project', label: 'Project', icon: Briefcase },
];

interface FilesystemSettingsPanelProps {
  initialFilesystem?: FilesystemResponse | null;
  initialTemplates?: FilesystemTemplate[];
  initialProjectTemplates?: FilesystemTemplate[];
  initialDefaults?: FilesystemDefaultsResponse | null;
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

function sortTemplates(templates: FilesystemTemplate[]): FilesystemTemplate[] {
  return [...templates].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

function preferTemplateId(
  preferred: string | null | undefined,
  templates: FilesystemTemplate[],
): string {
  if (preferred && templates.some((t) => t.id === preferred)) return preferred;
  return templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? '';
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
  initialProjectTemplates,
  initialDefaults,
}: FilesystemSettingsPanelProps) {
  const [filesystem, setFilesystem] = useState<FilesystemResponse | null>(
    initialFilesystem ?? null,
  );
  const [companyTemplates, setCompanyTemplates] = useState<FilesystemTemplate[]>(() =>
    sortTemplates(
      (initialTemplates ?? []).filter((t) => (t.kind ?? 'company') === 'company'),
    ),
  );
  const [projectTemplates, setProjectTemplates] = useState<FilesystemTemplate[]>(() =>
    sortTemplates(initialProjectTemplates ?? []),
  );
  const [defaults, setDefaults] = useState<FilesystemDefaultsResponse | null>(
    initialDefaults ?? null,
  );
  const [companyTemplateId, setCompanyTemplateId] = useState(() =>
    preferTemplateId(
      initialDefaults?.defaultCompanyTemplateId ?? initialFilesystem?.sourceTemplateId,
      companyTemplates,
    ),
  );
  const [projectTemplateId, setProjectTemplateId] = useState(() =>
    preferTemplateId(initialDefaults?.defaultProjectTemplateId, projectTemplates),
  );
  const [loading, setLoading] = useState(
    !initialFilesystem && !initialTemplates && !initialProjectTemplates,
  );
  const [settingUp, setSettingUp] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [projectEditorOpen, setProjectEditorOpen] = useState(false);
  const [openingProjectEditor, setOpeningProjectEditor] = useState(false);
  const [companyCategoryTree, setCompanyCategoryTree] = useState<FilesystemCategoryNode[]>([]);
  const [loadingCompanyCategories, setLoadingCompanyCategories] = useState(false);
  const [projectCategoryTree, setProjectCategoryTree] = useState<FilesystemCategoryNode[]>([]);
  const [projectTemplateIsPlatform, setProjectTemplateIsPlatform] = useState(true);
  const [loadingProjectCategories, setLoadingProjectCategories] = useState(false);
  const [activeTab, setActiveTab] = useState<DocCategoriesTab>('company');

  useEffect(() => {
    if (initialFilesystem !== undefined) return;

    (async () => {
      try {
        const [fsRes, companyRes, projectRes, defaultsRes] = await Promise.all([
          fetch('/api/filesystems/company').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/filesystem-templates?kind=company').then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch('/api/filesystem-templates?kind=project').then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch('/api/filesystems/defaults').then((r) => (r.ok ? r.json() : null)),
        ]);
        const company = sortTemplates(normalizeTemplates(companyRes));
        const project = sortTemplates(normalizeTemplates(projectRes));
        const nextDefaults = (defaultsRes as FilesystemDefaultsResponse | null) ?? null;
        setFilesystem(fsRes);
        setCompanyTemplates(company);
        setProjectTemplates(project);
        setDefaults(nextDefaults);
        setCompanyTemplateId(
          preferTemplateId(
            nextDefaults?.defaultCompanyTemplateId ?? fsRes?.sourceTemplateId,
            company,
          ),
        );
        setProjectTemplateId(preferTemplateId(nextDefaults?.defaultProjectTemplateId, project));
      } catch {
        toast.error('Failed to load filesystem settings');
      } finally {
        setLoading(false);
      }
    })();
  }, [initialFilesystem]);

  useEffect(() => {
    if (!companyTemplateId) {
      setCompanyCategoryTree([]);
      setLoadingCompanyCategories(false);
      return;
    }

    let cancelled = false;
    setLoadingCompanyCategories(true);
    setCompanyCategoryTree([]);
    (async () => {
      try {
        const res = await fetch(`/api/filesystem-templates/${companyTemplateId}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load template');
        const full = (await res.json()) as FilesystemTemplate;
        if (cancelled) return;
        setCompanyCategoryTree(buildCategoryTree(full.categories ?? []));
      } catch {
        if (!cancelled) {
          setCompanyCategoryTree([]);
          toast.error('Failed to load company template categories');
        }
      } finally {
        if (!cancelled) setLoadingCompanyCategories(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyTemplateId]);

  useEffect(() => {
    if (!projectTemplateId) {
      setProjectCategoryTree([]);
      setProjectTemplateIsPlatform(true);
      return;
    }

    let cancelled = false;
    setLoadingProjectCategories(true);
    setProjectCategoryTree([]);
    (async () => {
      try {
        const res = await fetch(`/api/filesystem-templates/${projectTemplateId}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load template');
        const full = (await res.json()) as FilesystemTemplate;
        if (cancelled) return;
        setProjectCategoryTree(buildCategoryTree(full.categories ?? []));
        setProjectTemplateIsPlatform(full.tenantId == null);
      } catch {
        if (!cancelled) {
          setProjectCategoryTree([]);
          toast.error('Failed to load project template categories');
        }
      } finally {
        if (!cancelled) setLoadingProjectCategories(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectTemplateId]);

  const saveDefaults = useCallback(
    async (patch: {
      defaultCompanyTemplateId?: string | null;
      defaultProjectTemplateId?: string | null;
    }) => {
      const res = await fetch('/api/filesystems/defaults', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message || 'Failed to save template defaults',
        );
      }
      const data = (await res.json()) as FilesystemDefaultsResponse;
      setDefaults(data);
      return data;
    },
    [],
  );

  const handleSetup = useCallback(async () => {
    if (!companyTemplateId) {
      toast.error('Select a company template');
      return;
    }
    if (!projectTemplateId) {
      toast.error('Select a default project template');
      return;
    }

    setSettingUp(true);
    try {
      const res = await fetch('/api/filesystems/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: companyTemplateId }),
      });
      if (!res.ok) throw new Error('Setup failed');
      const data = await res.json();
      await saveDefaults({
        defaultCompanyTemplateId: companyTemplateId,
        defaultProjectTemplateId: projectTemplateId,
      });
      setFilesystem(data);
      toast.success('Filesystem configured successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set up filesystem');
    } finally {
      setSettingUp(false);
    }
  }, [companyTemplateId, projectTemplateId, saveDefaults]);

  const handleSaveCompanyDefault = useCallback(async () => {
    if (!companyTemplateId) {
      toast.error('Select a company template');
      return;
    }
    if (!filesystem?.id) {
      toast.error('Company filesystem is not set up');
      return;
    }

    setSavingDefaults(true);
    try {
      const tplRes = await fetch(`/api/filesystem-templates/${companyTemplateId}`, {
        cache: 'no-store',
      });
      if (!tplRes.ok) throw new Error('Failed to load selected template');
      const tpl = (await tplRes.json()) as FilesystemTemplate;
      const templateCategories = tpl.categories ?? [];

      const idMap = new Map<string, string>();
      for (const cat of templateCategories) {
        idMap.set(cat.id, crypto.randomUUID());
      }
      const categories = templateCategories.map((cat) => ({
        id: idMap.get(cat.id)!,
        parentCategoryId: cat.parentCategoryId
          ? (idMap.get(cat.parentCategoryId) ?? null)
          : null,
        displayName: cat.displayName,
        description: cat.description ?? null,
        slug: cat.slug,
        config: cat.config ?? {},
        sortOrder: cat.sortOrder ?? 0,
      }));

      const replaceRes = await fetch(`/api/filesystems/${filesystem.id}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories }),
      });
      if (!replaceRes.ok) {
        const body = await replaceRes.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message || 'Failed to apply template categories',
        );
      }

      await saveDefaults({ defaultCompanyTemplateId: companyTemplateId });

      const refreshed = await fetch('/api/filesystems/company', { cache: 'no-store' }).then(
        (r) => (r.ok ? r.json() : null),
      );
      if (refreshed) setFilesystem(refreshed);
      setCompanyCategoryTree(buildCategoryTree(templateCategories));

      toast.success('Company folders updated from template');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save company folders');
    } finally {
      setSavingDefaults(false);
    }
  }, [companyTemplateId, filesystem?.id, saveDefaults]);

  const handleSaveProjectDefault = useCallback(async () => {
    if (!projectTemplateId) {
      toast.error('Select a default project template');
      return;
    }
    setSavingDefaults(true);
    try {
      await saveDefaults({ defaultProjectTemplateId: projectTemplateId });
      toast.success('Default project template updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save default');
    } finally {
      setSavingDefaults(false);
    }
  }, [projectTemplateId, saveDefaults]);

  const handleCategoriesSaved = useCallback(
    (updated: FilesystemResponse) => {
      setFilesystem(updated);
      setEditorOpen(false);
      if (
        companyTemplateId &&
        updated.sourceTemplateId &&
        companyTemplateId === updated.sourceTemplateId
      ) {
        setCompanyCategoryTree(buildCategoryTree(updated.categories ?? []));
      }
    },
    [companyTemplateId],
  );

  const applyClonedProjectTemplate = useCallback(
    (cloned: { id: string; name: string; categories?: FilesystemTemplate['categories'] }) => {
      setProjectTemplateId(cloned.id);
      setProjectTemplateIsPlatform(false);
      setProjectTemplates((prev) => {
        if (prev.some((t) => t.id === cloned.id)) return prev;
        return [
          {
            id: cloned.id,
            name: cloned.name,
            description: null,
            kind: 'project' as const,
            isDefault: false,
            createdAt: new Date().toISOString(),
            tenantId: 'local',
          },
          ...prev,
        ];
      });
      setDefaults((prev) =>
        prev
          ? { ...prev, defaultProjectTemplateId: cloned.id }
          : {
              defaultCompanyTemplateId: null,
              defaultProjectTemplateId: cloned.id,
            },
      );
      void fetch('/api/filesystems/defaults', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultProjectTemplateId: cloned.id }),
      });
      if (cloned.categories) {
        setProjectCategoryTree(buildCategoryTree(cloned.categories));
      } else {
        void fetch(`/api/filesystem-templates/${cloned.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((full) => {
            if (!full) return;
            setProjectCategoryTree(buildCategoryTree(full.categories ?? []));
          });
      }
    },
    [],
  );

  const handleOpenProjectCategoryEditor = useCallback(async () => {
    if (!projectTemplateId) {
      toast.error('Select a project template first');
      return;
    }

    if (!projectTemplateIsPlatform) {
      setProjectEditorOpen(true);
      return;
    }

    setOpeningProjectEditor(true);
    try {
      const res = await fetch(`/api/filesystem-templates/${projectTemplateId}/clone`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { message?: string }).message || 'Failed to customize template',
        );
      }
      const cloned = (await res.json()) as FilesystemTemplate;
      applyClonedProjectTemplate(cloned);
      toast.success(`Created editable copy “${cloned.name}”`);
      setProjectEditorOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open category editor');
    } finally {
      setOpeningProjectEditor(false);
    }
  }, [projectTemplateId, projectTemplateIsPlatform, applyClonedProjectTemplate]);

  const handleProjectCategoriesSaved = useCallback((categories: FilesystemCategoryNode[]) => {
    setProjectCategoryTree(categories);
    setProjectEditorOpen(false);
  }, []);

  if (loading) {
    return (
      <>
        <SetPageHeader>
          <ListPageHeader
            icon={FolderOpen}
            title="Filesystem Categories"
            total={0}
            accent="amber"
          />
        </SetPageHeader>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </>
    );
  }

  if (needsSetup(filesystem)) {
    return (
      <>
        <SetPageHeader>
          <ListPageHeader
            icon={FolderOpen}
            title="Filesystem Categories"
            total={0}
            accent="amber"
          />
        </SetPageHeader>
      <Card className="p-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <FolderCog className="h-7 w-7 text-slate-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Set Up Document Filesystem
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Choose a company template for organisation documents and a default
                project template used when new jobs are created.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-slate-200 p-4">
              <Label htmlFor="company-template">Company folders</Label>
              <select
                id="company-template"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={companyTemplateId}
                onChange={(e) => setCompanyTemplateId(e.target.value)}
                disabled={settingUp || companyTemplates.length === 0}
              >
                {companyTemplates.length === 0 ? (
                  <option value="">No company templates available</option>
                ) : (
                  companyTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.isDefault ? ' (default)' : ''}
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-slate-500">
                Applied now for organisation-wide filesystem categories.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 p-4">
              <Label htmlFor="project-template">Default project folders</Label>
              <select
                id="project-template"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={projectTemplateId}
                onChange={(e) => setProjectTemplateId(e.target.value)}
                disabled={settingUp || projectTemplates.length === 0}
              >
                {projectTemplates.length === 0 ? (
                  <option value="">No project templates available</option>
                ) : (
                  projectTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.isDefault ? ' (default)' : ''}
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-slate-500">
                Used when creating jobs; each job gets its own copy of the folder tree.
              </p>
            </div>
          </div>

          <Button
            onClick={handleSetup}
            disabled={
              settingUp || !companyTemplateId || !projectTemplateId
            }
            className="w-full"
          >
            {settingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {settingUp ? 'Setting up…' : 'Set up filesystem'}
          </Button>
        </div>
      </Card>
      </>
    );
  }

  const liveCategoryTree = buildCategoryTree(filesystem!.categories);
  const categoryCount = countCategories(companyCategoryTree);
  const projectCategoryCount = countCategories(projectCategoryTree);
  const selectedCompanyName =
    companyTemplates.find((t) => t.id === companyTemplateId)?.name ?? 'Not set';
  const selectedProjectName =
    projectTemplates.find((t) => t.id === projectTemplateId)?.name ?? 'Not set';
  const companyDefaultDirty =
    companyTemplateId !== (defaults?.defaultCompanyTemplateId ?? '') &&
    !!companyTemplateId;
  const projectDefaultDirty =
    projectTemplateId !== (defaults?.defaultProjectTemplateId ?? '') &&
    !!projectTemplateId;

  return (
    <>
      <SetPageHeader>
        <ListPageHeader
          icon={FolderOpen}
          title="Filesystem Categories"
          total={0}
          accent="amber"
        />
      </SetPageHeader>

      <div className="mb-4 flex items-center border-b border-slate-200">
        <div className="flex flex-wrap gap-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-4 py-3 text-sm font-medium transition-colors -mb-px ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full">
        {activeTab === 'company' ? (
          <Card className="flex flex-col p-6">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              <div className="min-w-0 space-y-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">
                    Company filesystem categories
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Organisation-wide folders
                    {selectedCompanyName !== 'Not set' && (
                      <>
                        {' · '}
                        <span className="font-medium text-slate-700">{selectedCompanyName}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="default-company-template">Company folders</Label>
                    <select
                      id="default-company-template"
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={companyTemplateId}
                      onChange={(e) => setCompanyTemplateId(e.target.value)}
                      disabled={savingDefaults || companyTemplates.length === 0}
                    >
                      {companyTemplates.length === 0 ? (
                        <option value="">No company templates available</option>
                      ) : (
                        companyTemplates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                            {tpl.isDefault ? ' (platform default)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pb-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditorOpen(true)}
                      className="gap-1.5"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Edit Categories
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveCompanyDefault}
                      disabled={savingDefaults || !companyTemplateId || !companyDefaultDirty}
                    >
                      {savingDefaults && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {!loadingCompanyCategories && companyTemplateId
                    ? `${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'} in this template · Save applies them to the live company filesystem`
                    : '\u00a0'}
                </p>

                <div className="border-t border-slate-100 pt-4">
                  {loadingCompanyCategories ? (
                    <div className="flex h-40 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <CategoryTreeSummary
                      key={companyTemplateId || 'company-categories'}
                      categories={companyCategoryTree}
                      emptyMessage="Select a company template to preview its folders."
                    />
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-5 border-t border-slate-100 pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                <PipelineEditorPanel filesystemId={filesystem!.id} />
                <div className="border-t border-slate-100 pt-5">
                  <ArtifactExportDefaultsPanel
                    key={filesystem!.id + ':' + (filesystem!.categories?.length ?? 0)}
                    categories={liveCategoryTree}
                    scope="company"
                  />
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="flex flex-col p-6">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              <div className="min-w-0 space-y-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">
                    Project filesystem categories
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Prefills folder categories and pipelines when creating jobs
                    {selectedProjectName !== 'Not set' && (
                      <>
                        {' · '}
                        <span className="font-medium text-slate-700">{selectedProjectName}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="default-project-template">Project folders</Label>
                    <select
                      id="default-project-template"
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={projectTemplateId}
                      onChange={(e) => setProjectTemplateId(e.target.value)}
                      disabled={savingDefaults || projectTemplates.length === 0}
                    >
                      {projectTemplates.length === 0 ? (
                        <option value="">No project templates available</option>
                      ) : (
                        projectTemplates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                            {tpl.isDefault ? ' (platform default)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pb-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleOpenProjectCategoryEditor}
                      disabled={!projectTemplateId || openingProjectEditor || loadingProjectCategories}
                      className="gap-1.5"
                    >
                      {openingProjectEditor ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Settings2 className="h-3.5 w-3.5" />
                      )}
                      Edit Categories
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveProjectDefault}
                      disabled={savingDefaults || !projectTemplateId || !projectDefaultDirty}
                    >
                      {savingDefaults && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </div>
                {!loadingProjectCategories && projectTemplateId && (
                  <p className="text-xs text-slate-500">
                    {projectCategoryCount}{' '}
                    {projectCategoryCount === 1 ? 'category' : 'categories'} in this template
                  </p>
                )}

                <div className="border-t border-slate-100 pt-4">
                  {loadingProjectCategories ? (
                    <div className="flex h-40 items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <CategoryTreeSummary
                      categories={projectCategoryTree}
                      emptyMessage="Select a project template, then click “Edit Categories” to get started."
                    />
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-5 border-t border-slate-100 pt-4 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0">
                {projectTemplateId && !loadingProjectCategories && (
                  <>
                    <PipelineEditorPanel
                      templateId={projectTemplateId}
                      isPlatformTemplate={projectTemplateIsPlatform}
                      onTemplateCloned={applyClonedProjectTemplate}
                    />
                    <div className="border-t border-slate-100 pt-5">
                      <ArtifactExportDefaultsPanel
                        categories={projectCategoryTree}
                        scope="project"
                        valueMode="slug"
                        templateId={projectTemplateId}
                      />
                    </div>
                    <div className="border-t border-slate-100 pt-5">
                      <ProjectFolderMappingsPanel
                        categories={projectCategoryTree}
                        templateId={projectTemplateId}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      <CategoryEditorDrawer
        filesystem={filesystem!}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={handleCategoriesSaved}
      />

      {projectTemplateId && (
        <TemplateCategoryEditorDrawer
          templateId={projectTemplateId}
          templateName={selectedProjectName}
          categories={projectCategoryTree}
          open={projectEditorOpen}
          onOpenChange={setProjectEditorOpen}
          onSaved={handleProjectCategoriesSaved}
        />
      )}
    </>
  );
}

function CategoryTreeSummary({
  categories,
  depth = 0,
  emptyMessage = 'No categories yet. Click “Edit Categories” to get started.',
}: {
  categories: FilesystemCategoryNode[];
  depth?: number;
  emptyMessage?: string;
}) {
  if (categories.length === 0 && depth === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-400">
        {emptyMessage}
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

      const refreshed = await fetch('/api/filesystems/company').then((r) =>
        r.ok ? r.json() : null,
      );
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

function TemplateCategoryEditorDrawer({
  templateId,
  templateName,
  categories: initialCategories,
  open,
  onOpenChange,
  onSaved,
}: {
  templateId: string;
  templateName: string;
  categories: FilesystemCategoryNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (categories: FilesystemCategoryNode[]) => void;
}) {
  const [categories, setCategories] = useState<FilesystemCategoryNode[]>(initialCategories);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategories(initialCategories);
      setError(null);
    }
  }, [open, initialCategories]);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const flat = flattenCategoryTree(categories);
      const res = await fetch(`/api/filesystem-templates/${templateId}/categories`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: flat }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || 'Failed to save categories');
      }

      const refreshed = await fetch(`/api/filesystem-templates/${templateId}`).then((r) =>
        r.ok ? r.json() : null,
      );
      const next = buildCategoryTree(
        (refreshed as FilesystemTemplate | null)?.categories ??
          flat.map((c) => ({
            ...c,
            id: c.id ?? crypto.randomUUID(),
            parentCategoryId: c.parentCategoryId ?? null,
          })),
      );
      onSaved(next);
      toast.success('Project categories updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save category changes';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [categories, templateId, onSaved]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Categories"
      description={templateName}
      icon={<FolderTree className="h-5 w-5" />}
    >
      <BottomFormDrawerBody className="h-full !px-0 !py-0">
        <FilesystemEditorPanel
          categories={categories}
          onCategoriesChange={setCategories}
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
