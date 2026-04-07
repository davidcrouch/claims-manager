'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EntityPanel } from '@/components/ui/entity-panel';
import { InvoiceCard } from './InvoiceCard';
import { fetchInvoicesAction } from '@/app/(app)/invoices/actions';
import { Button } from '@/components/ui/button';
import type { Invoice, PaginatedResponse } from '@/types/api';

export interface InvoicesListClientProps {
  initialData: PaginatedResponse<Invoice>;
  headerAction?: React.ReactNode;
}

export function InvoicesListClient({ initialData, headerAction }: InvoicesListClientProps) {
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
    router.replace(`/invoices?${params}`, { scroll: false });

    if (lastFetchedSearch.current !== debouncedSearch) {
      lastFetchedSearch.current = debouncedSearch;
      fetchInvoicesAction({}).then((res) => res && setData(res));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop: router.replace updates URL -> searchParams changes -> effect re-runs
  }, [debouncedSearch]);

  return (
    <EntityPanel
      searchSlot={
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      }
      headerAction={headerAction}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.data.map((invoice) => (
          <InvoiceCard key={invoice.id} invoice={invoice} />
        ))}
      </div>
      {data.data.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No invoices found.</p>
      )}
    </EntityPanel>
  );
}
