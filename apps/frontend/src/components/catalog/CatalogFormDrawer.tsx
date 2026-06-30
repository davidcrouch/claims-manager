'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
  BottomFormDrawerError,
} from '@/components/forms/BottomFormDrawer';
import { createCatalogAction, updateCatalogAction } from '@/app/(app)/admin/catalog/actions';
import type { Catalog, CatalogType } from '@/types/api';

export interface CatalogFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog?: Catalog;
}

interface FormValues {
  name: string;
  description: string;
  type: CatalogType;
}

const CATALOG_TYPES: { value: CatalogType; label: string }[] = [
  { value: 'internal', label: 'Internal' },
  { value: 'crunchwork', label: 'Crunchwork' },
];

export function CatalogFormDrawer({ open, onOpenChange, catalog }: CatalogFormDrawerProps) {
  const router = useRouter();
  const isEdit = !!catalog;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors: formErrors } } = useForm<FormValues>({
    defaultValues: {
      name: catalog?.name ?? '',
      description: catalog?.description ?? '',
      type: catalog?.type ?? 'internal',
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);

    const res = isEdit
      ? await updateCatalogAction(catalog!.id, values as unknown as Record<string, unknown>)
      : await createCatalogAction(values);

    setSubmitting(false);

    if (!res.success) {
      setError(res.error ?? 'Failed to save catalogue');
      return;
    }

    onOpenChange(false);
    reset();
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      reset();
      setError(null);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isEdit ? 'Edit Catalogue' : 'New Catalogue'}
      description={isEdit ? 'Update catalogue details' : 'Create a new catalogue for your items'}
      icon={<BookOpen className="h-5 w-5" />}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <BottomFormDrawerBody className="px-8">
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
              <Label htmlFor="catalog-type">Type</Label>
              <select
                id="catalog-type"
                disabled={isEdit}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                {...register('type', { required: 'Type is required' })}
              >
                {CATALOG_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Catalogue type determines the expected CSV format for imports.
                {isEdit && ' Type cannot be changed after creation.'}
              </p>
            </div>
          </div>
        </BottomFormDrawerBody>

        {error && <BottomFormDrawerError error={error} />}

        <BottomFormDrawerFooter>
          <div className="flex w-full items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create catalogue'}
            </Button>
          </div>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
