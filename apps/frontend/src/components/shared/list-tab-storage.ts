'use client';

/**
 * Persist Active / Archived / All / My-* list tab preferences in localStorage.
 * URL `?tab=` wins when present; otherwise the stored value is restored on mount.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'ensureos:list-tab:';

/** Active / Archived / All — for job-scoped lists that hide the My-* tab. */
export const ARCHIVE_ONLY_LIST_TABS = ['active', 'archived', 'all'] as const;

export function readStoredListTab(storageKey: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function writeStoredListTab(storageKey: string, tab: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, tab);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function usePersistedListTab<T extends string>(options: {
  storageKey: string;
  urlTab: string | null | undefined;
  parse: (value: string | null | undefined) => T;
  /**
   * Used when the URL has no `tab` (e.g. legacy `assignedToUserId`).
   * Skips localStorage restore so the fallback wins for this visit.
   */
  fallbackTab?: T;
  /** When true, do not read or write localStorage (picker / embedded contexts). */
  disabled?: boolean;
  /** If set, ignore stored/URL values outside this set when restoring. */
  allowedTabs?: readonly string[];
}): [T, (tab: T) => void] {
  const {
    storageKey,
    urlTab,
    parse,
    fallbackTab,
    disabled = false,
    allowedTabs,
  } = options;

  const isAllowed = useCallback(
    (tab: T) => !allowedTabs || allowedTabs.includes(tab),
    [allowedTabs],
  );

  const [tab, setTabState] = useState<T>(() => {
    if (urlTab) {
      const parsed = parse(urlTab);
      return isAllowed(parsed) ? parsed : parse(null);
    }
    if (fallbackTab !== undefined && isAllowed(fallbackTab)) return fallbackTab;
    return parse(null);
  });

  useEffect(() => {
    if (disabled) return;

    if (urlTab) {
      const parsed = parse(urlTab);
      if (isAllowed(parsed)) writeStoredListTab(storageKey, parsed);
      return;
    }

    if (fallbackTab !== undefined) {
      if (isAllowed(fallbackTab)) writeStoredListTab(storageKey, fallbackTab);
      return;
    }

    const stored = readStoredListTab(storageKey);
    if (!stored) return;
    // Reject values the parser does not recognize (falls back to default).
    if (parse(stored) !== stored) return;
    const parsed = stored as T;
    if (!isAllowed(parsed)) return;
    setTabState((prev) => (prev === parsed ? prev : parsed));
    // Restore once on mount (URL/`fallbackTab` captured from first render).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only hydrate
  }, [storageKey, disabled]);

  const setTab = useCallback(
    (next: T) => {
      setTabState(next);
      if (!disabled && isAllowed(next)) writeStoredListTab(storageKey, next);
    },
    [storageKey, disabled, isAllowed],
  );

  return [tab, setTab];
}
