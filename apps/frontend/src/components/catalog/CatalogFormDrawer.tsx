'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
  BottomFormDrawerError,
} from '@/components/forms/BottomFormDrawer';
import { createCatalogAction, updateCatalogAction, fetchCatalogAction } from '@/app/(app)/admin/catalog/actions';
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import type { Catalog, CatalogType } from '@/types/api';

export interface CatalogFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog?: Catalog;
  /** Existing catalogue id when opened from chat without a full catalog object. */
  catalogId?: string;
  /** Live values from AI open/fill_catalog tools. */
  name?: string;
  description?: string;
  type?: CatalogType | string;
  companionChatOpen?: boolean;
  [key: string]: unknown;
}

interface FormValues {
  name: string;
  description: string;
  type: CatalogType;
  isDefault: boolean;
}

const CATALOG_TYPES: { value: CatalogType; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'crunchwork', label: 'Crunchwork' },
];

export function CatalogFormDrawer({
  open,
  onOpenChange,
  catalog: catalogProp,
  catalogId,
  name: nameProp,
  description: descriptionProp,
  type: typeProp,
}: CatalogFormDrawerProps) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | undefined>(catalogProp);
  const isEdit = !!(catalog ?? catalogId);
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors: formErrors },
  } = useForm<FormValues>({
    defaultValues: {
      name: nameProp ?? catalog?.name ?? '',
      description: descriptionProp ?? catalog?.description ?? '',
      type: (typeProp as CatalogType) ?? catalog?.type ?? 'internal',
      isDefault: catalog?.isDefault ?? false,
    },
  });

  const isDefault = watch('isDefault');

  useEffect(() => {
    if (!open) return;
    if (catalogProp) setCatalog(catalogProp);
  }, [open, catalogProp]);

  useEffect(() => {
    if (!open || !catalogId || catalogProp) return;
    let cancelled = false;
    void (async () => {
      const row = await fetchCatalogAction(catalogId);
      if (!cancelled && row) setCatalog(row);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, catalogId, catalogProp]);

  useEffect(() => {
    if (!open) return;
    if (nameProp != null) setValue('name', nameProp);
    if (descriptionProp != null) setValue('description', descriptionProp);
    if (typeProp != null && !isEdit) setValue('type', typeProp as CatalogType);
  }, [open, nameProp, descriptionProp, typeProp, isEdit, setValue]);

  useEffect(() => {
    if (!open || !catalog) return;
    reset({
      name: nameProp ?? catalog.name ?? '',
      description: descriptionProp ?? catalog.description ?? '',
      type: (typeProp as CatalogType) ?? catalog.type ?? 'internal',
      isDefault: catalog.isDefault ?? false,
    });
  }, [open, catalog, nameProp, descriptionProp, typeProp, reset]);

  async function onSubmit(values: FormValues) {
    startCreating();
    setError(null);

    const id = catalog?.id ?? catalogId;
    const payload = {
      name: values.name,
      description: values.description || undefined,
      type: values.type,
      isDefault: values.isDefault,
    };
    const res = id
      ? await updateCatalogAction(id, payload)
      : await createCatalogAction(payload);

    if (!res.success) {
      setError(res.error ?? 'Failed to save catalogue');
      resetPhase();
      return;
    }

    if (!id && 'id' in res && res.id) {
      startOpening();
      navigateToCreated(router, `/admin/catalog/${res.id}`);
      return;
    }

    resetPhase();
    onOpenChange(false);
    reset();
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    onOpenChange(next);
    if (!next) {
      reset();
      setError(null);
      resetPhase();
      if (!catalogProp) setCatalog(undefined);
    }
  }

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={isEdit ? 'Edit Catalogue' : 'New Catalogue'}
        description={
          isEdit ? 'Update catalogue details' : 'Create a new catalogue for your items'
        }
        icon={<BookOpen className="h-5 w-5" />}
        preventClose={busy}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <BottomFormDrawerBody>
            <div className="mx-auto max-w-lg space-y-5">
              <div>
                <Label htmlFor="catalog-name">Name</Label>
                <Input
                  id="catalog-name"
                  placeholder="e.g. Building Repairs 2026"
                  {...register('name', { required: 'Name is required' })}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-destructive">{formErrors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="catalog-description">Description</Label>
                <Input
                  id="catalog-description"
                  placeholder="Optional description"
                  {...register('description')}
                />
              </div>

              <div>
                <Label htmlFor="catalog-type">Provider</Label>
                <select
                  id="catalog-type"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  {...register('type', { required: 'Provider is required' })}
                >
                  {CATALOG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Provider determines the expected CSV format for imports and default
                  item tagging.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                <div>
                  <Label htmlFor="catalog-is-default" className="text-sm font-medium">
                    Set as default
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pre-selected when opening the catalogue picker.
                  </p>
                </div>
                <Switch
                  id="catalog-is-default"
                  checked={!!isDefault}
                  onCheckedChange={(v) => setValue('isDefault', !!v)}
                />
              </div>
            </div>
          </BottomFormDrawerBody>

          {error && <BottomFormDrawerError error={error} />}

          <BottomFormDrawerFooter>
            <div className="flex w-full items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {phase === 'opening' ? 'Opening…' : isEdit ? 'Saving…' : 'Creating…'}
                  </>
                ) : isEdit ? (
                  'Save changes'
                ) : (
                  'Create catalogue'
                )}
              </Button>
            </div>
          </BottomFormDrawerFooter>
        </form>
      </BottomFormDrawer>
      <CreateSubmitOverlay
        phase={phase}
        entityLabel={isEdit ? 'catalogue' : 'catalogue'}
      />
    </>
  );
}
