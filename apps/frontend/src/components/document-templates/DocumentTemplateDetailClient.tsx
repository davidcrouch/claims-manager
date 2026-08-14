'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileCode2,
  FileText,
  Files,
  FolderOpen,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import type {
  DocumentTemplateSetting,
  DocumentTemplatesFolderSetting,
  FilesystemCategory,
  FSDocument,
} from '@/lib/api-client';

function collectFolderAndDescendantIds(
  categories: FilesystemCategory[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string | null, FilesystemCategory[]>();
  for (const cat of categories) {
    const key = cat.parentCategoryId;
    const list = childrenByParent.get(key) ?? [];
    list.push(cat);
    childrenByParent.set(key, list);
  }

  const ids = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return ids;
}

export interface DocumentTemplateDetailClientProps {
  setting: DocumentTemplateSetting;
  docxDocuments: FSDocument[];
  companyCategories?: FilesystemCategory[];
  folderSetting?: DocumentTemplatesFolderSetting | null;
}

export function DocumentTemplateDetailClient({
  setting: initialSetting,
  docxDocuments = [],
  companyCategories = [],
  folderSetting: initialFolder,
}: DocumentTemplateDetailClientProps) {
  const [setting, setSetting] = useState(initialSetting);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('transform');

  const folderCategoryIds = useMemo(() => {
    const rootId = initialFolder?.filesystemCategoryId;
    if (!rootId) return null;
    return collectFolderAndDescendantIds(companyCategories, rootId);
  }, [companyCategories, initialFolder?.filesystemCategoryId]);

  const visibleDocx = useMemo(() => {
    if (!folderCategoryIds) return docxDocuments;
    return docxDocuments.filter(
      (doc) =>
        doc.filesystemCategoryId != null &&
        folderCategoryIds.has(doc.filesystemCategoryId),
    );
  }, [docxDocuments, folderCategoryIds]);

  const docItems = useMemo(() => {
    const items = Object.fromEntries(
      visibleDocx.map((doc) => [doc.id, doc.fileName]),
    ) as Record<string, string>;
    if (setting.filesystemDocument && !items[setting.filesystemDocument.id]) {
      items[setting.filesystemDocument.id] = setting.filesystemDocument.fileName;
    }
    return items;
  }, [visibleDocx, setting.filesystemDocument]);

  const folderPath = initialFolder?.folder?.path?.trim() || null;
  const isDefault = setting.documentType === 'default';
  const selectedId = setting.filesystemDocument?.id ?? '';

  async function refreshSetting() {
    const res = await fetch('/api/document-templates');
    if (!res.ok) throw new Error('Failed to refresh template settings');
    const data = (await res.json()) as DocumentTemplateSetting[];
    const next = data.find((row) => row.documentType === setting.documentType);
    if (!next) throw new Error('Template scenario no longer available');
    setSetting(next);
  }

  async function handleAssign(filesystemDocumentId: string) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/document-templates/${encodeURIComponent(setting.documentType)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filesystemDocumentId }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to assign template');
      }
      await refreshSetting();
      toast.success('Template assigned');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign template');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/document-templates/${encodeURIComponent(setting.documentType)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to clear template');
      }
      await refreshSetting();
      toast.success('Template cleared');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Files}
          title={setting.label}
          total={0}
          accent="slate"
          stats={[
            {
              label: 'Type',
              value: setting.documentType,
            },
            {
              label: 'Template',
              value: setting.filesystemDocument ? 'Assigned' : 'Not set',
            },
          ]}
        />
      </SetPageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <Link
          href="/admin/document-templates"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to document templates
        </Link>

        <p className="mb-5 max-w-3xl text-sm text-slate-500">{setting.description}</p>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(String(val))}
          className="gap-4"
        >
          <TabsList variant="line" className="w-full max-w-md">
            <TabsTrigger value="transform" className="flex-1 gap-1.5">
              <FileCode2 className="size-3.5" />
              Transform
            </TabsTrigger>
            <TabsTrigger value="template" className="flex-1 gap-1.5">
              <FileText className="size-3.5" />
              Template
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transform" className="outline-none">
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-6">
              <h2 className="text-sm font-semibold text-slate-900">Data transform</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Maps {isDefault ? 'fallback' : setting.label.toLowerCase()} record data into
                merge fields used by the Word template (for example{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                  {'{{company_name}}'}
                </code>
                ). Custom transform editing will live here.
              </p>
              <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                <FileCode2 className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">
                  Transform configuration
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  No custom transform is configured for this scenario yet. Generation uses the
                  built-in data mapper.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="template" className="outline-none">
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-6">
              <h2 className="text-sm font-semibold text-slate-900">Word template</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Assign the .docx file used when generating this document
                {isDefault
                  ? '. This fallback is used whenever a scenario has no dedicated file.'
                  : '.'}{' '}
                Upload files in{' '}
                <Link
                  href="/documents"
                  className="text-slate-900 underline underline-offset-2"
                >
                  Documents
                </Link>
                {folderPath ? (
                  <>
                    {' '}
                    under <span className="font-medium text-slate-700">{folderPath}</span>
                  </>
                ) : null}
                .
              </p>

              {folderPath && initialFolder?.filesystemCategoryId ? (
                <Link
                  href={`/documents?categoryId=${encodeURIComponent(initialFolder.filesystemCategoryId)}`}
                  className="mt-4 inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-100"
                  title={`Open ${folderPath} in Documents`}
                >
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="truncate">{folderPath}</span>
                </Link>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Select
                  value={selectedId || undefined}
                  onValueChange={(value) => {
                    if (value) void handleAssign(value);
                  }}
                  items={docItems}
                  disabled={saving || visibleDocx.length === 0}
                >
                  <SelectTrigger size="sm" className="w-64 max-w-full">
                    <SelectValue placeholder="Select .docx…" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleDocx.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.fileName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {setting.filesystemDocument ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleClear()}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <X className="mr-1 h-3.5 w-3.5" />
                        Clear
                      </>
                    )}
                  </Button>
                ) : null}
              </div>

              {visibleDocx.length === 0 ? (
                <p className="mt-4 text-sm text-amber-800">
                  No .docx files found
                  {folderPath ? ' in the selected templates folder' : ' in the filesystem'}.
                  Upload a Word template in Documents, then return here to assign it.
                </p>
              ) : setting.filesystemDocument ? (
                <p className="mt-4 text-sm text-slate-600">
                  Current file:{' '}
                  <span className="font-medium text-slate-900">
                    {setting.filesystemDocument.fileName}
                  </span>
                </p>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No template assigned.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
