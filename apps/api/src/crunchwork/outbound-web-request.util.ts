const PATH_SEGMENT_TO_ENTITY: Record<string, string> = {
  claims: 'claim',
  jobs: 'job',
  quotes: 'quote',
  'purchase-orders': 'purchase_order',
  invoices: 'invoice',
  messages: 'message',
  tasks: 'task',
  appointments: 'appointment',
  reports: 'report',
  attachments: 'attachment',
  'progress-invoices': 'progress_invoice',
  vendors: 'vendor',
  events: 'event',
  'report-types': 'report_type',
};

const NON_ID_SEGMENTS = new Set(['allocation']);

const SENSITIVE_KEY = /^(authorization|access_token|refresh_token|client_secret|clientsecret|password|webhook_secret|secret|api_key|apikey)$/i;

const MAX_JSON_CHARS = 16_000;

export function appendQueryParamsToUrl(
  url: string,
  queryParams?: unknown,
): string {
  const entries = toQueryEntries(queryParams);
  if (entries.length === 0) return url;

  try {
    const parsed = new URL(url);
    for (const [key, value] of entries) {
      if (!parsed.searchParams.has(key)) {
        parsed.searchParams.append(key, value);
      }
    }
    return parsed.toString();
  } catch {
    const qs = new URLSearchParams(entries).toString();
    if (!qs) return url;
    const separator = url.includes('?')
      ? url.endsWith('?') || url.endsWith('&')
        ? ''
        : '&'
      : '?';
    return `${url}${separator}${qs}`;
  }
}

function toQueryEntries(queryParams: unknown): [string, string][] {
  if (!queryParams || typeof queryParams !== 'object' || Array.isArray(queryParams)) {
    return [];
  }
  return Object.entries(queryParams as Record<string, unknown>)
    .filter(([, value]) => value != null && String(value).length > 0)
    .map(([key, value]) => [key, String(value)]);
}

export function parseEntityFromPath(path: string): {
  entityType: string | null;
  entityId: string | null;
} {
  const clean = path.split('?')[0]?.replace(/^\//, '') ?? '';
  const segments = clean.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { entityType: null, entityId: null };
  }

  const entityType = PATH_SEGMENT_TO_ENTITY[segments[0]] ?? null;

  // Crunchwork typo: GET /quotes/revison/:revisionId
  if (segments[0] === 'quotes' && segments[1] === 'revison' && segments[2]) {
    return { entityType: 'quote', entityId: segments[2] };
  }

  const second = segments[1];
  const entityId =
    second && !NON_ID_SEGMENTS.has(second) ? second : null;

  return { entityType, entityId };
}

export function sanitizeJsonBody(
  value: unknown,
  maxChars = MAX_JSON_CHARS,
): unknown {
  if (value === undefined) return null;
  const redacted = redactSensitive(value);
  try {
    const serialized = JSON.stringify(redacted);
    if (serialized && serialized.length > maxChars) {
      return {
        _truncated: true,
        preview: serialized.slice(0, maxChars),
      };
    }
    return redacted;
  } catch {
    return { _unserializable: true };
  }
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactSensitive(nested);
    }
    return out;
  }
  return value;
}
