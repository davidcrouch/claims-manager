'use client';

import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import { EntityCard } from '@/components/ui/entity-card';
import type { Quote } from '@/types/api';

export function QuoteCard({ quote }: { quote: Quote }) {
  const title = quote.quoteNumber ?? quote.externalReference ?? quote.id;
  const jobRef = (quote as { job?: { externalReference?: string } }).job?.externalReference ?? quote.jobId ?? '';
  const statusName = (quote.status as { name?: string })?.name ?? 'Unknown';
  const totalAmount = quote.totalAmount ? `$${quote.totalAmount}` : '';

  return (
    <EntityCard
      href={`/quotes/${quote.id}`}
      icon={FileSpreadsheet}
      accentColor="border-l-emerald-500"
      title={title}
      subtitle={jobRef ? `Job: ${jobRef}` : undefined}
      badge={statusName}
      footer={
        <>
          {totalAmount}
          {quote.jobId && (
            <>
              {' • '}
              <Link href={`/jobs/${quote.jobId}`} className="hover:underline">
                Job
              </Link>
            </>
          )}
        </>
      }
    />
  );
}
