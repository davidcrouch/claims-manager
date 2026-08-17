/**
 * Per-request cached entity loaders for Server Components.
 * Dedupes generateMetadata + page fetches on the same navigation.
 *
 * Real HTTP 404 → null (caller may notFound()).
 * Network / other failures rethrow so error.tsx can recover.
 */

import { cache } from 'react';
import { ApiError } from '@/lib/api-client';
import { getServerApiClient } from '@/lib/server-api';

function isNotFoundError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

export const loadClaim = cache(async (id: string) => {
  const api = await getServerApiClient();
  if (!api) return null;
  try {
    return await api.getClaim(id);
  } catch (err: unknown) {
    if (isNotFoundError(err)) return null;
    console.error(
      'frontend:cached-entity-loaders:loadClaim — failed:',
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
});

export const loadJob = cache(async (id: string) => {
  const api = await getServerApiClient();
  if (!api) return null;
  try {
    return await api.getJob(id);
  } catch (err: unknown) {
    if (isNotFoundError(err)) return null;
    console.error(
      'frontend:cached-entity-loaders:loadJob — failed:',
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
});

export const loadQuote = cache(async (id: string) => {
  const api = await getServerApiClient();
  if (!api) return null;
  try {
    return await api.getQuote(id);
  } catch (err: unknown) {
    if (isNotFoundError(err)) return null;
    console.error(
      'frontend:cached-entity-loaders:loadQuote — failed:',
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
});

export const loadInvoice = cache(async (id: string) => {
  const api = await getServerApiClient();
  if (!api) return null;
  try {
    return await api.getInvoice(id);
  } catch (err: unknown) {
    if (isNotFoundError(err)) return null;
    console.error(
      'frontend:cached-entity-loaders:loadInvoice — failed:',
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
});
