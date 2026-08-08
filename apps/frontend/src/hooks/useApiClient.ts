'use client';

import { useMemo } from 'react';
import { createApiClient, type ApiClient } from '@/lib/api-client';

/**
 * Client-side API client hook.
 *
 * Browser calls (no explicit token) are routed through the Next.js BFF at
 * `/api/v1/...`, which attaches the session Bearer token before calling Nest.
 * Do not point the browser at NEXT_PUBLIC_API_URL directly — cookies are
 * httpOnly on the frontend origin and will not authenticate Nest.
 */
export function useApiClient(): ApiClient {
  return useMemo(() => createApiClient(), []);
}
