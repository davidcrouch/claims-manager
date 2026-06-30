'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FolderTree, Package, Plus, Save, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { CatalogImportDialog } from '@/components/catalog/CatalogImportDialog';
import { CatalogCategoriesDrawer } from '@/components/catalog/CatalogCategoriesDrawer';
import { CatalogUnresolvedPanel } from '@/components/catalog/CatalogUnresolvedPanel';
import { CatalogLineItemsTab } from '@/components/catalog/CatalogLineItemsTab';
import type { CatalogCategory, CatalogType } from '@/types/api';

export interface CatalogPageClientProps {
  catalogId: string;
  catalogName?: string;
  catalogType?: CatalogType;
  categories: CatalogCategory[];
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
  templateCsv,
  unresolvedReferences,
}: CatalogPageClientProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const saveFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

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
              <Button size="sm" variant="outline" onClick={() => setCategoriesOpen(true)}>
                <FolderTree className="mr-1 h-4 w-4" />
                Categories
              </Button>
              <CatalogImportDialog
                templateCsv={templateCsv}
                catalogId={catalogId}
                catalogType={catalogType}
              />
              <Button
                size="sm"
                render={
                  <Link href={`/admin/catalog/new?catalogId=${catalogId}`} />
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                New Item
              </Button>
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

        <div className="flex-1 px-6 pb-6 pt-4">
          {unresolvedReferences.length > 0 && (
            <div className="mb-4">
              <CatalogUnresolvedPanel entries={unresolvedReferences} />
            </div>
          )}

          <CatalogLineItemsTab
            catalogId={catalogId}
            search={debouncedSearch}
            onDirtyChange={handleDirtyChange}
          />
        </div>
      </div>

      <CatalogCategoriesDrawer
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
      />
    </>
  );
}
