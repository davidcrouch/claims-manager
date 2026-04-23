'use client';

import Link from 'next/link';
import { FileSpreadsheet, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import type { Quote } from '@/types/api';

export function QuotePageHeader({ quote }: { quote: Quote }) {
  const title = quote.quoteNumber ?? quote.externalReference ?? quote.id;
  const statusName = (quote.status as { name?: string })?.name ?? 'Unknown';

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
      <BackButton href="/quotes" label="Back to quotes" />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <FileSpreadsheet className="h-4 w-4 text-amber-600" />
      </span>
      <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
      <StatusBadge status={statusName} />
      {quote.jobId && (
        <Link
          href={`/jobs/${quote.jobId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View job
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export function QuoteDetail({ quote }: { quote: Quote }) {
  const totalAmount = quote.totalAmount ? `$${quote.totalAmount}` : '—';

  return (
    <div className="space-y-6">
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
