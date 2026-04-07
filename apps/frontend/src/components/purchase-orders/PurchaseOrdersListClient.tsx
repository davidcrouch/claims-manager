'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EntityPanel } from '@/components/ui/entity-panel';
import { PurchaseOrderCard } from './PurchaseOrderCard';
import { fetchPurchaseOrdersAction } from '@/app/(app)/purchase-orders/actions';
import type { PurchaseOrder, PaginatedResponse } from '@/types/api';

export interface PurchaseOrdersListClientProps {
  initialData: PaginatedResponse<PurchaseOrder>;
}

export function PurchaseOrdersListClient({ initialData }: PurchaseOrdersListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const initialSearch = searchParams.get('search') ?? '';
  const lastFetchedSearch = useRef<string | null>(initialSearch);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('search', debouncedSearch);
    params.set('page', '1');
    router.replace(`/purchase-orders?${params}`, { scroll: false });

    if (lastFetchedSearch.current !== debouncedSearch) {
      lastFetchedSearch.current = debouncedSearch;
      fetchPurchaseOrdersAction({}).then((res) => res && setData(res));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop: router.replace updates URL -> searchParams changes -> effect re-runs
  }, [debouncedSearch]);

  return (
    <EntityPanel
      searchSlot={
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search purchase orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.data.map((po) => (
          <PurchaseOrderCard key={po.id} po={po} />
        ))}
      </div>
      {data.data.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No purchase orders found.</p>
      )}
    </EntityPanel>
  );
}
