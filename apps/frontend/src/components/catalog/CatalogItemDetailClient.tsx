'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { CatalogItemForm } from '@/components/catalog/CatalogItemForm';
import { CatalogBomEditor } from '@/components/catalog/CatalogBomEditor';
import type { CatalogCategory, CatalogItem, CatalogItemType } from '@/types/api';

export interface CatalogItemDetailClientProps {
  item: CatalogItem;
  types: CatalogItemType[];
  categories: CatalogCategory[];
  unitTypes: Array<{ id: string; name?: string; externalReference?: string }>;
  allItems: CatalogItem[];
}

export function CatalogItemDetailClient({
  item,
  types,
  categories,
  unitTypes,
  allItems,
}: CatalogItemDetailClientProps) {
  const [editing, setEditing] = useState(false);

  const components = (item.components ?? []) as Array<{
    id: string;
    componentId: string;
    quantity: string;
    wasteFactor: string;
    component?: { id?: string; code?: string; name?: string };
    resolvedUnitCost?: string | null;
  }>;

  if (editing) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <SetPageHeader>
          <ListPageHeader icon={Package} title={`Edit ${item.name}`} total={0} accent="slate" />
        </SetPageHeader>
        <div className="px-6 pb-6">
          <Link
            href={`/admin/catalog/items/${item.id}`}
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              setEditing(false);
            }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Cancel edit
          </Link>
          <CatalogItemForm
            item={item}
            types={types}
            categories={categories}
            unitTypes={unitTypes}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader icon={Package} title={item.name} total={0} accent="slate" />
      </SetPageHeader>

      <div className="px-6 pb-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/admin/catalog"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to catalogue
          </Link>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Code</span>
                <span className="font-mono">{item.code}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Kind</span>
                <span className="capitalize">{item.kind}</span>
              </div>
              {item.description && (
                <div>
                  <span className="text-muted-foreground">Description</span>
                  <p className="mt-1">{item.description}</p>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Unit cost</span>
                <span className="tabular-nums">
                  {item.kind === 'assembly'
                    ? (item.computedUnitCost ?? item.fixedUnitCost ?? '—')
                    : (item.unitCost ?? '—')}
                </span>
              </div>
              {item.externalReference && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">External ref</span>
                  <span className="font-mono text-xs">{item.externalReference}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {item.kind === 'assembly' && (
            <CatalogBomEditor
              assemblyId={item.id}
              components={components}
              candidateItems={allItems.filter((i) => i.id !== item.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
