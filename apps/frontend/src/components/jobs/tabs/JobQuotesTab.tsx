'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuoteFormDrawer } from '@/components/forms/QuoteFormDrawer';
import { QuotesTable } from '@/components/quotes/QuotesTable';
import { QuoteDetail } from '@/components/quotes/QuoteDetail';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import { fetchQuoteAction } from '@/app/(app)/quotes/actions';
import type { Quote } from '@/types/api';

export function JobQuotesTab({
  jobId,
  claimId,
}: {
  jobId: string;
  claimId: string;
}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobQuotesAction(jobId);
      setQuotes(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRowClick(q: Quote) {
    setDetailLoading(true);
    try {
      const full = await fetchQuoteAction(q.id);
      if (full) setSelectedQuote(full);
    } finally {
      setDetailLoading(false);
    }
  }

  if (selectedQuote) {
    return <QuoteDetail quote={selectedQuote} />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Estimates ({quotes.length})</CardTitle>
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create Estimate
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {loading || detailLoading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : quotes.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">
              No estimates for this job.
            </p>
          ) : (
            <div className="px-4">
              <QuotesTable
                quotes={quotes}
                onRowClick={handleRowClick}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <QuoteFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
        claimId={claimId}
      />
    </>
  );
}
