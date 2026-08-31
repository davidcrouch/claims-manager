'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronDown,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { FolderTreePickerDrawer } from '@/components/shared/FolderTreePickerDrawer';
import { generateAndDownloadDocument } from '@/lib/generate-document';
import type {
  DocumentTemplateSetting,
  DocumentTemplatesFolderSetting,
  FilesystemCategory,
  FilesystemResponse,
  FSDocument,
} from '@/lib/api-client';
import { cn } from '@/lib/utils';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const NO_TEMPLATE_PATTERNS = [
  'No template assigned',
  'configure it under Admin',
  'No filesystem .docx linked',
];

export interface PrintReportTypeOption {
  documentType: string;
  label: string;
  description: string;
  /** When set, overrides the drawer-level entity id for this report type. */
  entityId?: string;
}

export function buildEstimateReportTypes(quoteId: string): PrintReportTypeOption[] {
  return [
    {
      documentType: 'quote',
      label: 'Estimate',
      description: 'Line items, totals, and estimate summary.',
      entityId: quoteId,
    },
    {
      documentType: 'scope_of_work',
      label: 'Scope of Work',
      description: 'Scope names and descriptions from this estimate (no pricing).',
      entityId: quoteId,
    },
  ];
}

export function buildJobReportTypes(
  jobId: string,
  assessments: Array<{ id: string; name?: string | null; updatedAt?: string }> = [],
): PrintReportTypeOption[] {
  const options: PrintReportTypeOption[] = [
    {
      documentType: 'job_details',
      label: 'Job Details',
      description: 'Summary of job status, address, claim, and key dates.',
      entityId: jobId,
    },
  ];

  const latestAssessment = [...assessments].sort(
    (a, b) =>
      new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
  )[0];

  if (latestAssessment) {
    options.push({
      documentType: 'assessment',
      label: 'Assessment Report',
      description: 'Site assessment findings, recommendations, and attendance details.',
      entityId: latestAssessment.id,
    });
  }

  return options;
}

export interface PrintDocumentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: string;
  entityId?: string;
  jobId?: string;
  reportTypes?: readonly PrintReportTypeOption[];
  companionChatOpen?: boolean;
}

function isDocx(doc: FSDocument): boolean {
  return doc.mimeType === DOCX_MIME || doc.fileName.toLowerCase().endsWith('.docx');
}

function isUuid(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
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

function assignedFilesystemDocId(
  settings: DocumentTemplateSetting[],
  documentType: string,
): { id: string; fileName: string; usingDefaultFallback: boolean } | null {
  const typeSetting = settings.find((row) => row.documentType === documentType);
  if (typeSetting?.filesystemDocument) {
    return {
      id: typeSetting.filesystemDocument.id,
      fileName: typeSetting.filesystemDocument.fileName,
      usingDefaultFallback: false,
    };
  }
  const defaultSetting = settings.find((row) => row.documentType === 'default');
  if (defaultSetting?.filesystemDocument) {
    return {
      id: defaultSetting.filesystemDocument.id,
      fileName: defaultSetting.filesystemDocument.fileName,
      usingDefaultFallback: true,
    };
  }
  return null;
}

export function PrintDocumentDrawer({
  open,
  onOpenChange,
  documentType,
  entityId,
  jobId,
  reportTypes,
  companionChatOpen,
}: PrintDocumentDrawerProps) {
  const typeOptions = reportTypes?.length
    ? reportTypes
    : undefined;
  const [selectedType, setSelectedType] = useState(documentType);
  const [loadingContext, setLoadingContext] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<DocumentTemplateSetting[]>([]);
  const [docxDocuments, setDocxDocuments] = useState<FSDocument[]>([]);
  const [templatesFolder, setTemplatesFolder] =
    useState<DocumentTemplatesFolderSetting | null>(null);
  const [companyCategories, setCompanyCategories] = useState<FilesystemCategory[]>(
    [],
  );
  const [jobCategories, setJobCategories] = useState<FilesystemCategory[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [destinationCategoryId, setDestinationCategoryId] = useState<string | null>(
    null,
  );
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [createPdf, setCreatePdf] = useState(false);

  const reset = useCallback(() => {
    setSelectedType(documentType);
    setLoadingContext(false);
    setGenerating(false);
    setError(null);
    setSelectedTemplateId('');
    setDestinationCategoryId(null);
    setFolderPickerOpen(false);
    setCreatePdf(false);
  }, [documentType]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setSelectedType(documentType);
    setDestinationCategoryId(null);
    setError(null);
  }, [open, documentType, reset]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadContext() {
      setLoadingContext(true);
      try {
        const [settingsRes, docsRes, folderRes, companyRes, jobRes] =
          await Promise.all([
            fetch('/api/document-templates'),
            fetch('/api/documents?uploadStatus=complete&limit=200&sort=name'),
            fetch('/api/document-templates/folder'),
            fetch('/api/filesystems/company'),
            jobId
              ? fetch(`/api/filesystems/jobs/${jobId}?ensure=false`)
              : Promise.resolve(null),
          ]);

        const nextSettings = settingsRes.ok
          ? ((await settingsRes.json()) as DocumentTemplateSetting[])
          : [];
        const docsPayload = docsRes.ok
          ? ((await docsRes.json()) as { data?: FSDocument[] })
          : { data: [] };
        const nextFolder = folderRes.ok
          ? ((await folderRes.json()) as DocumentTemplatesFolderSetting)
          : null;
        const companyFs = companyRes.ok
          ? ((await companyRes.json()) as FilesystemResponse | null)
          : null;
        const jobFs =
          jobRes && jobRes.ok
            ? ((await jobRes.json()) as FilesystemResponse | null)
            : null;

        if (cancelled) return;
        setSettings(Array.isArray(nextSettings) ? nextSettings : []);
        setDocxDocuments((docsPayload.data ?? []).filter(isDocx));
        setTemplatesFolder(nextFolder);
        setCompanyCategories(companyFs?.categories ?? []);
        setJobCategories(jobFs?.categories ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load print options',
          );
        }
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [open, jobId]);

  const assigned = useMemo(
    () => assignedFilesystemDocId(settings, selectedType),
    [settings, selectedType],
  );

  const typeMeta = useMemo(() => {
    const fromOptions = typeOptions?.find((opt) => opt.documentType === selectedType);
    if (fromOptions) return fromOptions;
    const fromSettings = settings.find((row) => row.documentType === selectedType);
    return {
      documentType: selectedType,
      label: fromSettings?.label ?? selectedType.replace(/_/g, ' '),
      description: fromSettings?.description ?? 'Generate a document from the assigned template.',
    };
  }, [selectedType, settings, typeOptions]);

  const templateOptions = useMemo(() => {
    const folderRootId = templatesFolder?.filesystemCategoryId;
    const folderIds = folderRootId
      ? collectFolderAndDescendantIds(companyCategories, folderRootId)
      : null;
    const inFolder = folderIds
      ? docxDocuments.filter(
          (doc) =>
            doc.filesystemCategoryId != null &&
            folderIds.has(doc.filesystemCategoryId),
        )
      : docxDocuments;

    const byId = new Map(inFolder.map((doc) => [doc.id, doc]));
    if (assigned && !byId.has(assigned.id)) {
      const extra = docxDocuments.find((doc) => doc.id === assigned.id);
      if (extra) byId.set(extra.id, extra);
    }
    return [...byId.values()].sort((a, b) =>
      a.fileName.localeCompare(b.fileName),
    );
  }, [assigned, companyCategories, docxDocuments, templatesFolder?.filesystemCategoryId]);

  useEffect(() => {
    if (!open || loadingContext) return;
    setSelectedTemplateId(assigned?.id ?? templateOptions[0]?.id ?? '');
  }, [assigned?.id, loadingContext, open, selectedType, templateOptions]);

  const templateItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const doc of templateOptions) {
      let label = doc.fileName;
      if (assigned?.id === doc.id) {
        label += assigned.usingDefaultFallback ? ' (default)' : ' (assigned)';
      }
      items[doc.id] = label;
    }
    return items;
  }, [assigned, templateOptions]);

  const folderSections = useMemo(() => {
    const sections: Array<{ label: string; categories: FilesystemCategory[] }> = [];
    if (companyCategories.length > 0) {
      sections.push({ label: 'Company files', categories: companyCategories });
    }
    if (jobCategories.length > 0) {
      sections.push({ label: 'Job files', categories: jobCategories });
    }
    return sections;
  }, [companyCategories, jobCategories]);

  const destinationLabel = useMemo(() => {
    if (!destinationCategoryId) return 'Download to this computer';
    const jobPath = resolveFolderPath(jobCategories, destinationCategoryId);
    if (jobPath) return `Job files / ${jobPath}`;
    const companyPath = resolveFolderPath(companyCategories, destinationCategoryId);
    if (companyPath) return `Company files / ${companyPath}`;
    return 'Selected folder';
  }, [companyCategories, destinationCategoryId, jobCategories]);

  const selectedTemplateName = useMemo(() => {
    if (!selectedTemplateId) return null;
    return (
      templateOptions.find((doc) => doc.id === selectedTemplateId)?.fileName ??
      assigned?.fileName ??
      null
    );
  }, [assigned?.fileName, selectedTemplateId, templateOptions]);

  function handleOpenChange(next: boolean) {
    if (generating) return;
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleGenerate() {
    if (!selectedTemplateId) {
      setError('Select a document template before generating.');
      return;
    }
    const selectedOption = typeOptions?.find(
      (option) => option.documentType === selectedType,
    );
    const resolvedEntityId = selectedOption?.entityId ?? entityId;
    if (!isUuid(resolvedEntityId)) {
      setError('This report type requires a linked record before it can be generated.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await generateAndDownloadDocument({
        documentType: selectedType,
        entityId: resolvedEntityId,
        filesystemDocumentId: selectedTemplateId,
        destinationCategoryId: destinationCategoryId ?? undefined,
        createPdf,
      });
      const kind = result.format === 'pdf' ? 'PDF' : 'Word document';
      if (result.savedToFolder) {
        toast.success(`${kind} saved to ${destinationLabel}`);
      } else {
        toast.success(`${kind} downloaded`);
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Document generation failed';
      setError(message);
      if (!NO_TEMPLATE_PATTERNS.some((p) => message.includes(p))) {
        toast.error(message);
      }
    } finally {
      setGenerating(false);
    }
  }

  const missingTemplate = !loadingContext && !selectedTemplateId;

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Print report"
      description="Review the report type, template, and where the file will be saved."
      icon={<Printer className="h-5 w-5" />}
      preventClose={generating || folderPickerOpen}
      companionChatOpen={companionChatOpen}
    >
      <BottomFormDrawerBody>
        <div className="mx-auto max-w-xl space-y-5">
          {loadingContext ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading print options…
            </div>
          ) : (
            <>
              {typeOptions && (
                <div className="space-y-2">
                  <Label>Report type</Label>
                  <div className="flex flex-col gap-2" role="radiogroup" aria-label="Report type">
                    {typeOptions.map((option) => {
                      const active = selectedType === option.documentType;
                      return (
                        <button
                          key={option.documentType}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={generating}
                          onClick={() => setSelectedType(option.documentType)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                            active
                              ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                              : 'border-border bg-background hover:bg-muted/50',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                              active
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <FileText className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              {option.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!typeOptions && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p className="font-medium text-foreground">{typeMeta.label}</p>
                  <p className="mt-1 text-muted-foreground">{typeMeta.description}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="print-template">Document template</Label>
                {missingTemplate ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      No Word template is assigned for this report type.
                    </p>
                    <p className="mt-2 text-amber-800/90">
                      Assign a .docx under Admin → Document Templates, or choose another
                      template from the templates folder.
                    </p>
                    <Link
                      href="/admin/document-templates"
                      className="mt-2 inline-block font-medium text-amber-900 underline"
                    >
                      Go to Document Templates
                    </Link>
                  </div>
                ) : (
                  <>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={(value) => setSelectedTemplateId(value ?? '')}
                      disabled={generating}
                      items={templateItems}
                    >
                      <SelectTrigger id="print-template" className="h-9 w-full">
                        <SelectValue placeholder="Select a template">
                          {(selected: string | null) =>
                            selected
                              ? (templateItems[selected] ??
                                selectedTemplateName ??
                                selected)
                              : ''
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {templateOptions.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {templateItems[doc.id] ?? doc.fileName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplateName && (
                      <p className="text-xs text-slate-500">
                        Using{' '}
                        <span className="font-medium text-slate-700">
                          {selectedTemplateName}
                        </span>
                        {assigned?.id === selectedTemplateId && assigned.usingDefaultFallback
                          ? ' — Default template, because this report type has no dedicated assignment.'
                          : assigned?.id === selectedTemplateId
                            ? ' — assigned template for this report type.'
                            : ' — alternate template for this run only.'}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="print-create-pdf"
                  checked={createPdf}
                  disabled={generating}
                  onCheckedChange={(checked) => setCreatePdf(!!checked)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <Label htmlFor="print-create-pdf" className="font-normal">
                    Create PDF
                  </Label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Off by default — generates a Word document. Turn on to also convert to PDF.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="print-destination">Save to folder</Label>
                <Button
                  id="print-destination"
                  type="button"
                  variant="outline"
                  disabled={generating}
                  onClick={() => setFolderPickerOpen(true)}
                  className="h-9 w-full justify-between px-3 font-normal"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {destinationCategoryId ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                    ) : (
                      <Download className="h-4 w-4 shrink-0 text-slate-500" />
                    )}
                    <span className="truncate text-slate-900">{destinationLabel}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                </Button>
                <p className="text-xs text-slate-500">
                  {!destinationCategoryId
                    ? 'No folder selected — the file will download in your browser.'
                    : 'The file will be saved to this folder instead of downloading.'}
                </p>
              </div>
            </>
          )}
        </div>

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={generating}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={generating || loadingContext || missingTemplate}
          onClick={() => void handleGenerate()}
          className="bg-blue-600 text-white hover:bg-blue-500"
        >
          {generating ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Printer className="mr-1.5 h-4 w-4" />
          )}
          {generating
            ? 'Generating…'
            : destinationCategoryId
              ? createPdf
                ? 'Save PDF'
                : 'Save Word'
              : createPdf
                ? 'Download PDF'
                : 'Download Word'}
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>

    <FolderTreePickerDrawer
      open={folderPickerOpen}
      onOpenChange={setFolderPickerOpen}
      title="Save to folder"
      description="Choose a company or job folder, or download the file to this computer."
      sections={folderSections}
      selectedCategoryId={destinationCategoryId}
      allowNone
      noneLabel="Download to this computer"
      onConfirm={setDestinationCategoryId}
    />
    </>
  );
}
