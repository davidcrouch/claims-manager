'use client';

import { Package } from 'lucide-react';
import { CatalogItemForm } from '@/components/catalog/CatalogItemForm';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import type { CatalogCategory, CatalogItemType } from '@/types/api';

export interface NewCatalogItemClientProps {
  types: CatalogItemType[];
  categories: CatalogCategory[];
  unitTypes: Array<{ id: string; name?: string; externalReference?: string }>;
}

export function NewCatalogItemClient({
  types,
  categories,
  unitTypes,
}: NewCatalogItemClientProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SetPageHeader>
        <ListPageHeader icon={Package} title="New catalogue item" total={0} accent="slate" />
      </SetPageHeader>
      <div className="px-6 pb-6">
        <CatalogItemForm types={types} categories={categories} unitTypes={unitTypes} />
      </div>
    </div>
  );
}
