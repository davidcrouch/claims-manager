'use client';

import Link from 'next/link';
import { Calendar, ExternalLink, FileText, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DefRow,
  formatAddress,
  formatStreetLine,
  type AddressLike,
} from '@/components/shared/detail';
import { LocationMap } from '@/components/shared/LocationMap';
import { jobDisplayName } from '@/components/shared/job-label';
import type { Job, Journal } from '@/types/api';

export interface JournalOverviewProps {
  journal: Journal;
  entryCount: number;
  job?: Job | null;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Prefer local calendar date for YYYY-MM-DD visit dates (avoid UTC shift). */
function formatVisitDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return value;
}

function journalAddressLike(journal: Journal): AddressLike {
  return (journal.address ?? {}) as AddressLike;
}

function journalAddressFallback(journal: Journal) {
  return {
    suburb: journal.addressSuburb,
    state: journal.addressState,
    postcode: journal.addressPostcode,
    country: journal.addressCountry,
  };
}

function journalAddressQuery(journal: Journal): string | null {
  const formatted = formatAddress(journalAddressLike(journal), {
    full: true,
    fallback: journalAddressFallback(journal),
  }).trim();
  return formatted || null;
}

export function JournalOverview({ journal, entryCount, job = null }: JournalOverviewProps) {
  const lat = journal.latitude != null ? Number(journal.latitude) : NaN;
  const lng = journal.longitude != null ? Number(journal.longitude) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const addressQuery = journalAddressQuery(journal);
  const streetLine = formatStreetLine(journalAddressLike(journal));
  const addressLine = streetLine || addressQuery;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DefRow label="Name" value={journal.name} />
          <DefRow
            label="Job"
            value={
              job ? (
                <Link
                  href={`/jobs/${job.id}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {jobDisplayName(job)}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Status"
            value={<Badge variant="secondary">{journal.status}</Badge>}
          />
          <DefRow
            label="Description"
            value={
              journal.description?.trim() ? (
                <span className="whitespace-pre-wrap">{journal.description}</span>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Entries"
            value={`${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
          />
          {typeof journal.metadata?.visitDate === 'string' && journal.metadata.visitDate && (
            <DefRow
              label="Visit date"
              value={formatVisitDate(journal.metadata.visitDate)}
            />
          )}
          <DefRow
            label="Created"
            value={
              <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
                <Calendar className="size-3.5 text-muted-foreground" />
                {formatDateTime(journal.createdAt)}
              </span>
            }
          />
          <DefRow
            label="Updated"
            value={<span suppressHydrationWarning>{formatDateTime(journal.updatedAt)}</span>}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DefRow label="Suburb" value={journal.addressSuburb ?? '—'} />
          <DefRow label="State" value={journal.addressState ?? '—'} />
          <DefRow label="Postcode" value={journal.addressPostcode ?? '—'} />
          <DefRow label="Country" value={journal.addressCountry ?? '—'} />
          <DefRow label="Address" value={addressLine ?? '—'} />
          <DefRow
            label="Coordinates"
            value={
              hasCoords
                ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                : '—'
            }
          />

          {hasCoords || addressQuery ? (
            <LocationMap
              title="Journal location map"
              latitude={hasCoords ? lat : undefined}
              longitude={hasCoords ? lng : undefined}
              address={addressQuery}
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              No map location available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
