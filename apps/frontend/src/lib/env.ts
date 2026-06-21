/**
 * Environment configuration for the frontend.
 * Validates required env vars at build/runtime.
 *
 * NEXT_PUBLIC_* vars must be accessed as literal `process.env.NEXT_PUBLIC_X`
 * so Next.js can inline them into the client bundle at compile time.
 */

/**
 * Returns the full API base URL: ${NEXT_PUBLIC_API_URL}${NEXT_PUBLIC_API_PREFIX}
 * e.g. http://localhost:5001/api/v1
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5001';
  const prefix = process.env.NEXT_PUBLIC_API_PREFIX ?? '/api/v1';
  return `${url.replace(/\/$/, '')}${prefix.startsWith('/') ? prefix : `/${prefix}`}`;
}

export const env = {
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
  get authServerUrl() {
    return process.env.AUTH_SERVER_URL ?? 'http://localhost:3280';
  },
};
