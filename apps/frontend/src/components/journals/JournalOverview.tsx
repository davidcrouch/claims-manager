'use client';

import { useEffect, useState } from 'react';
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

type MapCoords = { latitude: number; longitude: number };

const geocodeCache = new Map<string, MapCoords | null>();

async function geocodeAddress(query: string, signal: AbortSignal): Promise<MapCoords | null> {
  if (geocodeCache.has(query)) return geocodeCache.get(query) ?? null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    console.error(`[journals/JournalOverview.geocodeAddress] Nominatim returned ${res.status}`);
    geocodeCache.set(query, null);
    return null;
  }

  const data: unknown = await res.json();
  const first = Array.isArray(data) ? data[0] : null;
  const lat = first && typeof first === 'object' && 'lat' in first ? Number(first.lat) : NaN;
  const lon = first && typeof first === 'object' && 'lon' in first ? Number(first.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    geocodeCache.set(query, null);
    return null;
  }

  const coords = { latitude: lat, longitude: lon };
  geocodeCache.set(query, coords);
  return coords;
}

function osmEmbedSrc(latitude: number, longitude: number) {
  const delta = 0.012;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

function LocationMap({
  latitude,
  longitude,
  address,
}: {
  latitude?: number;
  longitude?: number;
  address?: string | null;
}) {
  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  const [resolved, setResolved] = useState<MapCoords | null>(
    hasCoords ? { latitude: latitude!, longitude: longitude! } : null,
  );
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>(
    hasCoords ? 'ready' : address ? 'loading' : 'error',
  );

  useEffect(() => {
    if (hasCoords) {
      setResolved({ latitude: latitude!, longitude: longitude! });
      setStatus('ready');
      return;
    }

    if (!address) {
      setResolved(null);
      setStatus('error');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setResolved(null);

    geocodeAddress(address, controller.signal)
      .then((coords) => {
        if (controller.signal.aborted) return;
        if (!coords) {
          setResolved(null);
          setStatus('error');
          return;
        }
        setResolved(coords);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error('[journals/JournalOverview.LocationMap] geocode failed', err);
        setResolved(null);
        setStatus('error');
      });

    return () => controller.abort();
  }, [hasCoords, latitude, longitude, address]);

  const osmSearchHref = address
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`
    : null;

  if (status === 'loading') {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Locating address on map…
      </div>
    );
  }

  if (status === 'error' || !resolved) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">
        <span>No map location available</span>
        {osmSearchHref && (
          <a
            href={osmSearchHref}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Search address on OpenStreetMap
          </a>
        )}
      </div>
    );
  }

  const { latitude: lat, longitude: lng } = resolved;
  const fromAddress = !hasCoords && Boolean(address);

  return (
    <div className="overflow-hidden rounded-md border bg-muted">
      <iframe
        title="Journal location map"
        src={osmEmbedSrc(lat, lng)}
        className="h-56 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        {fromAddress && <span>Approximate location from address · </span>}
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
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
