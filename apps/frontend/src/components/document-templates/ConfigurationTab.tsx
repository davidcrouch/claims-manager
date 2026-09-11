'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileText, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FolderTreePickerDrawer,
  type FolderTreeSection,
} from '@/components/shared/FolderTreePickerDrawer';
import type {
  DocumentTemplateSetting,
  DocumentTemplatesFolderSetting,
  FilesystemCategory,
  FilesystemDefaultsResponse,
  FilesystemTemplate,
  FilesystemTemplateCategory,
} from '@/lib/api-client';

const OUTPUT_FORMAT_ITEMS: Record<string, string> = {
  docx: 'Word (.docx)',
  pdf: 'PDF',
};

const COMPANY_SECTION = 'Company folders';
const PROJECT_SECTION = 'Project folders';

function templateCategoriesToPickerCats(
  categories: FilesystemTemplateCategory[],
): FilesystemCategory[] {
  return categories.map((cat) => ({
    id: cat.id,
    filesystemId: cat.templateId,
    parentCategoryId: cat.parentCategoryId,
    displayName: cat.displayName,
    description: cat.description,
    slug: cat.slug,
    config: cat.config ?? {},
    sortOrder: cat.sortOrder,
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
  }));
}

async function loadTemplateCategories(
  templateId: string | null | undefined,
): Promise<FilesystemTemplateCategory[]> {
  if (!templateId) return [];
  const res = await fetch(`/api/filesystem-templates/${templateId}`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const full = (await res.json()) as FilesystemTemplate;
  return Array.isArray(full.categories) ? full.categories : [];
}

export interface ConfigurationTabProps {
  setting: DocumentTemplateSetting;
  companyCategories?: FilesystemCategory[];
  onSettingChange: (next: DocumentTemplateSetting) => void;
}

export function ConfigurationTab({
  setting,
  onSettingChange,
}: ConfigurationTabProps) {
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folderSections, setFolderSections] = useState<FolderTreeSection[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const outputFormat = setting.outputFormat === 'pdf' ? 'pdf' : 'docx';
  const completedFolder: DocumentTemplatesFolderSetting = {
    filesystemCategoryId:
      setting.completedReportsFolder?.filesystemCategoryId ?? null,
    folder: setting.completedReportsFolder?.folder ?? null,
  };

  const hasCompletedFolder = Boolean(
    completedFolder.folder?.slug &&
      (completedFolder.folder.kind === 'company' ||
        completedFolder.folder.kind === 'project'),
  );

  const folderPath = useMemo(() => {
    const folder = completedFolder.folder;
    if (!folder?.slug) return null;
    const name = folder.path?.trim() || folder.displayName || folder.slug;
    if (folder.kind === 'project') return `Project folders / ${name}`;
    if (folder.kind === 'company') return `Company folders / ${name}`;
    return name;
  }, [completedFolder.folder]);

  async function saveConfig(body: {
    outputFormat?: 'docx' | 'pdf';
    completedReportsFolderCategoryId?: string | null;
    completedReportsFolderSlug?: string | null;
    completedReportsFolderKind?: 'company' | 'project' | null;
  }) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/document-templates/${encodeURIComponent(setting.documentType)}/config`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to save configuration');
      }
      const data = (await res.json()) as DocumentTemplateSetting;
      onSettingChange({
        ...setting,
        ...data,
        outputFormat: data.outputFormat ?? setting.outputFormat ?? 'docx',
        completedReportsFolder:
          data.completedReportsFolder ??
          setting.completedReportsFolder ??
          null,
      });
      toast.success('Configuration saved');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save configuration',
      );
    } finally {
      setSaving(false);
    }
  }

  async function openFolderPicker() {
    setLoadingFolders(true);
    try {
      const defaultsRes = await fetch('/api/filesystems/defaults', {
        cache: 'no-store',
      });
      if (!defaultsRes.ok) {
        throw new Error('Failed to load filesystem templates');
      }
      const defaults = (await defaultsRes.json()) as FilesystemDefaultsResponse;

      const [companyTemplateCats, projectTemplateCats] = await Promise.all([
        loadTemplateCategories(defaults.defaultCompanyTemplateId),
        loadTemplateCategories(defaults.defaultProjectTemplateId),
      ]);

      const sections: FolderTreeSection[] = [];
      if (companyTemplateCats.length > 0) {
        sections.push({
          label: COMPANY_SECTION,
          categories: templateCategoriesToPickerCats(companyTemplateCats),
        });
      }
      if (projectTemplateCats.length > 0) {
        sections.push({
          label: PROJECT_SECTION,
          categories: templateCategoriesToPickerCats(projectTemplateCats),
        });
      }

      if (sections.length === 0) {
        toast.error(
          'No company or project folder templates configured yet. Set them under Filesystem settings.',
        );
        return;
      }

      setFolderSections(sections);
      setPickerOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load folders',
      );
    } finally {
      setLoadingFolders(false);
    }
  }

  function handleFolderConfirm(categoryId: string | null) {
    if (!categoryId) {
      void saveConfig({
        completedReportsFolderCategoryId: null,
        completedReportsFolderSlug: null,
        completedReportsFolderKind: null,
      });
      return;
    }

    for (const section of folderSections) {
      const cat = section.categories.find((c) => c.id === categoryId);
      if (!cat) continue;
      const kind = section.label === PROJECT_SECTION ? 'project' : 'company';
      void saveConfig({
        completedReportsFolderKind: kind,
        completedReportsFolderSlug: cat.slug,
        completedReportsFolderCategoryId: null,
      });
      return;
    }

    toast.error('Selected folder was not found in the template lists');
  }

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100">
              <FileText className="h-4 w-4 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                {setting.label}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{setting.description}</p>
              <p className="mt-2 text-xs text-slate-400">
                Type code:{' '}
                <span className="font-mono text-slate-600">
                  {setting.documentType}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-5 py-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="output-format">Default output format</Label>
            <Select
              value={outputFormat}
              onValueChange={(value) => {
                if (value === 'docx' || value === 'pdf') {
                  void saveConfig({ outputFormat: value });
                }
              }}
              items={OUTPUT_FORMAT_ITEMS}
              disabled={saving}
            >
              <SelectTrigger id="output-format" className="w-full max-w-xs">
                <SelectValue placeholder="Choose format…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="docx">Word (.docx)</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Default format when printing or generating this document type. Users
              can still override it for a single run.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Completed reports folder</Label>
            <div className="flex flex-wrap items-center gap-2">
              {folderPath && hasCompletedFolder ? (
                <span
                  className="inline-flex max-w-md items-center gap-1.5 truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-800"
                  title={folderPath}
                >
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate">{folderPath}</span>
                </span>
              ) : (
                <span className="text-sm text-slate-400">No folder selected</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || loadingFolders}
                onClick={() => void openFolderPicker()}
              >
                {loadingFolders ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="mr-1.5 h-4 w-4" />
                )}
                Browse…
              </Button>
              {hasCompletedFolder && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    void saveConfig({
                      completedReportsFolderCategoryId: null,
                      completedReportsFolderSlug: null,
                      completedReportsFolderKind: null,
                    })
                  }
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Clear'
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Choose a folder from the company or project filesystem template.
              The folder slug is saved and resolved against the live company or
              job folder tree when printing.
            </p>
          </div>
        </div>
      </div>

      <FolderTreePickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Select completed reports folder"
        description="Company and project folders come from your filesystem templates. The selected folder slug is matched on the live tree when a report is generated."
        sections={folderSections}
        selectedCategoryId={(() => {
          const slug = completedFolder.folder?.slug;
          const kind = completedFolder.folder?.kind;
          if (!slug || !kind) return null;
          const sectionLabel =
            kind === 'project' ? PROJECT_SECTION : COMPANY_SECTION;
          const section = folderSections.find((s) => s.label === sectionLabel);
          return section?.categories.find((cat) => cat.slug === slug)?.id ?? null;
        })()}
        allowNone
        noneLabel="No default folder"
        onConfirm={handleFolderConfirm}
      />
    </>
  );
}
