import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { getUpstreamApiAuth } from '@/lib/upstream-api';

const LOG = 'frontend:api/address-autocomplete';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const PLACES_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const UA = 'EnsureOS-ClaimsManager/1.0 (address-autocomplete)';
const MIN_QUERY_LENGTH = 3;
const LIMIT = 8;

const STATE_ABBREV: Record<string, string> = {
  'new south wales': 'NSW',
  nsw: 'NSW',
  victoria: 'VIC',
  vic: 'VIC',
  queensland: 'QLD',
  qld: 'QLD',
  'south australia': 'SA',
  sa: 'SA',
  'western australia': 'WA',
  wa: 'WA',
  tasmania: 'TAS',
  tas: 'TAS',
  'northern territory': 'NT',
  nt: 'NT',
  'australian capital territory': 'ACT',
  act: 'ACT',
};

export type AddressParts = {
  unitNumber?: string;
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
};

export type AddressSuggestion = {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  parts: AddressParts;
};

function abbreviateState(state?: string): string {
  if (!state) return '';
  return STATE_ABBREV[state.trim().toLowerCase()] ?? state.trim();
}

function typedPremise(query: string): string | null {
  const m = query.trim().match(/^(\d+\s*\/\s*\d+[a-zA-Z]?|\d+[a-zA-Z]?)\b/);
  return m ? m[1].replace(/\s+/g, '') : null;
}

function applyPremise(primary: string, premise: string | null): string {
  if (!premise) return primary;
  if (
    new RegExp(`^${premise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
      primary,
    )
  ) {
    return primary;
  }
  if (/^\d/.test(primary)) return primary;
  return `${premise} ${primary}`;
}

function parsePrimaryLine(primary: string): Pick<
  AddressParts,
  'unitNumber' | 'streetNumber' | 'streetName'
> {
  const trimmed = primary.trim();
  const unitStreet = trimmed.match(
    /^(\d+[a-zA-Z]?)\s*\/\s*(\d+[a-zA-Z]?)\s+(.+)$/,
  );
  if (unitStreet) {
    return {
      unitNumber: unitStreet[1],
      streetNumber: unitStreet[2],
      streetName: unitStreet[3].trim(),
    };
  }
  const numbered = trimmed.match(/^(\d+[a-zA-Z]?)\s+(.+)$/);
  if (numbered) {
    return {
      streetNumber: numbered[1],
      streetName: numbered[2].trim(),
    };
  }
  return { streetName: trimmed || undefined };
}

function parseSecondaryLine(secondary: string): Pick<
  AddressParts,
  'suburb' | 'state' | 'postcode'
> {
  const bits = secondary
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  let suburb: string | undefined;
  let state: string | undefined;
  let postcode: string | undefined;

  for (const bit of bits) {
    const upper = bit.toUpperCase();
    if (!state && STATE_ABBREV[bit.toLowerCase()]) {
      state = abbreviateState(bit);
      continue;
    }
    if (!postcode && /^\d{4}$/.test(bit)) {
      postcode = bit;
      continue;
    }
    if (!suburb && !/^\d{4}$/.test(bit) && !STATE_ABBREV[bit.toLowerCase()]) {
      suburb = bit;
      continue;
    }
    if (!state && /^[A-Z]{2,3}$/.test(upper) && STATE_ABBREV[upper.toLowerCase()]) {
      state = upper;
    }
  }

  return { suburb, state, postcode };
}

function buildParts(args: {
  primary: string;
  secondary: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
}): AddressParts {
  const fromPrimary = parsePrimaryLine(args.primary);
  const fromSecondary = parseSecondaryLine(args.secondary);
  return {
    ...fromPrimary,
    suburb: args.suburb || fromSecondary.suburb,
    state: abbreviateState(args.state) || fromSecondary.state,
    postcode: args.postcode || fromSecondary.postcode,
    country: args.country || 'Australia',
  };
}

function buildSuggestion(
  id: string,
  primary: string,
  secondary: string,
  premise: string | null,
  extras?: Partial<AddressParts>,
): AddressSuggestion | null {
  const line = applyPremise(primary.trim(), premise);
  if (!line) return null;
  const label = secondary ? `${line}, ${secondary}` : line;
  return {
    id,
    label,
    primary: line,
    secondary,
    parts: buildParts({
      primary: line,
      secondary,
      suburb: extras?.suburb,
      state: extras?.state,
      postcode: extras?.postcode,
      country: extras?.country,
    }),
  };
}

type PhotonProperties = {
  osm_id?: number;
  osm_type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  district?: string;
  city?: string;
  locality?: string;
  postcode?: string;
  state?: string;
  countrycode?: string;
};

type NominatimHit = {
  place_id?: number;
  name?: string;
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    suburb?: string;
    city_district?: string;
    town?: string;
    village?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
};

type GooglePrediction = {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
};

async function searchGooglePlaces(query: string): Promise<AddressSuggestion[]> {
  const key = env.googleMapsApiKey;
  if (!key) return [];

  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input: query,
      includedRegionCodes: ['au'],
      languageCode: 'en-AU',
      regionCode: 'AU',
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(
      `${LOG}.searchGooglePlaces — status=${res.status} ${body.slice(0, 200)}`,
    );
    return [];
  }

  const data = (await res.json()) as { suggestions?: GooglePrediction[] };
  const out: AddressSuggestion[] = [];
  for (const row of data.suggestions ?? []) {
    const pred = row.placePrediction;
    if (!pred) continue;
    const primary =
      pred.structuredFormat?.mainText?.text?.trim() ||
      pred.text?.text?.split(',')[0]?.trim() ||
      '';
    const secondary = (pred.structuredFormat?.secondaryText?.text ?? '')
      .replace(/,?\s*Australia$/i, '')
      .trim();
    const label =
      pred.text?.text?.replace(/,?\s*Australia$/i, '').trim() || primary;
    if (!primary && !label) continue;
    const suggestion = buildSuggestion(
      pred.placeId ?? label,
      primary || label,
      secondary,
      null,
    );
    if (suggestion) {
      if (!suggestion.label) suggestion.label = label;
      out.push(suggestion);
    }
  }
  return out;
}

async function searchPhoton(
  query: string,
  premise: string | null,
): Promise<AddressSuggestion[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(LIMIT));
  url.searchParams.set('lang', 'en');
  url.searchParams.set('lat', '-25.27');
  url.searchParams.set('lon', '133.77');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`${LOG}.searchPhoton — status=${res.status}`);
    return [];
  }

  const data = (await res.json()) as {
    features?: Array<{ properties?: PhotonProperties }>;
  };
  const out: AddressSuggestion[] = [];
  for (const feature of data.features ?? []) {
    const props = feature.properties ?? {};
    const cc = (props.countrycode ?? '').toUpperCase();
    if (cc && cc !== 'AU') continue;
    const primary = [props.housenumber, props.street || props.name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const suburb = props.district || props.locality || props.city || '';
    const state = abbreviateState(props.state);
    const secondary = [suburb, state, props.postcode].filter(Boolean).join(', ');
    const suggestion = buildSuggestion(
      `photon:${props.osm_type ?? 'n'}:${props.osm_id ?? primary}`,
      primary,
      secondary,
      premise,
      {
        suburb: suburb || undefined,
        state: state || undefined,
        postcode: props.postcode,
        country: 'Australia',
      },
    );
    if (suggestion) out.push(suggestion);
  }
  return out;
}

async function searchNominatim(
  query: string,
  premise: string | null,
): Promise<AddressSuggestion[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'au');
  url.searchParams.set('limit', String(LIMIT));

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`${LOG}.searchNominatim — status=${res.status}`);
    return [];
  }

  const rows = (await res.json()) as NominatimHit[];
  const out: AddressSuggestion[] = [];
  for (const item of rows) {
    const a = item.address ?? {};
    const primary = [a.house_number, a.road || a.pedestrian || item.name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const suburb =
      a.suburb || a.city_district || a.town || a.village || a.city || '';
    const state = abbreviateState(a.state);
    const secondary = [suburb, state, a.postcode].filter(Boolean).join(', ');
    const displayPrimary = (item.display_name || '').split(',')[0] || '';
    const suggestion = buildSuggestion(
      `nominatim:${item.place_id || primary}`,
      primary || displayPrimary,
      secondary,
      premise,
      {
        suburb: suburb || undefined,
        state: state || undefined,
        postcode: a.postcode,
        country: 'Australia',
      },
    );
    if (suggestion) out.push(suggestion);
  }
  return out;
}

function mergeSuggestions(groups: AddressSuggestion[][]): AddressSuggestion[] {
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const group of groups) {
    for (const item of group) {
      const key = item.label.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= LIMIT) return out;
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await getUpstreamApiAuth();
  if (!auth) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] as AddressSuggestion[] });
  }

  const premise = typedPremise(q);

  try {
    const google = await searchGooglePlaces(q);
    if (google.length > 0) {
      return NextResponse.json({ suggestions: google.slice(0, LIMIT) });
    }

    const [photon, nominatim] = await Promise.all([
      searchPhoton(q, premise),
      searchNominatim(q, premise),
    ]);

    return NextResponse.json({
      suggestions: mergeSuggestions([nominatim, photon]),
    });
  } catch (err) {
    console.error(`${LOG}.GET`, err);
    return NextResponse.json({ suggestions: [] as AddressSuggestion[] });
  }
}
