'use client';

import { useEffect, useState } from 'react';

type MapCoords = { latitude: number; longitude: number };

const geocodeCache = new Map<string, MapCoords | null>();

async function geocodeAddress(
  query: string,
  signal: AbortSignal,
): Promise<MapCoords | null> {
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
    console.error(
      `[shared/LocationMap.geocodeAddress] Nominatim returned ${res.status}`,
    );
    geocodeCache.set(query, null);
    return null;
  }

  const data: unknown = await res.json();
  const first = Array.isArray(data) ? data[0] : null;
  const lat =
    first && typeof first === 'object' && 'lat' in first
      ? Number(first.lat)
      : NaN;
  const lon =
    first && typeof first === 'object' && 'lon' in first
      ? Number(first.lon)
      : NaN;
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

export function LocationMap({
  latitude,
  longitude,
  address,
  title = 'Location map',
  className,
  mapClassName = 'h-56 w-full border-0',
}: {
  latitude?: number;
  longitude?: number;
  address?: string | null;
  title?: string;
  className?: string;
  mapClassName?: string;
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
        console.error('[shared/LocationMap] geocode failed', err);
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
      <div
        className={`flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground ${className ?? ''}`}
      >
        Locating address on map…
      </div>
    );
  }

  if (status === 'error' || !resolved) {
    return (
      <div
        className={`flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground ${className ?? ''}`}
      >
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
    <div
      className={`overflow-hidden rounded-md border bg-muted ${className ?? ''}`}
    >
      <iframe
        title={title}
        src={osmEmbedSrc(lat, lng)}
        className={mapClassName}
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
