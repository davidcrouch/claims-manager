'use client';

import { useEffect, useState } from 'react';
import { FolderTree } from 'lucide-react';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
} from '@/components/forms/BottomFormDrawer';
import { CatalogCategoriesPanel } from '@/components/catalog/CatalogCategoriesPanel';
import { fetchCatalogFormSupportAction } from '@/app/(app)/admin/catalog/actions';
import type { CatalogCategory } from '@/types/api';

export interface CatalogCategoriesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories?: CatalogCategory[];
  /** Prefill for the add form from AI fill_catalog_category. */
  code?: string;
  name?: string;
  parentCategoryId?: string;
  companionChatOpen?: boolean;
  [key: string]: unknown;
}

export function CatalogCategoriesDrawer({
  open,
  onOpenChange,
  categories: categoriesProp,
  code,
  name,
  parentCategoryId,
}: CatalogCategoriesDrawerProps) {
  const [categories, setCategories] = useState<CatalogCategory[]>(categoriesProp ?? []);

  useEffect(() => {
    if (categoriesProp) setCategories(categoriesProp);
  }, [categoriesProp]);

  useEffect(() => {
    if (!open) return;
    if (categoriesProp?.length) return;
    let cancelled = false;
    void (async () => {
      const support = await fetchCatalogFormSupportAction();
      if (!cancelled) setCategories(support.categories);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, categoriesProp]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Catalogue categories"
      description="Organise items with a hierarchical category tree. Categories may contain primitives, assemblies, and scopes."
      icon={<FolderTree className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <CatalogCategoriesPanel
          categories={categories}
          initialCode={code}
          initialName={name}
          initialParentCategoryId={parentCategoryId}
        />
      </BottomFormDrawerBody>
    </BottomFormDrawer>
  );
}
