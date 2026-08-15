'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertCircle,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Save,
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
import type {
  DocumentTemplateSetting,
  DocumentTemplatesFolderSetting,
  FilesystemCategory,
  FSDocument,
} from '@/lib/api-client';
import {
  TemplateEditorProvider,
  useTemplateEditor,
} from './TemplateEditorContext';
import { TemplateContentEditor } from './TemplateContentEditor';
import { TemplateAIAssistButton } from './TemplateAIAssist';
import { TemplateMergeTagPanel } from './TemplateMergeTagPanel';
import { TemplateTestPanel } from './TemplateTestPanel';

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

export interface TemplateEditorTabProps {
  setting: DocumentTemplateSetting;
  docxDocuments: FSDocument[];
  companyCategories?: FilesystemCategory[];
  folderSetting?: DocumentTemplatesFolderSetting | null;
  onSettingChange: (next: DocumentTemplateSetting) => void;
}

export function TemplateEditorTab({
  setting,
  docxDocuments = [],
  companyCategories = [],
  folderSetting,
  onSettingChange,
}: TemplateEditorTabProps) {
  return (
    <TemplateEditorProvider documentType={setting.documentType}>
      <TemplateEditorTabInner
        setting={setting}
        docxDocuments={docxDocuments}
        companyCategories={companyCategories}
        folderSetting={folderSetting}
        onSettingChange={onSettingChange}
      />
    </TemplateEditorProvider>
  );
}

function TemplateEditorTabInner({
  setting,
  docxDocuments,
  companyCategories = [],
  folderSetting,
  onSettingChange,
}: TemplateEditorTabProps) {
  const {
    loading,
    saving,
    error,
    dirty,
    hasTemplate,
    fileName,
    save,
    reload,
  } = useTemplateEditor();

  const [assigning, setAssigning] = useState(false);

  const folderCategoryIds = useMemo(() => {
    const rootId = folderSetting?.filesystemCategoryId;
    if (!rootId) return null;
    return collectFolderAndDescendantIds(companyCategories, rootId);
  }, [companyCategories, folderSetting?.filesystemCategoryId]);

  const visibleDocx = useMemo(() => {
    if (!folderCategoryIds) return docxDocuments;
    return docxDocuments.filter(
      (doc) =>
        doc.filesystemCategoryId != null &&
        folderCategoryIds.has(doc.filesystemCategoryId),
    );
  }, [docxDocuments, folderCategoryIds]);

  const selectedId = setting.filesystemDocument?.id ?? '';
  const isDefault = setting.documentType === 'default';
  const folderPath = folderSetting?.folder?.path?.trim() || null;

  async function refreshSetting() {
    const res = await fetch('/api/document-templates');
    if (!res.ok) throw new Error('Failed to refresh template settings');
    const data = (await res.json()) as DocumentTemplateSetting[];
    const next = data.find((row) => row.documentType === setting.documentType);
    if (!next) throw new Error('Template scenario no longer available');
    onSettingChange(next);
  }

  async function handleAssign(filesystemDocumentId: string) {
    setAssigning(true);
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
      await reload();
      toast.success('Template assigned');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign template');
    } finally {
      setAssigning(false);
    }
  }

  async function handleClear() {
    setAssigning(true);
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
      await reload();
      toast.success('Template cleared');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear template');
    } finally {
      setAssigning(false);
    }
  }

  async function handleSave() {
    try {
      await save();
      toast.success('Template saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading template…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3">
        <AlertCircle className="size-4 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-3">
          <FileText className="size-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Word template</h2>

          {hasTemplate && fileName && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {fileName}
            </span>
          )}
          {dirty && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Unsaved
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Template assignment */}
          <Select
            value={selectedId || undefined}
            onValueChange={(value) => {
              if (value) void handleAssign(value);
            }}
            disabled={assigning || visibleDocx.length === 0}
          >
            <SelectTrigger size="sm" className="w-52 max-w-full">
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

          {setting.filesystemDocument && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={assigning}
              onClick={() => void handleClear()}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          )}

          <div className="h-4 w-px bg-slate-200" />

          <TemplateAIAssistButton />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void reload()}
            disabled={saving}
          >
            <RefreshCw className="mr-1 size-3.5" />
            Reload
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Save className="mr-1 size-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Info bar */}
      {!hasTemplate && (
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <p className="max-w-2xl text-sm text-slate-500">
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

          {folderPath && folderSetting?.filesystemCategoryId ? (
            <Link
              href={`/documents?categoryId=${encodeURIComponent(folderSetting.filesystemCategoryId)}`}
              className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-50"
              title={`Open ${folderPath} in Documents`}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate">{folderPath}</span>
            </Link>
          ) : null}

          {visibleDocx.length === 0 && (
            <p className="mt-3 text-sm text-amber-800">
              No .docx files found
              {folderPath ? ' in the selected templates folder' : ' in the filesystem'}.
              Upload a Word template in Documents, then return here to assign it.
            </p>
          )}
        </div>
      )}

      {/* Two-panel layout: Editor + Sidebar */}
      <div className="flex divide-x divide-slate-200" style={{ height: '600px' }}>
        {/* Left: contentEditable editor */}
        <div className="flex-3 overflow-hidden">
          <TemplateContentEditor />
        </div>

        {/* Right: sidebar with merge tags + test */}
        <div className="flex flex-2 flex-col overflow-y-auto p-4">
          <TemplateMergeTagPanel className="mb-6" />
          <div className="border-t border-slate-200 pt-4">
            <TemplateTestPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
