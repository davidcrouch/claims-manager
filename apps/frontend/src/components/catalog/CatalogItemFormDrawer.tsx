'use client';

import { useEffect, useState } from 'react';
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
import {
  fetchCatalogFormSupportAction,
  fetchCatalogItemAction,
} from '@/app/(app)/admin/catalog/actions';
import type { CatalogCategory, CatalogItem, CatalogItemType } from '@/types/api';

const FORM_ID = 'catalog-item-form';

export interface CatalogItemFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogId?: string;
  itemId?: string;
  item?: CatalogItem;
  types?: CatalogItemType[];
  categories?: CatalogCategory[];
  unitTypes?: Array<{ id: string; name?: string; externalReference?: string }>;
  onCreated?: (id?: string) => void;
  companionChatOpen?: boolean;
  /** AI fill fields */
  code?: string;
  name?: string;
  description?: string;
  kind?: string;
  typeId?: string;
  categoryId?: string;
  unitTypeLookupId?: string;
  unitCost?: string;
  buyCost?: string;
  markupType?: string;
  markupValue?: string;
  taxRate?: string;
  pricingMode?: string;
  fixedUnitCost?: string;
  externalReference?: string;
  [key: string]: unknown;
}

export function CatalogItemFormDrawer({
  open,
  onOpenChange,
  catalogId: catalogIdProp,
  itemId,
  item: itemProp,
  types: typesProp,
  categories: categoriesProp,
  unitTypes: unitTypesProp,
  onCreated,
  code,
  name,
  description,
  kind,
  typeId,
  categoryId,
  unitTypeLookupId,
  unitCost,
  buyCost,
  markupType,
  markupValue,
  taxRate,
  pricingMode,
  fixedUnitCost,
  externalReference,
}: CatalogItemFormDrawerProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [types, setTypes] = useState<CatalogItemType[]>(typesProp ?? []);
  const [categories, setCategories] = useState<CatalogCategory[]>(categoriesProp ?? []);
  const [unitTypes, setUnitTypes] = useState(unitTypesProp ?? []);
  const [item, setItem] = useState<CatalogItem | undefined>(itemProp);
  const [catalogId, setCatalogId] = useState(catalogIdProp ?? itemProp?.catalogId ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typesProp) setTypes(typesProp);
    if (categoriesProp) setCategories(categoriesProp);
    if (unitTypesProp) setUnitTypes(unitTypesProp);
    if (itemProp) setItem(itemProp);
    if (catalogIdProp) setCatalogId(catalogIdProp);
  }, [typesProp, categoriesProp, unitTypesProp, itemProp, catalogIdProp]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const needsSupport =
          !typesProp?.length || !categoriesProp?.length || !unitTypesProp?.length;
        const support = needsSupport
          ? await fetchCatalogFormSupportAction()
          : null;
        if (cancelled) return;
        if (support) {
          if (!typesProp?.length) setTypes(support.types);
          if (!categoriesProp?.length) setCategories(support.categories);
          if (!unitTypesProp?.length) setUnitTypes(support.unitTypes);
        }

        if (itemId && !itemProp) {
          const loaded = await fetchCatalogItemAction(itemId);
          if (!cancelled && loaded) {
            setItem(loaded);
            if (loaded.catalogId) setCatalogId(loaded.catalogId);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, itemId, itemProp, typesProp, categoriesProp, unitTypesProp, catalogIdProp]);

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    onOpenChange(next);
    if (!next) {
      setPending(false);
      resetPhase();
    }
  }

  const resolvedCatalogId = catalogId || item?.catalogId || '';

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={item ? 'Edit catalogue item' : 'New catalogue item'}
      description={
        item
          ? 'Update item details'
          : 'Add a primitive, assembly, or scope to this catalogue'
      }
      icon={<Package className="h-5 w-5" />}
      preventClose={busy}
    >
      <BottomFormDrawerBody>
        {loading && !types.length ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : !resolvedCatalogId && !item ? (
          <p className="text-sm text-muted-foreground">
            Select or create a catalogue first, then open this form with a catalogId.
          </p>
        ) : (
          <CatalogItemForm
            formId={FORM_ID}
            hideChrome
            item={item}
            catalogId={resolvedCatalogId}
            types={types}
            categories={categories}
            unitTypes={unitTypes}
            code={code}
            name={name}
            description={description}
            kind={kind}
            typeId={typeId}
            categoryId={categoryId}
            unitTypeLookupId={unitTypeLookupId}
            unitCost={unitCost}
            buyCost={buyCost}
            markupType={markupType}
            markupValue={markupValue}
            taxRate={taxRate}
            pricingMode={pricingMode}
            fixedUnitCost={fixedUnitCost}
            externalReference={externalReference}
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
        )}
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="outline" disabled={busy} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || pending || loading || (!resolvedCatalogId && !item)}
            onClick={() => {
              const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
              form?.requestSubmit();
            }}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'opening' ? 'Opening…' : 'Saving…'}
              </>
            ) : item ? (
              'Save changes'
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
