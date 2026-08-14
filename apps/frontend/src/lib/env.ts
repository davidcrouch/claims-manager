/**
 * Environment configuration for the frontend.
 *
 * Server-side API calls MUST use `API_URL` (non-NEXT_PUBLIC). Next.js replaces
 * `process.env.NEXT_PUBLIC_*` (including dynamic lookups) with a static object
 * baked at build time. The Docker build ARG defaults to "", which produces
 * relative URLs like `/api/v1/...` and breaks Cloud Run proxies.
 */

function readEnv(name: string): string | undefined {
  // Avoid literal `process.env.NEXT_PUBLIC_*` so Next cannot inline empties.
  const value = (process.env as Record<string, string | undefined>)[name];
  if (value == null) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Returns the full API base URL: ${API_URL|NEXT_PUBLIC_API_URL}${prefix}
 * e.g. http://localhost:5001/api/v1
 */
export function getApiBaseUrl(): string {
  const url =
    readEnv('API_URL') ??
    readEnv('NEXT_PUBLIC_API_URL') ??
    'http://localhost:5001';
  const prefix =
    readEnv('API_PREFIX') ??
    readEnv('NEXT_PUBLIC_API_PREFIX') ??
    '/api/v1';
  return `${url.replace(/\/$/, '')}${prefix.startsWith('/') ? prefix : `/${prefix}`}`;
}

export const env = {
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
  get authServerUrl() {
    return readEnv('AUTH_SERVER_URL') ?? 'http://localhost:3280';
  },
  /** Server-only Google Maps/Places key for address autocomplete. */
  get googleMapsApiKey() {
    return (
      readEnv('GOOGLE_MAPS_API_KEY') ??
      readEnv('GOOGLE_PLACES_API_KEY') ??
      readEnv('MAPS_API_KEY')
    );
  },
};
