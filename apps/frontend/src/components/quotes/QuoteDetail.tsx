'use client';

import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import type { Quote } from '@/types/api';

export function QuoteDetail({ quote }: { quote: Quote }) {
  const title = quote.quoteNumber ?? quote.externalReference ?? quote.id;
  const statusName = (quote.status as { name?: string })?.name ?? 'Unknown';
  const totalAmount = quote.totalAmount ? `$${quote.totalAmount}` : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            {title}
          </h1>
          <StatusBadge status={statusName} className="mt-2" />
          {quote.jobId && (
            <p className="mt-2 text-sm text-muted-foreground">
              <Link href={`/jobs/${quote.jobId}`} className="hover:underline">
                View job
              </Link>
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-medium">Totals</h2>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Total amount:</span> {totalAmount}</p>
          <p><span className="text-muted-foreground">Quote date:</span> {quote.quoteDate ? new Date(quote.quoteDate).toLocaleDateString() : '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-medium">Quote Details</h2>
        </CardHeader>
        <CardContent className="text-sm">
          <p><span className="text-muted-foreground">Reference:</span> {(quote as { reference?: string }).reference ?? '—'}</p>
          <p><span className="text-muted-foreground">Note:</span> {(quote as { note?: string }).note ?? '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
