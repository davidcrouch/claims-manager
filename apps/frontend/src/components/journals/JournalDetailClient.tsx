'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageTimeline } from './PageTimeline';
import { PageEntryForm } from './PageEntryForm';
import { useApiClient } from '@/hooks/useApiClient';
import type { Journal, JournalPage } from '@/types/api';

export interface JournalDetailClientProps {
  journal: Journal;
  initialPages: { data: JournalPage[]; total: number };
}

export function JournalDetailClient({ journal, initialPages }: JournalDetailClientProps) {
  const api = useApiClient();
  const [pages, setPages] = useState<JournalPage[]>(initialPages.data);
  const [totalCount, setTotalCount] = useState(initialPages.total);

  const handlePageCreated = (page: JournalPage) => {
    setPages((prev) => [...prev, page]);
    setTotalCount((prev) => prev + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Journal header info */}
      <div className="space-y-2">
        {journal.description && (
          <p className="text-sm text-muted-foreground">{journal.description}</p>
        )}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="secondary">{journal.status}</Badge>
          {(journal.latitude || journal.addressSuburb) && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {journal.addressSuburb ??
                `${Number(journal.latitude).toFixed(4)}, ${Number(journal.longitude).toFixed(4)}`}
            </span>
          )}
          <span>{totalCount} {totalCount === 1 ? 'entry' : 'entries'}</span>
        </div>
      </div>

      {/* Entry form */}
      {api && (
        <PageEntryForm journalId={journal.id} api={api} onCreated={handlePageCreated} />
      )}

      {/* Timeline of pages */}
      <PageTimeline pages={pages} />
    </div>
  );
}
