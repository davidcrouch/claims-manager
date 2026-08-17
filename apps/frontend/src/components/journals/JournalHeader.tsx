'use client';

import Link from 'next/link';
import { BookOpen, ExternalLink, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import { formatAddress, formatDate, formatDateTime } from '@/components/shared/detail';
import { jobDisplayName } from '@/components/shared/job-label';
import type { Job, Journal } from '@/types/api';

function addressLine(journal: Journal): string {
  return formatAddress((journal.address ?? {}) as Record<string, unknown>, {
    fallback: {
      suburb: journal.addressSuburb,
      state: journal.addressState,
      postcode: journal.addressPostcode,
      country: journal.addressCountry,
    },
  });
}

/**
 * Compact page-header for the journal detail page (/journals/[id]).
 * Designed to live inside the top title bar via `SetPageHeader`.
 */
export function JournalPageHeader({
  journal,
  job = null,
  entryCount,
}: {
  journal: Journal;
  job?: Job | null;
  entryCount?: number;
}) {
  const address = addressLine(journal);
  const visitDate =
    typeof journal.metadata?.visitDate === 'string' ? journal.metadata.visitDate : null;
  const backHref = job ? `/journals?jobId=${job.id}` : '/journals';

  return (
    <div className="flex w-full min-w-0 flex-col gap-y-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href={backHref} label="Back to journals" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100">
          <BookOpen className="h-4 w-4 text-sky-600" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{journal.name}</h1>
        <StatusBadge status={journal.status} />
        {address && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {address}
          </span>
        )}
        {job && (
          <Link
            href={`/jobs/${job.id}`}
            className="inline-flex items-center gap-1 text-xs uppercase text-primary hover:underline"
          >
            {jobDisplayName(job)}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-20 text-xs">
        {entryCount != null && (
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Entries:</span>
            <span className="font-medium">{entryCount}</span>
          </div>
        )}
        {visitDate && (
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Visit date:</span>
            <span className="font-medium">{formatDate(visitDate)}</span>
          </div>
        )}
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium" suppressHydrationWarning>
            {formatDateTime(journal.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
