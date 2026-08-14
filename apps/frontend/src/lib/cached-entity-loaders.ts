/**
 * Per-request cached entity loaders for Server Components.
 * Dedupes generateMetadata + page fetches on the same navigation.
 */

import { cache } from 'react';
import { getServerApiClient } from '@/lib/server-api';

export const loadClaim = cache(async (id: string) => {
  const api = await getServerApiClient();
  if (!api) return null;
  return api.getClaim(id).catch((err: unknown) => {
    console.error(
      'frontend:cached-entity-loaders:loadClaim — failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
});

export const loadJob = cache(async (id: string) => {
  const api = await getServerApiClient();
  if (!api) return null;
  return api.getJob(id).catch((err: unknown) => {
    console.error(
      'frontend:cached-entity-loaders:loadJob — failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
});

export const loadQuote = cache(async (id: string) => {
  const api = await getServerApiClient();
  if (!api) return null;
  return api.getQuote(id).catch((err: unknown) => {
    console.error(
      'frontend:cached-entity-loaders:loadQuote — failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
});

export const loadInvoice = cache(async (id: string) => {
  const api = await getServerApiClient();
  if (!api) return null;
  return api.getInvoice(id).catch((err: unknown) => {
    console.error(
      'frontend:cached-entity-loaders:loadInvoice — failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
});
