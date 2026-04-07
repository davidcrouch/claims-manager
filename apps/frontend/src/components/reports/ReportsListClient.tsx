'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EntityPanel } from '@/components/ui/entity-panel';
import { ReportCard } from './ReportCard';
import { fetchReportsAction } from '@/app/(app)/reports/actions';
import type { Report, PaginatedResponse } from '@/types/api';

export interface ReportsListClientProps {
  initialData: PaginatedResponse<Report>;
}

export function ReportsListClient({ initialData }: ReportsListClientProps) {
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
    router.replace(`/reports?${params}`, { scroll: false });

    if (lastFetchedSearch.current !== debouncedSearch) {
      lastFetchedSearch.current = debouncedSearch;
      fetchReportsAction({}).then((res) => res && setData(res));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop: router.replace updates URL -> searchParams changes -> effect re-runs
  }, [debouncedSearch]);

  return (
    <EntityPanel
      searchSlot={
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.data.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
      {data.data.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No reports found.</p>
      )}
    </EntityPanel>
  );
}
