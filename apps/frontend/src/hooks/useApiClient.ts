'use client';

import { useMemo } from 'react';
import { createApiClient, type ApiClient } from '@/lib/api-client';

/**
 * Client-side API client hook.
 * For client components that need to make API calls directly.
 * Authentication is handled via cookie-based session (no explicit token needed client-side
 * since the API proxy will forward cookies).
 */
export function useApiClient(): ApiClient {
  return useMemo(() => createApiClient(), []);
}
