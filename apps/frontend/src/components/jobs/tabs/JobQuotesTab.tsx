'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { QuoteFormDrawer } from '@/components/forms/QuoteFormDrawer';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import { formatDate, formatCurrency } from '@/components/shared/detail';
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
          if (!open) load();
        }}
        jobId={jobId}
        claimId={claimId}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Quotes ({quotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : quotes.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">No quotes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Quote #</th>
                    <th className="px-4 py-2">External ref</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Quote date</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {quotes.map((q) => {
                    const statusName = q.status?.name ?? 'Unknown';
                    return (
                      <tr key={q.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">
                          {q.quoteNumber ?? q.id}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {q.externalReference ?? '—'}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge status={statusName} />
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(q.quoteDate)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatCurrency(q.totalAmount)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
