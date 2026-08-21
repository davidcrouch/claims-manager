'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, FolderPlus, Library, Package, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { CatalogFormDrawer } from '@/components/catalog/CatalogFormDrawer';
import type { Catalog } from '@/types/api';

export interface CatalogListPageClientProps {
  catalogs: Catalog[];
}

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  crunchwork: {
    label: 'Crunchwork',
    className: 'bg-blue-100 text-blue-800',
  },
  internal: {
    label: 'Internal',
    className: 'bg-slate-100 text-slate-700',
  },
};

export function CatalogListPageClient({ catalogs }: CatalogListPageClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);

  return (
    <>
      <SetPageHeader>
        <ListPageHeader icon={Library} title="Catalogues" total={catalogs.length} />
      </SetPageHeader>

      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setCreateOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Plus className="h-3.5 w-3.5" />
          New Catalogue
        </Button>
      </SetHeaderActions>

      {catalogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">No catalogues yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create a catalogue to organise your items. You can have separate
            catalogues for Crunchwork imports and internal rates.
          </p>
          <Button className="mt-6" onClick={() => setCreateOpen(true)}>
            <FolderPlus className="mr-1 h-4 w-4" />
            Create first catalogue
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 px-6 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs.map((catalog) => {
            const badge = TYPE_BADGES[catalog.type] ?? TYPE_BADGES.internal;
            return (
              <div
                key={catalog.id}
                className="group relative flex flex-col rounded-lg border border-border bg-background p-5 shadow-sm transition-colors hover:border-amber-300 hover:shadow-md"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Settings for ${catalog.name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingCatalog(catalog);
                  }}
                >
                  <Settings className="h-4 w-4" />
                </Button>

                <Link
                  href={`/admin/catalog/${catalog.id}`}
                  className="flex min-w-0 flex-1 flex-col pr-8"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold group-hover:text-amber-700">
                        {catalog.name}
                      </h3>
                      {catalog.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {catalog.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    {catalog.isDefault && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      {catalog.itemCount ?? 0} items
                    </span>
                    <span>
                      Updated{' '}
                      {new Date(catalog.updatedAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <CatalogFormDrawer open={createOpen} onOpenChange={setCreateOpen} />

      <CatalogFormDrawer
        open={!!editingCatalog}
        onOpenChange={(open) => {
          if (!open) setEditingCatalog(null);
        }}
        catalog={editingCatalog ?? undefined}
      />
    </>
  );
}
