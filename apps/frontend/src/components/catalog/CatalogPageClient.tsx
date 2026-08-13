'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderTree, Package, Plus, Save, Search, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { CatalogImportDialog } from '@/components/catalog/CatalogImportDialog';
import { CatalogCategoriesDrawer } from '@/components/catalog/CatalogCategoriesDrawer';
import { CatalogItemFormDrawer } from '@/components/catalog/CatalogItemFormDrawer';
import { CatalogUnresolvedPanel } from '@/components/catalog/CatalogUnresolvedPanel';
import { CatalogLineItemsTab } from '@/components/catalog/CatalogLineItemsTab';
import type { CatalogCategory, CatalogItemType, CatalogType } from '@/types/api';

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
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const saveFnRef = useRef<(() => void) | null>(null);

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

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const handleDirtyChange = useCallback((dirty: boolean, save: () => void) => {
    setIsDirty(dirty);
    saveFnRef.current = save;
  }, []);

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
        <SetHeaderActions>
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
            variant="outline"
            className="h-9 gap-1.5 px-4"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </Button>
          <Button
            size="default"
            onClick={() => setItemDrawerOpen(true)}
            className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            New Item
          </Button>
        </SetHeaderActions>

        <div className="sticky top-14 z-10 flex flex-col gap-4 border-b border-slate-200 bg-background px-6 pb-3 pt-1">
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

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!isDirty}
                onClick={() => saveFnRef.current?.()}
              >
                <Save className="mr-1 h-4 w-4" />
                Save
              </Button>
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
            catalogId={catalogId}
            search={debouncedSearch}
            onDirtyChange={handleDirtyChange}
            reloadToken={reloadToken}
          />
        </div>
      </div>

      <CatalogImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        templateCsv={templateCsv}
        catalogId={catalogId}
        catalogType={catalogType}
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
    </>
  );
}
