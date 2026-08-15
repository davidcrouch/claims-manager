'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Briefcase,
  Building2,
  CheckSquare,
  FileText,
  Files,
  FolderOpen,
  Loader2,
  Pencil,
  TrendingUp,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { TemplatesFolderPickerDialog } from '@/components/document-templates/TemplatesFolderPickerDialog';
import type {
  DocumentTemplateSetting,
  DocumentTemplatesFolderSetting,
  FilesystemCategory,
  FSDocument,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface DocumentTemplatesSettingsPanelProps {
  initialSettings: DocumentTemplateSetting[];
  docxDocuments: FSDocument[];
  companyCategories?: FilesystemCategory[];
  initialFolder?: DocumentTemplatesFolderSetting | null;
}

function resolveFolderPath(
  categories: FilesystemCategory[],
  categoryId: string | null | undefined,
): string | null {
  if (!categoryId) return null;
  const byId = new Map(categories.map((cat) => [cat.id, cat]));
  const current = byId.get(categoryId);
  if (!current) return null;

  const parts: string[] = [];
  let node: FilesystemCategory | undefined = current;
  const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    parts.unshift(node.displayName);
    node = node.parentCategoryId ? byId.get(node.parentCategoryId) : undefined;
  }
  return parts.join(' / ');
}

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

interface TemplateGroupDef {
  id: string;
  label: string;
  icon: LucideIcon;
  types: string[];
}

const TEMPLATE_GROUPS: TemplateGroupDef[] = [
  {
    id: 'general',
    label: 'General',
    icon: Files,
    types: ['default'],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Briefcase,
    types: [
      'claim',
      'claims_list',
      'job_details',
      'scope_of_work',
      'jobs_list',
      'journal',
      'journals_list',
      'assessment',
      'assessments_list',
      'quote',
      'quotes_list',
      'work_order',
      'work_orders_list',
      'invoice',
      'invoices_list',
    ],
  },
  {
    id: 'vendors',
    label: 'Vendors',
    icon: Building2,
    types: [
      'rfq',
      'rfqs_list',
      'proposal',
      'proposals_list',
      'purchase_order',
      'purchase_orders_list',
      'bill',
      'bills_list',
      'vendor',
      'vendors_list',
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: CheckSquare,
    types: [
      'task',
      'tasks_list',
      'appointment',
      'appointments_list',
      'schedule_list',
      'message',
      'messages_list',
      'contact',
      'contacts_list',
      'document',
      'documents_list',
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: TrendingUp,
    types: ['report', 'reports_list'],
  },
];

const TYPE_GROUP_META = new Map(
  TEMPLATE_GROUPS.flatMap((group) =>
    group.types.map((type, order) => [type, { groupId: group.id, order }] as const),
  ),
);

function isListType(documentType: string): boolean {
  return documentType.endsWith('_list');
}

export function DocumentTemplatesSettingsPanel({
  initialSettings,
  docxDocuments = [],
  companyCategories = [],
  initialFolder,
}: DocumentTemplatesSettingsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [folderSetting, setFolderSetting] = useState<DocumentTemplatesFolderSetting>(
    () => ({
      filesystemCategoryId: initialFolder?.filesystemCategoryId ?? null,
      folder: initialFolder?.folder ?? null,
    }),
  );
  const [folderBusy, setFolderBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const folderCategoryIds = useMemo(() => {
    const rootId = folderSetting?.filesystemCategoryId;
    if (!rootId) return null;
    return collectFolderAndDescendantIds(companyCategories, rootId);
  }, [companyCategories, folderSetting?.filesystemCategoryId]);

  const folderPath = useMemo(() => {
    const fromSetting = folderSetting?.folder?.path?.trim();
    if (fromSetting) return fromSetting;
    return resolveFolderPath(companyCategories, folderSetting?.filesystemCategoryId);
  }, [companyCategories, folderSetting?.folder?.path, folderSetting?.filesystemCategoryId]);

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
    for (const row of settings) {
      if (row.filesystemDocument && !items[row.filesystemDocument.id]) {
        items[row.filesystemDocument.id] = row.filesystemDocument.fileName;
      }
    }
    return items;
  }, [visibleDocx, settings]);

  const assignedCount = useMemo(
    () => settings.filter((row) => row.filesystemDocument).length,
    [settings],
  );

  const grouped = useMemo(() => {
    const byGroup = new Map<string, DocumentTemplateSetting[]>();
    for (const group of TEMPLATE_GROUPS) {
      byGroup.set(group.id, []);
    }
    byGroup.set('other', []);

    for (const row of settings) {
      const meta = TYPE_GROUP_META.get(row.documentType);
      byGroup.get(meta?.groupId ?? 'other')!.push(row);
    }

    for (const group of TEMPLATE_GROUPS) {
      byGroup.get(group.id)!.sort((a, b) => {
        const aOrder = TYPE_GROUP_META.get(a.documentType)?.order ?? 0;
        const bOrder = TYPE_GROUP_META.get(b.documentType)?.order ?? 0;
        return aOrder - bOrder;
      });
    }

    const sections = TEMPLATE_GROUPS.map((group) => {
      const rows = byGroup.get(group.id)!;
      return {
        ...group,
        listRows: rows.filter((row) => isListType(row.documentType)),
        detailRows: rows.filter((row) => !isListType(row.documentType)),
      };
    }).filter((group) => group.listRows.length + group.detailRows.length > 0);

    const otherRows = byGroup.get('other')!;
    if (otherRows.length > 0) {
      sections.push({
        id: 'other',
        label: 'Other',
        icon: FileText,
        types: [],
        listRows: otherRows.filter((row) => isListType(row.documentType)),
        detailRows: otherRows.filter((row) => !isListType(row.documentType)),
      });
    }

    return sections;
  }, [settings]);

  async function refreshSettings() {
    const res = await fetch('/api/document-templates');
    if (!res.ok) throw new Error('Failed to refresh settings');
    const data = (await res.json()) as DocumentTemplateSetting[];
    setSettings(data);
  }

  async function handleAssign(documentType: string, filesystemDocumentId: string) {
    setSavingType(documentType);
    try {
      const res = await fetch(`/api/document-templates/${documentType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filesystemDocumentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to assign template');
      }
      await refreshSettings();
      toast.success('Template assigned');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign template');
    } finally {
      setSavingType(null);
    }
  }

  async function saveFolder(filesystemCategoryId: string | null) {
    setFolderBusy(true);
    try {
      const res = await fetch('/api/document-templates/folder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filesystemCategoryId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to save templates folder');
      }
      const data = (await res.json()) as DocumentTemplatesFolderSetting | null;
      setFolderSetting({
        filesystemCategoryId: data?.filesystemCategoryId ?? null,
        folder: data?.folder ?? null,
      });
      toast.success(
        filesystemCategoryId ? 'Templates folder updated' : 'Templates folder cleared',
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save templates folder',
      );
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleClear(documentType: string) {
    setSavingType(documentType);
    try {
      const res = await fetch(`/api/document-templates/${documentType}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Failed to clear template');
      }
      await refreshSettings();
      toast.success('Template cleared');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear template');
    } finally {
      setSavingType(null);
    }
  }

  return (
    <>
      <SetPageHeader>
        <ListPageHeader
          icon={Files}
          title="Document Templates"
          total={settings.length}
          accent="slate"
          stats={[
            { label: 'Assigned', value: assignedCount.toLocaleString() },
            {
              label: 'Not set',
              value: (settings.length - assignedCount).toLocaleString(),
            },
          ]}
        />
      </SetPageHeader>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div className="mb-5 inline-flex w-fit max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
          <p className="text-sm font-medium text-slate-900">
            Document Templates Folder Location
          </p>
          {folderPath && folderSetting?.filesystemCategoryId ? (
            <Link
              href={`/documents?categoryId=${encodeURIComponent(folderSetting.filesystemCategoryId)}`}
              className="inline-flex max-w-xs items-center gap-1.5 truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-100"
              title={`Open ${folderPath} in Documents`}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate">{folderPath}</span>
            </Link>
          ) : folderPath ? (
            <span
              className="inline-flex max-w-xs items-center gap-1.5 truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-800"
              title={folderPath}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span className="truncate">{folderPath}</span>
            </span>
          ) : (
            <span className="text-sm text-slate-400">
              {companyCategories.length === 0
                ? 'Company filesystem has no folders yet'
                : folderSetting?.filesystemCategoryId
                  ? 'Selected folder is no longer available'
                  : 'No folder selected'}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={folderBusy || companyCategories.length === 0}
            onClick={() => setPickerOpen(true)}
          >
            <FolderOpen className="mr-1.5 h-4 w-4" />
            Browse…
          </Button>
          {folderSetting?.filesystemCategoryId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={folderBusy}
              onClick={() => void saveFolder(null)}
            >
              {folderBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Clear'
              )}
            </Button>
          )}
        </div>

        <p className="mb-5 max-w-3xl text-sm text-slate-500">
          Assign a Word (.docx) file from the selected folder for each generation scenario.
          The Default template is used whenever a scenario has no dedicated file assigned.
          Upload templates in the{' '}
          <Link href="/documents" className="text-slate-900 underline underline-offset-2">
            Documents
          </Link>{' '}
          browser first.
        </p>

        {visibleDocx.length === 0 && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {folderSetting?.filesystemCategoryId
              ? 'No .docx files found in the selected templates folder. Upload a Word template there, then return here to assign it.'
              : 'No .docx files found in the filesystem. Upload a Word template under Documents, then return here to assign it.'}
          </div>
        )}

        <div className="space-y-8">
          {grouped.map((group) => {
            const Icon = group.icon;
            const total = group.listRows.length + group.detailRows.length;

            return (
              <section key={group.id}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    {group.label}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {total}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <TemplateTable
                    title="List reports"
                    rows={group.listRows}
                    emptyLabel="No list report templates."
                    docItems={docItems}
                    docxDocuments={visibleDocx}
                    savingType={savingType}
                    onAssign={handleAssign}
                    onClear={handleClear}
                  />
                  <TemplateTable
                    title="Detail reports"
                    rows={group.detailRows}
                    emptyLabel="No detail report templates."
                    docItems={docItems}
                    docxDocuments={visibleDocx}
                    savingType={savingType}
                    onAssign={handleAssign}
                    onClear={handleClear}
                  />
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <TemplatesFolderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={companyCategories}
        selectedCategoryId={folderSetting?.filesystemCategoryId ?? null}
        onConfirm={(categoryId) => {
          void saveFolder(categoryId);
        }}
      />
    </>
  );
}

function TemplateTable({
  title,
  rows,
  emptyLabel,
  docItems,
  docxDocuments,
  savingType,
  onAssign,
  onClear,
}: {
  title: string;
  rows: DocumentTemplateSetting[];
  emptyLabel: string;
  docItems: Record<string, string>;
  docxDocuments: FSDocument[];
  savingType: string | null;
  onAssign: (documentType: string, filesystemDocumentId: string) => void;
  onClear: (documentType: string) => void;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-3 py-2" colSpan={2}>
              {title}
              <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                {rows.length}
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-3 py-3 text-sm text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const busy = savingType === row.documentType;
              const selectedId = row.filesystemDocument?.id ?? '';
              const isDefault = row.documentType === 'default';

              return (
                <tr key={row.documentType}>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-medium text-slate-900">{row.label}</span>
                      {isDefault && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          Fallback
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{row.description}</p>
                  </td>
                  <td className="w-[1%] whitespace-nowrap px-3 py-2 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      <Select
                        value={selectedId || undefined}
                        onValueChange={(value) => {
                          if (value) void onAssign(row.documentType, value);
                        }}
                        items={docItems}
                        disabled={busy || docxDocuments.length === 0}
                      >
                        <SelectTrigger size="sm" className="w-44 max-w-full">
                          <SelectValue placeholder="Select .docx…" />
                        </SelectTrigger>
                        <SelectContent>
                          {docxDocuments.map((doc) => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.fileName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {row.filesystemDocument && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          disabled={busy}
                          onClick={() => void onClear(row.documentType)}
                          aria-label={`Clear ${row.label} template`}
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      <Link
                        href={`/admin/document-templates/${encodeURIComponent(row.documentType)}`}
                        aria-label={`Edit ${row.label} template`}
                        className={cn(
                          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                          'shrink-0',
                        )}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
