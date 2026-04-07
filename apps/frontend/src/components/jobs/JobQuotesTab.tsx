'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuoteFormDrawer } from '@/components/forms/QuoteFormDrawer';
import type { Quote } from '@/types/api';
import { FileText } from 'lucide-react';

export function JobQuotesTab({ jobId, claimId }: { jobId: string; claimId: string }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobQuotesAction(jobId);
      setQuotes(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Create Quote
        </Button>
      </div>
      <QuoteFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) loadQuotes();
        }}
        jobId={jobId}
        claimId={claimId}
      />
      {quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No quotes.</p>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <Card key={q.id}>
              <CardContent className="py-3">
                <Link href={`/quotes/${q.id}`} className="font-medium hover:underline">
                  {q.quoteNumber ?? q.externalReference ?? q.id}
                </Link>
                <p className="text-sm text-muted-foreground mt-1">
                  {q.totalAmount ? `$${q.totalAmount}` : ''} • {(q.status as { name?: string })?.name ?? '—'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
