'use client';

import { FolderTree } from 'lucide-react';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
} from '@/components/forms/BottomFormDrawer';
import { CatalogCategoriesPanel } from '@/components/catalog/CatalogCategoriesPanel';
import type { CatalogCategory } from '@/types/api';

export interface CatalogCategoriesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CatalogCategory[];
}

export function CatalogCategoriesDrawer({
  open,
  onOpenChange,
  categories,
}: CatalogCategoriesDrawerProps) {
  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Catalogue categories"
      description="Organise items with a hierarchical category tree"
      icon={<FolderTree className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <CatalogCategoriesPanel categories={categories} />
      </BottomFormDrawerBody>
    </BottomFormDrawer>
  );
}
