'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type ListFetchSession = {
  cancelled: boolean;
  cleanup: () => void;
};

/**
 * Dedupes list fetches by key and releases the key if the owning effect is
 * cleaned up before the request lands. `router.replace` / same-page navigation
 * aborts in-flight server actions; without releasing the key the same filters
 * never retry and the table can stick on stale empty rows.
 */
export function useListFetchGate(initialFetchKey?: string | null) {
  const lastFetchKeyRef = useRef<string | null>(initialFetchKey ?? null);

  const beginFetch = useCallback((fetchKey: string): boolean => {
    if (lastFetchKeyRef.current === fetchKey) return false;
    lastFetchKeyRef.current = fetchKey;
    return true;
  }, []);

  const abortFetch = useCallback((fetchKey: string): void => {
    if (lastFetchKeyRef.current === fetchKey) {
      lastFetchKeyRef.current = null;
    }
  }, []);

  const invalidateFetch = useCallback((): void => {
    lastFetchKeyRef.current = null;
  }, []);

  return { beginFetch, abortFetch, invalidateFetch };
}

/** Start a keyed list fetch, or skip if that key already completed. */
export function createListFetchSession(params: {
  fetchKey: string;
  beginFetch: (fetchKey: string) => boolean;
  abortFetch: (fetchKey: string) => void;
}): ListFetchSession | null {
  if (!params.beginFetch(params.fetchKey)) return null;
  const session: ListFetchSession = {
    cancelled: false,
    cleanup() {
      session.cancelled = true;
      params.abortFetch(params.fetchKey);
    },
  };
  return session;
}

/**
 * List rows that stay in sync across same-page searchParam navigations
 * (clearing a job filter, tab/status URL sync). Next.js keeps the client
 * component mounted, so `useState(initialData)` would otherwise keep the
 * previous filter's rows after the server sends a new payload.
 */
export function useListPageData<T>(
  initialData: T,
  options?: { initialFetchKey?: string },
): {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  beginFetch: (fetchKey: string) => boolean;
  abortFetch: (fetchKey: string) => void;
  invalidateFetch: () => void;
} {
  const [data, setData] = useState(initialData);
  const { beginFetch, abortFetch, invalidateFetch } = useListFetchGate(
    options?.initialFetchKey,
  );
  const initialDataRef = useRef(initialData);

  useEffect(() => {
    if (initialDataRef.current === initialData) return;
    initialDataRef.current = initialData;
    setData(initialData);
    invalidateFetch();
  }, [initialData, invalidateFetch]);

  return { data, setData, beginFetch, abortFetch, invalidateFetch };
}

/**
 * Sync the list query string. Returns true when the URL already matches so
 * the caller may fetch. False means `replace` was issued — do not start a
 * server action on this tick; navigation would abort it. The effect must
 * list `searchParams` in its deps so it re-runs after the URL settles.
 */
export function replaceListQueryIfNeeded(params: {
  router: { replace: (href: string, opts?: { scroll?: boolean }) => void };
  pathname: string;
  currentQuery: string;
  nextQuery: string;
}): boolean {
  if (params.nextQuery === params.currentQuery) return true;
  const href = params.nextQuery
    ? `${params.pathname}?${params.nextQuery}`
    : params.pathname;
  params.router.replace(href, { scroll: false });
  return false;
}
