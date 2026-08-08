'use client';

import Link from 'next/link';
import { Calendar, ExternalLink, FileText, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DefRow } from '@/components/shared/detail/DefRow';
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

function formatAddressLine(journal: Journal): string | null {
  const parts = [
    journal.addressSuburb,
    journal.addressState,
    journal.addressPostcode,
    journal.addressCountry,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');

  const street =
    typeof journal.address?.street === 'string'
      ? journal.address.street
      : typeof journal.address?.line1 === 'string'
        ? journal.address.line1
        : null;
  return street;
}

function LocationMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const delta = 0.012;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(',');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <div className="overflow-hidden rounded-md border bg-muted">
      <iframe
        title="Journal location map"
        src={src}
        className="h-56 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          Open in OpenStreetMap
        </a>
      </div>
    </div>
  );
}

export function JournalOverview({ journal, entryCount, job = null }: JournalOverviewProps) {
  const lat = journal.latitude != null ? Number(journal.latitude) : NaN;
  const lng = journal.longitude != null ? Number(journal.longitude) : NaN;
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const addressLine = formatAddressLine(journal);

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

          {hasCoords ? (
            <LocationMap latitude={lat} longitude={lng} />
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
