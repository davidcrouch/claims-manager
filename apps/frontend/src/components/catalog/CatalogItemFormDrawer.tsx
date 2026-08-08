'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { CatalogItemForm } from '@/components/catalog/CatalogItemForm';
import type { CatalogCategory, CatalogItemType } from '@/types/api';

const FORM_ID = 'catalog-item-form';

export interface CatalogItemFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId: string;
  types: CatalogItemType[];
  categories: CatalogCategory[];
  unitTypes: Array<{ id: string; name?: string; externalReference?: string }>;
  onCreated?: (id?: string) => void;
}

export function CatalogItemFormDrawer({
  open,
  onOpenChange,
  catalogId,
  types,
  categories,
  unitTypes,
  onCreated,
}: CatalogItemFormDrawerProps) {
  const [pending, setPending] = useState(false);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setPending(false);
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="New catalogue item"
      description="Add an item to this catalogue"
      icon={<Package className="h-5 w-5" />}
      widthClassName="w-[60%]"
    >
      <BottomFormDrawerBody>
        <CatalogItemForm
          formId={FORM_ID}
          hideChrome
          catalogId={catalogId}
          types={types}
          categories={categories}
          unitTypes={unitTypes}
          onPendingChange={setPending}
          onSuccess={(id) => {
            handleOpenChange(false);
            onCreated?.(id);
          }}
          onCancel={() => handleOpenChange(false)}
        />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            {pending ? 'Saving…' : 'Create item'}
          </Button>
        </div>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
