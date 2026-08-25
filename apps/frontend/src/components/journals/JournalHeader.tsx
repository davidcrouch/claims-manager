'use client';

import Link from 'next/link';
import { BookOpen, ExternalLink, MapPin } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
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
    <PageHeaderLayout
      leading={<BackButton href={backHref} label="Back to journals" />}
      icon={
        <PageHeaderIcon
          icon={BookOpen}
          className="bg-sky-100"
          iconClassName="text-sky-600"
        />
      }
      title={journal.name}
      topRow={
        <>
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
        </>
      }
      bottomRow={
        <>
          {entryCount != null && (
            <PageHeaderField label="Entries">{entryCount}</PageHeaderField>
          )}
          {visitDate && (
            <PageHeaderField label="Visit date">{formatDate(visitDate)}</PageHeaderField>
          )}
          <PageHeaderField label="Updated">
            <span suppressHydrationWarning>{formatDateTime(journal.updatedAt)}</span>
          </PageHeaderField>
        </>
      }
    />
  );
}
