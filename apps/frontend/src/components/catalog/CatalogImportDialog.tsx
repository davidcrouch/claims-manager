'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import {
  fetchCatalogsAction,
  createCatalogAction,
  importCatalogCsvAction,
  previewCatalogImportAction,
} from '@/app/(app)/admin/catalog/actions';
import type { Catalog, CatalogType } from '@/types/api';

export interface CatalogImportDialogProps {
  templateCsv: string;
  catalogId?: string;
  catalogType?: CatalogType;
  /** When set, the dialog is controlled and the built-in trigger is hidden. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called after a successful import so the parent can reload line items. */
  onImportComplete?: () => void;
}

type WizardStep = 'catalog' | 'select' | 'review' | 'confirm' | 'importing' | 'report';

interface PreviewRow {
  row: number;
  code: string;
  displayName: string;
  lineItemDescription: string | null;
  kind: string;
  typeCode: string;
  categoryCode: string | null;
  status: 'ok' | 'warning' | 'error' | 'skipped';
  action: 'create' | 'update' | 'skip';
  message?: string;
}

interface PreviewSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  willCreate: number;
  willUpdate: number;
  categoriesToCreate: string[];
  unitsToCreate?: string[];
  rows: PreviewRow[];
}

interface ImportAggregate {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: Array<{ row: number; code: string; status: string; message?: string }>;
}

const STEPS: WizardStep[] = ['catalog', 'select', 'review', 'confirm', 'importing', 'report'];
const STEP_LABELS: Record<WizardStep, string> = {
  catalog: 'Select catalogue',
  select: 'Select file',
  review: 'Review rows',
  confirm: 'Confirm',
  importing: 'Importing',
  report: 'Results',
};

const CHUNK_SIZE = 10_000;

const CATALOG_TYPES: { value: CatalogType; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'crunchwork', label: 'Crunchwork' },
];

export function CatalogImportDialog({
  templateCsv,
  catalogId: initialCatalogId,
  catalogType: initialCatalogType,
  open: openProp,
  onOpenChange,
  onImportComplete,
}: CatalogImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const [step, setStep] = useState<WizardStep>(initialCatalogId ? 'select' : 'catalog');

  // Catalogue selection state
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(initialCatalogId);
  const [selectedCatalogType, setSelectedCatalogType] = useState<CatalogType>(
    initialCatalogType ?? 'internal',
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState('');
  const [newCatalogDescription, setNewCatalogDescription] = useState('');
  const [newCatalogType, setNewCatalogType] = useState<CatalogType>('internal');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // File + import state
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [importResult, setImportResult] = useState<ImportAggregate | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PreviewRow['status'] | null>(null);

  const reset = useCallback(() => {
    setStep(initialCatalogId ? 'select' : 'catalog');
    setSelectedCatalogId(initialCatalogId);
    setSelectedCatalogType(initialCatalogType ?? 'internal');
    setIsCreatingNew(false);
    setNewCatalogName('');
    setNewCatalogDescription('');
    setNewCatalogType('internal');
    setCatalogError(null);
    setFileName(null);
    setCsv('');
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setStatusFilter(null);
    setImportProgress({ done: 0, total: 0 });
    setImportResult(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [initialCatalogId, initialCatalogType]);

  useEffect(() => {
    if (open && !initialCatalogId) {
      fetchCatalogsAction().then((list) => setCatalogs(list));
    }
  }, [open, initialCatalogId]);

  function handleOpenChange(next: boolean) {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) reset();
  }

  async function handleCatalogNext() {
    if (isCreatingNew) {
      if (!newCatalogName.trim()) {
        setCatalogError('Name is required');
        return;
      }
      setCatalogLoading(true);
      setCatalogError(null);
      const res = await createCatalogAction({
        name: newCatalogName.trim(),
        description: newCatalogDescription.trim() || undefined,
        type: newCatalogType,
      });
      setCatalogLoading(false);
      if (!res.success) {
        setCatalogError(res.error ?? 'Failed to create catalogue');
        return;
      }
      setSelectedCatalogId(res.id);
      setSelectedCatalogType(newCatalogType);
    } else if (!selectedCatalogId) {
      setCatalogError('Select a catalogue or create a new one');
      return;
    }
    setStep('select');
  }

  async function handleFileSelect(file: File | null) {
    if (!file) return;
    setPreviewError(null);
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
  }

  async function runPreview() {
    if (!csv.trim()) {
      setPreviewError('Select a CSV file first');
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    const res = await previewCatalogImportAction(csv, selectedCatalogId);
    setPreviewLoading(false);
    if (!res.success) {
      setPreviewError(res.error ?? 'Failed to parse CSV');
      return;
    }
    setPreview(res.preview as PreviewSummary);
    setStep('review');
  }

  function buildImportableCsv(source: string, rows: PreviewRow[]): string {
    const importable = new Set(
      rows.filter((r) => r.status === 'ok' || r.status === 'warning').map((r) => r.row),
    );
    const lines = source.trim().split(/\r?\n/);
    const header = lines[0];
    const kept = lines.slice(1).filter((_, idx) => importable.has(idx + 2));
    const sorted = sortCsvDataLinesByParent(header, kept);
    return [header, ...sorted].join('\n');
  }

  /** Parents before children so chunked imports still resolve Parent ids. */
  function sortCsvDataLinesByParent(headerLine: string, dataLines: string[]): string[] {
    const headers = parseCsvLineSimple(headerLine).map((h) => h.trim().toLowerCase());
    const parentIdx = ['parent', 'parent_id', 'parent_code']
      .map((name) => headers.indexOf(name))
      .find((i) => i >= 0);
    const idIdx = headers.indexOf('id');
    const codeIdx = headers.indexOf('code');
    // Internal round-trip export uses `id` for item UUID; item code is still in `code`.
    // Prefer `code` when present so parent links resolve against item codes.
    if (parentIdx === undefined || parentIdx < 0) return dataLines;

    const parsed = dataLines.map((line, order) => {
      const cells = parseCsvLineSimple(line);
      const code = String(
        (codeIdx >= 0 ? cells[codeIdx] : '') || (idIdx >= 0 ? cells[idIdx] : '') || '',
      ).trim();
      const parent = String(cells[parentIdx] || '').trim();
      return { line, order, code, parent };
    });

    const codeToItems = new Map<string, typeof parsed>();
    for (const item of parsed) {
      if (!item.code) continue;
      const key = item.code.toLowerCase();
      const list = codeToItems.get(key);
      if (list) list.push(item);
      else codeToItems.set(key, [item]);
    }

    const pending = new Set(parsed);
    const ordered: typeof parsed = [];
    const visiting = new Set<(typeof parsed)[number]>();

    const visit = (item: (typeof parsed)[number]) => {
      if (!pending.has(item) || visiting.has(item)) return;
      visiting.add(item);
      if (item.parent) {
        const parents = codeToItems.get(item.parent.toLowerCase()) ?? [];
        const sortedParents = [...parents].sort((a, b) => {
          const aHas = a.parent ? 1 : 0;
          const bHas = b.parent ? 1 : 0;
          return aHas - bHas;
        });
        for (const parent of sortedParents) {
          if (pending.has(parent)) visit(parent);
        }
      }
      visiting.delete(item);
      pending.delete(item);
      ordered.push(item);
    };

    for (const item of parsed) visit(item);
    return ordered.map((p) => p.line);
  }

  function parseCsvLineSimple(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells;
  }

  async function runImport() {
    if (!preview || !csv) return;
    const importCsv = buildImportableCsv(csv, preview.rows);
    const dataLines = importCsv.trim().split(/\r?\n/).slice(1);
    if (dataLines.length === 0) {
      setImportError('No valid rows to import');
      setStep('report');
      return;
    }

    setStep('importing');
    setImportError(null);
    setImportProgress({ done: 0, total: dataLines.length });

    const lines = importCsv.trim().split(/\r?\n/);
    const header = lines[0];
    const data = lines.slice(1);
    const aggregate: ImportAggregate = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      results: [],
    };

    try {
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunkLines = data.slice(i, i + CHUNK_SIZE);
        const chunkCsv = [header, ...chunkLines].join('\n');
        const res = await importCatalogCsvAction(chunkCsv, selectedCatalogId);
        if (!res.success) {
          throw new Error(res.error ?? 'Import batch failed');
        }
        const batch = res.result as ImportAggregate;
        aggregate.created += batch.created;
        aggregate.updated += batch.updated;
        aggregate.skipped += batch.skipped;
        aggregate.errors += batch.errors;
        aggregate.results.push(...(batch.results ?? []));
        setImportProgress({
          done: Math.min(i + chunkLines.length, data.length),
          total: data.length,
        });
      }
      setImportResult(aggregate);
      onImportComplete?.();
      router.refresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }
    setStep('report');
  }

  const importableCount = preview
    ? preview.rows.filter((r) => r.status === 'ok' || r.status === 'warning').length
    : 0;

  const stepIndex = STEPS.indexOf(step);

  const selectedCatalogName = isCreatingNew
    ? newCatalogName
    : catalogs.find((c) => c.id === selectedCatalogId)?.name ?? '';

  return (
    <>
      {!isControlled && (
        <Button size="sm" variant="outline" onClick={() => handleOpenChange(true)}>
          <Upload className="mr-1 h-4 w-4" />
          Import CSV
        </Button>
      )}

      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Import catalogue CSV"
        description={STEP_LABELS[step]}
        icon={<FileSpreadsheet className="h-5 w-5" />}
      >
        <div className="border-b border-slate-200 px-8 py-3">
          <ol className="flex flex-wrap gap-2 text-xs">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`rounded-full px-3 py-1 ${
                  i === stepIndex
                    ? 'bg-slate-900 text-white'
                    : i < stepIndex
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {i + 1}. {STEP_LABELS[s]}
              </li>
            ))}
          </ol>
        </div>

        <BottomFormDrawerBody className="px-8">
          {step === 'catalog' && (
            <div className="mx-auto max-w-lg space-y-6">
              <p className="text-sm text-muted-foreground">
                Choose which catalogue to import items into, or create a new one.
                The catalogue type determines the expected CSV column format.
              </p>

              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="catalog-mode"
                    checked={!isCreatingNew}
                    onChange={() => setIsCreatingNew(false)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Existing catalogue</span>
                </label>

                {!isCreatingNew && (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={selectedCatalogId ?? ''}
                    onChange={(e) => {
                      setSelectedCatalogId(e.target.value || undefined);
                      const cat = catalogs.find((c) => c.id === e.target.value);
                      if (cat) setSelectedCatalogType(cat.type as CatalogType);
                    }}
                  >
                    <option value="">Select a catalogue…</option>
                    {catalogs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="catalog-mode"
                    checked={isCreatingNew}
                    onChange={() => setIsCreatingNew(true)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Create new catalogue</span>
                </label>

                {isCreatingNew && (
                  <div className="space-y-4 pl-7">
                    <div>
                      <Label htmlFor="import-catalog-name">Name</Label>
                      <Input
                        id="import-catalog-name"
                        placeholder="e.g. Crunchwork Aug 2025"
                        value={newCatalogName}
                        onChange={(e) => setNewCatalogName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="import-catalog-desc">Description</Label>
                      <Input
                        id="import-catalog-desc"
                        placeholder="Optional"
                        value={newCatalogDescription}
                        onChange={(e) => setNewCatalogDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="import-catalog-type">Type</Label>
                      <select
                        id="import-catalog-type"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={newCatalogType}
                        onChange={(e) => setNewCatalogType(e.target.value as CatalogType)}
                      >
                        {CATALOG_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {catalogError && (
                <p className="text-sm text-destructive" role="alert">
                  {catalogError}
                </p>
              )}
            </div>
          )}

          {step === 'select' && (
            <div className="mx-auto max-w-xl space-y-6">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file matching the{' '}
                <span className="font-medium capitalize">{selectedCatalogType}</span> column format.
              </p>
              <div
                role="button"
                tabIndex={0}
                aria-label="Drop CSV here or click to choose a file"
                className={`relative flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 bg-slate-50/50 hover:border-primary/50 hover:bg-slate-50'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void handleFileSelect(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Upload className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">Drop CSV here or choose a file</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click anywhere in this area to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
                />
                {fileName && (
                  <p className="mt-3 text-sm text-emerald-700">
                    Selected: <span className="font-medium">{fileName}</span>
                  </p>
                )}
              </div>
              {templateCsv && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium">Download template</summary>
                  <pre className="mt-2 max-h-32 overflow-auto rounded border bg-muted p-2 font-mono text-[10px]">
                    {templateCsv.trim()}
                  </pre>
                </details>
              )}
              {previewError && (
                <p className="text-sm text-destructive" role="alert">
                  {previewError}
                </p>
              )}
            </div>
          )}

          {step === 'review' && preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setStatusFilter(null)}
                  className={`rounded-md px-2 py-1 transition-colors ${
                    statusFilter === null
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  {preview.totalRows} rows
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'ok' ? null : 'ok')}
                  className={`rounded-md px-2 py-1 transition-colors ${
                    statusFilter === 'ok'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                >
                  {preview.validRows} ok
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'warning' ? null : 'warning')}
                  className={`rounded-md px-2 py-1 transition-colors ${
                    statusFilter === 'warning'
                      ? 'bg-amber-600 text-white ring-2 ring-amber-300'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  {preview.warningRows} warnings
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'error' ? null : 'error')}
                  className={`rounded-md px-2 py-1 transition-colors ${
                    statusFilter === 'error'
                      ? 'bg-red-600 text-white ring-2 ring-red-300'
                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                  }`}
                >
                  {preview.errorRows} errors
                </button>
                <span className="rounded-md bg-slate-100 px-2 py-1">
                  {preview.willCreate} new · {preview.willUpdate} updates
                </span>
              </div>
              {preview.categoriesToCreate.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Categories to create: {preview.categoriesToCreate.join(', ')}
                </p>
              )}
              {(preview.unitsToCreate?.length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Unit types to create: {preview.unitsToCreate!.join(', ')}
                </p>
              )}
              <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-slate-500">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Display name</th>
                      <th className="px-3 py-2">Kind</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Issue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows
                      .filter((row) => !statusFilter || row.status === statusFilter)
                      .map((row) => (
                      <tr
                        key={row.row}
                        className={
                          row.status === 'error'
                            ? 'bg-red-50/80'
                            : row.status === 'warning'
                              ? 'bg-amber-50/50'
                              : undefined
                        }
                      >
                        <td className="px-3 py-2 tabular-nums">{row.row}</td>
                        <td className="px-3 py-2 font-mono">{row.code || '—'}</td>
                        <td className="max-w-[200px] truncate px-3 py-2" title={row.displayName}>
                          {row.displayName || '—'}
                        </td>
                        <td className="px-3 py-2 capitalize">{row.kind || '—'}</td>
                        <td className="px-3 py-2">{row.typeCode || '—'}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={row.status} action={row.action} />
                        </td>
                        <td className="max-w-[240px] truncate px-3 py-2 text-muted-foreground" title={row.message}>
                          {row.message ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'confirm' && preview && (
            <div className="mx-auto max-w-lg space-y-4">
              <h3 className="text-sm font-medium">Ready to import</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {selectedCatalogName && (
                  <li>
                    Catalogue: <strong className="text-foreground">{selectedCatalogName}</strong>
                    {' '}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs capitalize">
                      {selectedCatalogType}
                    </span>
                  </li>
                )}
                <li>
                  <strong className="text-foreground">{importableCount}</strong> rows will be
                  imported ({preview.willCreate} new, {preview.willUpdate} updates)
                </li>
                {preview.errorRows + preview.skippedRows > 0 && (
                  <li>
                    <strong className="text-foreground">
                      {preview.errorRows + preview.skippedRows}
                    </strong>{' '}
                    rows with errors or empty codes will be skipped
                  </li>
                )}
                {preview.categoriesToCreate.length > 0 && (
                  <li>
                    {preview.categoriesToCreate.length} categor
                    {preview.categoriesToCreate.length === 1 ? 'y' : 'ies'} will be created
                  </li>
                )}
                {(preview.unitsToCreate?.length ?? 0) > 0 && (
                  <li>
                    {preview.unitsToCreate!.length} unit type
                    {preview.unitsToCreate!.length === 1 ? '' : 's'} will be created
                  </li>
                )}
              </ul>
              {importableCount === 0 && (
                <p className="text-sm text-destructive" role="alert">
                  No valid rows to import. Fix errors in the CSV and try again.
                </p>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="mx-auto max-w-lg space-y-4 py-8">
              <p className="text-center text-sm font-medium">Importing catalogue items…</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{
                    width:
                      importProgress.total > 0
                        ? `${Math.round((importProgress.done / importProgress.total) * 100)}%`
                        : '0%',
                  }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {importProgress.done} of {importProgress.total} rows processed
              </p>
            </div>
          )}

          {step === 'report' && (
            <div className="mx-auto max-w-lg space-y-4">
              {importError ? (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="font-medium text-red-900">Import failed</p>
                    <p className="mt-1 text-sm text-red-700">{importError}</p>
                  </div>
                </div>
              ) : importResult ? (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-emerald-900">Import complete</p>
                    <p>Created: {importResult.created}</p>
                    <p>Updated: {importResult.updated}</p>
                    {importResult.skipped > 0 && <p>Skipped: {importResult.skipped}</p>}
                    {importResult.errors > 0 && (
                      <p className="text-amber-800">Errors during import: {importResult.errors}</p>
                    )}
                  </div>
                </div>
              ) : null}

              {importResult && importResult.errors > 0 && (
                <div className="max-h-40 overflow-auto rounded border text-xs">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-1 text-left">Row</th>
                        <th className="px-2 py-1 text-left">Code</th>
                        <th className="px-2 py-1 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.results
                        .filter((r) => r.status === 'error')
                        .map((r) => (
                          <tr key={`${r.row}-${r.code}`} className="border-t">
                            <td className="px-2 py-1">{r.row}</td>
                            <td className="px-2 py-1 font-mono">{r.code}</td>
                            <td className="px-2 py-1 text-red-700">{r.message}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <div className="flex w-full items-center justify-between gap-3">
            {step === 'catalog' && (
              <>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCatalogNext()}
                  disabled={catalogLoading}
                >
                  {catalogLoading ? 'Creating…' : 'Next: Select file'}
                </Button>
              </>
            )}
            {step === 'select' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => (initialCatalogId ? handleOpenChange(false) : setStep('catalog'))}
                >
                  {initialCatalogId ? 'Cancel' : 'Back'}
                </Button>
                <Button onClick={() => void runPreview()} disabled={!csv || previewLoading}>
                  {previewLoading ? 'Parsing…' : 'Next: Review rows'}
                </Button>
              </>
            )}
            {step === 'review' && (
              <>
                <Button variant="outline" onClick={() => setStep('select')}>
                  Back
                </Button>
                <Button onClick={() => setStep('confirm')}>Next: Confirm</Button>
              </>
            )}
            {step === 'confirm' && (
              <>
                <Button variant="outline" onClick={() => setStep('review')}>
                  Back
                </Button>
                <Button onClick={() => void runImport()} disabled={importableCount === 0}>
                  Start import
                </Button>
              </>
            )}
            {step === 'report' && (
              <Button className="ml-auto" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            )}
          </div>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>
    </>
  );
}

function StatusBadge({
  status,
  action,
}: {
  status: PreviewRow['status'];
  action: PreviewRow['action'];
}) {
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-red-700">
        <XCircle className="h-3 w-3" /> Error
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <AlertTriangle className="h-3 w-3" /> Warning
      </span>
    );
  }
  if (status === 'skipped') {
    return <span className="text-slate-500">Skipped</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <CheckCircle2 className="h-3 w-3" /> {action === 'update' ? 'Update' : 'New'}
    </span>
  );
}
