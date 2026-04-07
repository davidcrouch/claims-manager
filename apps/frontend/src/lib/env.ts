/**
 * Environment configuration for the frontend.
 * Validates required env vars at build/runtime.
 */

function getEnvVar(name: string): string | undefined {
  return process.env[name];
}

/**
 * Returns the full API base URL: ${NEXT_PUBLIC_API_URL}${NEXT_PUBLIC_API_PREFIX}
 * e.g. http://localhost:3001/api/v1
 */
export function getApiBaseUrl(): string {
  const url = getEnvVar('NEXT_PUBLIC_API_URL') ?? 'http://localhost:3001';
  const prefix = getEnvVar('NEXT_PUBLIC_API_PREFIX') ?? '/api/v1';
  return `${url.replace(/\/$/, '')}${prefix.startsWith('/') ? prefix : `/${prefix}`}`;
}

export const env = {
  get apiBaseUrl() {
    return getApiBaseUrl();
  },
  get authServerUrl() {
    return getEnvVar('AUTH_SERVER_URL') ?? 'http://localhost:3280';
  },
};
