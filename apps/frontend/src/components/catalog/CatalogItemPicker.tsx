'use client';

import { useEffect, useState, useTransition } from 'react';
import { Package, Search } from 'lucide-react';
import { BottomFormDrawer } from '@/components/forms/BottomFormDrawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchCatalogItemsAction } from '@/app/(app)/admin/catalog/actions';
import type { CatalogItem } from '@/types/api';

export interface CatalogItemPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind?: 'primitive' | 'assembly';
  onSelect: (item: CatalogItem) => void;
}

export function CatalogItemPicker({
  open,
  onOpenChange,
  kind,
  onSelect,
}: CatalogItemPickerProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const result = await searchCatalogItemsAction({
        q: query || undefined,
        kind,
        limit: 30,
      });
      setItems(result);
    });
  }, [open, query, kind]);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Select catalogue item"
      description="Search by code or name"
      icon={<Package className="h-5 w-5" />}
    >
      <div className="space-y-4 p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {pending && items.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">Loading…</li>
          )}
          {!pending && items.length === 0 && (
            <li className="py-4 text-center text-sm text-muted-foreground">No items found</li>
          )}
          {items.map((item) => (
            <li key={item.id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-3 py-2"
                onClick={() => {
                  onSelect(item);
                  onOpenChange(false);
                }}
              >
                <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
                <span className="ml-2">{item.name}</span>
                <span className="ml-auto capitalize text-xs text-muted-foreground">{item.kind}</span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </BottomFormDrawer>
  );
}
