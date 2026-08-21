'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { saveCatalogItemAction } from '@/app/(app)/admin/catalog/actions';
import type { CatalogCategory, CatalogItem, CatalogItemType } from '@/types/api';

export interface CatalogItemFormProps {
  item?: CatalogItem;
  catalogId?: string;
  types: CatalogItemType[];
  categories: CatalogCategory[];
  unitTypes: Array<{ id: string; name?: string; externalReference?: string }>;
  /** When set, submit buttons are omitted so a parent drawer footer can submit this form. */
  formId?: string;
  hideChrome?: boolean;
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
  /** Live field values from AI fill_catalog_item. */
  code?: string;
  name?: string;
  description?: string;
  kind?: 'primitive' | 'assembly' | 'scope' | string;
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
}

function flattenCategories(
  nodes: CatalogCategory[],
  depth = 0,
): Array<CatalogCategory & { depth: number }> {
  const out: Array<CatalogCategory & { depth: number }> = [];
  for (const node of nodes) {
    out.push({ ...node, depth });
    if (node.children?.length) out.push(...flattenCategories(node.children, depth + 1));
  }
  return out;
}

const KNOWN_PROVIDER_OPTIONS = [
  { code: 'internal', label: 'Internal' },
  { code: 'crunchwork', label: 'Crunchwork' },
] as const;

export function CatalogItemForm({
  item,
  catalogId,
  types,
  categories,
  unitTypes,
  formId,
  hideChrome,
  onSuccess,
  onCancel,
  onPendingChange,
  code: codeProp,
  name: nameProp,
  description: descriptionProp,
  kind: kindProp,
  typeId: typeIdProp,
  categoryId: categoryIdProp,
  unitTypeLookupId: unitTypeLookupIdProp,
  unitCost: unitCostProp,
  buyCost: buyCostProp,
  markupType: markupTypeProp,
  markupValue: markupValueProp,
  taxRate: taxRateProp,
  pricingMode: pricingModeProp,
  fixedUnitCost: fixedUnitCostProp,
  externalReference: externalReferenceProp,
}: CatalogItemFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const flatCategories = flattenCategories(categories);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  const [form, setForm] = useState({
    code: codeProp ?? item?.code ?? '',
    name: nameProp ?? item?.name ?? '',
    description: descriptionProp ?? item?.description ?? '',
    kind: (kindProp as 'primitive' | 'assembly' | 'scope') ?? item?.kind ?? 'primitive',
    typeId: typeIdProp ?? item?.typeId ?? types[0]?.id ?? '',
    categoryId: categoryIdProp ?? item?.categoryId ?? '',
    unitTypeLookupId: unitTypeLookupIdProp ?? item?.unitTypeLookupId ?? '',
    unitCost: unitCostProp ?? item?.unitCost ?? '',
    buyCost: buyCostProp ?? item?.buyCost ?? '',
    markupType: markupTypeProp ?? item?.markupType ?? 'percent',
    markupValue: markupValueProp ?? item?.markupValue ?? '0.19',
    taxRate: taxRateProp ?? item?.taxRate ?? '0.10',
    pricingMode: pricingModeProp ?? item?.pricingMode ?? 'computed',
    fixedUnitCost: fixedUnitCostProp ?? item?.fixedUnitCost ?? '',
    externalReference: externalReferenceProp ?? item?.externalReference ?? '',
    providerCodes: (item?.providerCodes?.length ? item.providerCodes : ['internal']) as string[],
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ...(codeProp != null ? { code: codeProp } : {}),
      ...(nameProp != null ? { name: nameProp } : {}),
      ...(descriptionProp != null ? { description: descriptionProp } : {}),
      ...(kindProp != null && !item
        ? { kind: kindProp as 'primitive' | 'assembly' | 'scope' }
        : {}),
      ...(typeIdProp != null ? { typeId: typeIdProp } : {}),
      ...(categoryIdProp != null ? { categoryId: categoryIdProp } : {}),
      ...(unitTypeLookupIdProp != null ? { unitTypeLookupId: unitTypeLookupIdProp } : {}),
      ...(unitCostProp != null ? { unitCost: unitCostProp } : {}),
      ...(buyCostProp != null ? { buyCost: buyCostProp } : {}),
      ...(markupTypeProp != null ? { markupType: markupTypeProp } : {}),
      ...(markupValueProp != null ? { markupValue: markupValueProp } : {}),
      ...(taxRateProp != null ? { taxRate: taxRateProp } : {}),
      ...(pricingModeProp != null ? { pricingMode: pricingModeProp } : {}),
      ...(fixedUnitCostProp != null ? { fixedUnitCost: fixedUnitCostProp } : {}),
      ...(externalReferenceProp != null ? { externalReference: externalReferenceProp } : {}),
    }));
  }, [
    codeProp,
    nameProp,
    descriptionProp,
    kindProp,
    typeIdProp,
    categoryIdProp,
    unitTypeLookupIdProp,
    unitCostProp,
    buyCostProp,
    markupTypeProp,
    markupValueProp,
    taxRateProp,
    pricingModeProp,
    fixedUnitCostProp,
    externalReferenceProp,
    item,
  ]);

  const isAssembly = form.kind === 'assembly' || form.kind === 'scope';

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const body: Record<string, unknown> = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind,
        typeId: form.typeId,
        categoryId: form.categoryId || undefined,
        unitTypeLookupId: isAssembly ? undefined : form.unitTypeLookupId || undefined,
        unitCost: form.unitCost || undefined,
        buyCost: form.buyCost || undefined,
        markupType: form.markupType || undefined,
        markupValue: form.markupValue || undefined,
        taxRate: form.taxRate || undefined,
        pricingMode: isAssembly ? form.pricingMode : undefined,
        fixedUnitCost: isAssembly && form.pricingMode === 'fixed' ? form.fixedUnitCost : undefined,
        externalReference: form.externalReference.trim() || undefined,
        providerCodes: form.providerCodes,
      };
      if (!item && catalogId) body.catalogId = catalogId;

      const result = await saveCatalogItemAction(body, item?.id);
      if (!result.success) {
        setError(result.error ?? 'Save failed');
        return;
      }
      if (onSuccess) {
        onSuccess(result.id);
        return;
      }
      router.push(result.id ? `/admin/catalog/items/${result.id}` : '/admin/catalog');
      router.refresh();
    });
  }

  const fields = (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            value={form.code}
            onChange={(e) => update('code', e.target.value)}
            required
            disabled={!!item}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kind">Kind</Label>
          <select
            id="kind"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.kind}
            onChange={(e) => update('kind', e.target.value)}
            disabled={!!item}
          >
            <option value="primitive">Primitive</option>
            <option value="assembly">Assembly</option>
            <option value="scope">Scope</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="typeId">Type</Label>
          <select
            id="typeId"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.typeId}
            onChange={(e) => update('typeId', e.target.value)}
            required
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <select
            id="categoryId"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.categoryId}
            onChange={(e) => update('categoryId', e.target.value)}
          >
            <option value="">—</option>
            {flatCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {'\u00A0'.repeat(c.depth * 2)}
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isAssembly && (
        <div className="space-y-2">
          <Label htmlFor="unitTypeLookupId">Unit</Label>
          <select
            id="unitTypeLookupId"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.unitTypeLookupId}
            onChange={(e) => update('unitTypeLookupId', e.target.value)}
            required
          >
            <option value="">Select unit…</option>
            {unitTypes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.externalReference}
              </option>
            ))}
          </select>
        </div>
      )}

      {isAssembly ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pricingMode">Pricing mode</Label>
            <select
              id="pricingMode"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.pricingMode}
              onChange={(e) => update('pricingMode', e.target.value)}
            >
              <option value="computed">Computed from BOM</option>
              <option value="fixed">Fixed price</option>
              <option value="cost_plus">Cost plus markup</option>
            </select>
          </div>
          {form.pricingMode === 'fixed' && (
            <div className="space-y-2">
              <Label htmlFor="fixedUnitCost">Fixed unit cost</Label>
              <Input
                id="fixedUnitCost"
                value={form.fixedUnitCost}
                onChange={(e) => update('fixedUnitCost', e.target.value)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="unitCost">Unit cost</Label>
            <Input
              id="unitCost"
              value={form.unitCost}
              onChange={(e) => update('unitCost', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyCost">Buy cost</Label>
            <Input
              id="buyCost"
              value={form.buyCost}
              onChange={(e) => update('buyCost', e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Provider tags</Label>
        <p className="text-xs text-muted-foreground">
          Controls which external systems receive this item when an estimate is published.
        </p>
        <div className="flex flex-wrap gap-4">
          {KNOWN_PROVIDER_OPTIONS.map((opt) => {
            const checked = form.providerCodes.includes(opt.code);
            return (
              <label key={opt.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setForm((prev) => {
                      const next = new Set(prev.providerCodes);
                      if (e.target.checked) next.add(opt.code);
                      else next.delete(opt.code);
                      return { ...prev, providerCodes: [...next] };
                    });
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="externalReference">External reference (Crunchwork catalogue ID)</Label>
        <Input
          id="externalReference"
          value={form.externalReference}
          onChange={(e) => update('externalReference', e.target.value)}
          placeholder="Provider catalogue ID for outbound sync"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );

  if (hideChrome) {
    return (
      <form id={formId} onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
        {fields}
      </form>
    );
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{item ? 'Edit item' : 'New catalogue item'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : item ? 'Save changes' : 'Create item'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => (onCancel ? onCancel() : router.back())}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
