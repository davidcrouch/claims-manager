'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderTree, Package, Plus, Search, Upload, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { HeaderActionToolbar } from '@/components/layout/HeaderActionToolbar';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { CatalogImportDialog } from '@/components/catalog/CatalogImportDialog';
import { CatalogCategoriesDrawer } from '@/components/catalog/CatalogCategoriesDrawer';
import { CatalogDeleteButton } from '@/components/catalog/CatalogDeleteButton';
import { CatalogItemFormDrawer } from '@/components/catalog/CatalogItemFormDrawer';
import { CatalogUnresolvedPanel } from '@/components/catalog/CatalogUnresolvedPanel';
import {
  CatalogLineItemsTab,
  type CatalogLineItemsTabHandle,
  type CatalogLineItemEdits,
} from '@/components/catalog/CatalogLineItemsTab';
import { CatalogPickerDrawer } from '@/components/catalog/CatalogPickerDrawer';
import { HeaderSaveStatus } from '@/components/shared/HeaderSaveStatus';
import { DetailUndoButton } from '@/components/shared/DetailAutosaveActions';
import {
  AUTOSAVE_DEBOUNCE_MS,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
  pushUndoEntry,
  MAX_UNDO,
} from '@/components/shared/detail-autosave';
import type { CatalogCategory, CatalogItemType, CatalogType } from '@/types/api';
import { exportCatalogCsvAction } from '@/app/(app)/admin/catalog/actions';

export interface CatalogPageClientProps {
  catalogId: string;
  catalogName?: string;
  catalogType?: CatalogType;
  categories: CatalogCategory[];
  types: CatalogItemType[];
  unitTypes: Array<{ id: string; name?: string; externalReference?: string }>;
  templateCsv: string;
  unresolvedReferences: Array<{
    id: string;
    externalReference: string;
    sourceEntity: string | null;
    sourceEntityId: string | null;
    createdAt: string;
  }>;
}

export function CatalogPageClient({
  catalogId,
  catalogName,
  catalogType,
  categories,
  types,
  unitTypes,
  templateCsv,
  unresolvedReferences,
}: CatalogPageClientProps) {
  const router = useRouter();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const saveFnRef = useRef<(() => void) | null>(null);
  const lineItemsRef = useRef<CatalogLineItemsTabHandle>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [editTick, setEditTick] = useState(0);

  type UndoEntry = { kind: 'line-items'; edits: CatalogLineItemEdits };
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack((prev) => pushUndoEntry(prev, entry, MAX_UNDO));
  }, []);

  const canUndo = isDirty || undoStack.length > 0;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('newItem') !== '1') return;
    setItemDrawerOpen(true);
    url.searchParams.delete('newItem');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', next);
  }, []);

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const result = await exportCatalogCsvAction(catalogId);
      if (!result.success || !result.csv || !result.filename) {
        toast.error(result.error || 'Catalogue export failed');
        return;
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.itemCount ?? 0} catalogue items`);
    } catch (err) {
      console.error('[catalog/CatalogPageClient.handleExportCsv]', err);
      toast.error(err instanceof Error ? err.message : 'Catalogue export failed');
    } finally {
      setExporting(false);
    }
  }, [catalogId]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const handleDirtyChange = useCallback((dirty: boolean, save: () => void) => {
    setIsDirty(dirty);
    saveFnRef.current = save;
    setEditTick((n) => n + 1);
  }, []);

  const handleUndoCapture = useCallback(
    (restoreEdits: CatalogLineItemEdits) => {
      pushUndo({ kind: 'line-items', edits: cloneJson(restoreEdits) });
    },
    [pushUndo],
  );

  const handleSaveStateChange = useCallback(
    (state: 'saving' | 'saved' | 'error', error?: string) => {
      if (state === 'saving') {
        setSaving(true);
        setSaveError(null);
        setJustSaved(false);
      } else if (state === 'saved') {
        setSaving(false);
        setSaveError(null);
        setJustSaved(true);
      } else {
        setSaving(false);
        setSaveError(error ?? 'Save failed');
      }
    },
    [],
  );

  const handleUndo = useCallback(() => {
    if (saving) return;

    if (isDirty) {
      lineItemsRef.current?.resetEdits();
      return;
    }

    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    lineItemsRef.current?.save(entry.edits);
  }, [saving, isDirty, undoStack]);

  // Auto-save line items after debounce
  useEffect(() => {
    if (!isDirty || saving) return;
    const timer = setTimeout(() => {
      saveFnRef.current?.();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [isDirty, saving, editTick]);

  // Clear "Saved" indicator after a short delay
  useEffect(() => {
    if (!justSaved || isDirty || saving || saveError) return;
    const timer = setTimeout(() => setJustSaved(false), SAVE_STATUS_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [justSaved, isDirty, saving, saveError]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
        <SetPageHeader>
          <ListPageHeader
            icon={Package}
            title={catalogName ? `${catalogName} — Catalogue` : 'Item Catalogue'}
            total={0}
            search={debouncedSearch}
            accent="slate"
          />
        </SetPageHeader>
        <HeaderSaveStatus
          saving={saving}
          saveError={saveError}
          justSaved={justSaved}
          dirty={isDirty}
        />
        <SetHeaderActions>
          <Button
            size="default"
            variant="outline"
            className="h-9 gap-1.5 px-4"
            onClick={() => setDrawerOpen(true)}
          >
            <Package className="h-3.5 w-3.5" />
            Catalogue
          </Button>
          <Button
            size="default"
            variant="outline"
            className="h-9 gap-1.5 px-4"
            onClick={() => setCategoriesOpen(true)}
          >
            <FolderTree className="h-3.5 w-3.5" />
            Categories
          </Button>
          <Button
            size="default"
            onClick={() => setItemDrawerOpen(true)}
            className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            New Item
          </Button>
          <HeaderActionToolbar>
            <DetailUndoButton
              canUndo={canUndo}
              undoDisabled={saving}
              onUndo={handleUndo}
            />
            <Button
              size="icon-lg"
              variant="outline"
              onClick={() => void handleExportCsv()}
              disabled={exporting}
              title="Export CSV"
              aria-label="Export CSV"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="icon-lg"
              variant="outline"
              onClick={() => setImportOpen(true)}
              title="Import CSV"
              aria-label="Import CSV"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <CatalogDeleteButton
              catalogId={catalogId}
              catalogName={catalogName}
            />
          </HeaderActionToolbar>
        </SetHeaderActions>

        <div className="flex shrink-0 flex-col border-b border-slate-200 bg-background px-6 pb-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <Input
                placeholder="Search catalogue items by name or code…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-10 w-full pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {unresolvedReferences.length > 0 && (
            <div className="mb-4">
              <CatalogUnresolvedPanel
                entries={unresolvedReferences}
                onCreateItem={() => setItemDrawerOpen(true)}
              />
            </div>
          )}

          <CatalogLineItemsTab
            ref={lineItemsRef}
            catalogId={catalogId}
            catalogType={catalogType}
            search={debouncedSearch}
            onDirtyChange={handleDirtyChange}
            reloadToken={reloadToken}
            drawerOpen={drawerOpen}
            onDrawerOpenChange={setDrawerOpen}
            onUndoCapture={handleUndoCapture}
            onSaveStateChange={handleSaveStateChange}
          />
        </div>
      </div>

      <CatalogImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        templateCsv={templateCsv}
        catalogId={catalogId}
        catalogType={catalogType}
        onImportComplete={() => {
          setReloadToken((n) => n + 1);
        }}
      />

      <CatalogCategoriesDrawer
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
      />

      <CatalogItemFormDrawer
        open={itemDrawerOpen}
        onOpenChange={setItemDrawerOpen}
        catalogId={catalogId}
        types={types}
        categories={categories}
        unitTypes={unitTypes}
        onCreated={() => {
          toast.success('Catalogue item created');
          setReloadToken((n) => n + 1);
          router.refresh();
        }}
      />

      <CatalogPickerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        catalogType={catalogType}
        excludeCatalogId={catalogId}
        context="catalog"
      />
    </>
  );
}
