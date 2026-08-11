'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { CatalogItemForm } from '@/components/catalog/CatalogItemForm';
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    onOpenChange(next);
    if (!next) {
      setPending(false);
      resetPhase();
    }
  }

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="New catalogue item"
      description="Add an item to this catalogue"
      icon={<Package className="h-5 w-5" />}
      widthClassName="w-[60%]"
      preventClose={busy}
    >
      <BottomFormDrawerBody>
        <CatalogItemForm
          formId={FORM_ID}
          hideChrome
          catalogId={catalogId}
          types={types}
          categories={categories}
          unitTypes={unitTypes}
          onPendingChange={(next) => {
            setPending(next);
            if (next) startCreating();
            else if (phase !== 'opening') resetPhase();
          }}
          onSuccess={(id) => {
            onCreated?.(id);
            if (id) {
              startOpening();
              navigateToCreated(router, `/admin/catalog/items/${id}`);
              return;
            }
            resetPhase();
            handleOpenChange(false);
          }}
          onCancel={() => handleOpenChange(false)}
        />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || pending}
            onClick={() => {
              const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'opening' ? 'Opening…' : 'Creating…'}
              </>
            ) : (
              'Create item'
            )}
          </Button>
        </div>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
    <CreateSubmitOverlay phase={phase} entityLabel="catalogue item" />
    </>
  );
}
