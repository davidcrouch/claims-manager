/**
 * Server-safe archive tab helpers for entity list pages.
 * Keep free of 'use client' — import from here in app/ Server Components.
 */

export const ARCHIVED_STATUS_NAMES = new Set(['archived', 'closed']);

export function isArchivedStatus(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    ARCHIVED_STATUS_NAMES.has(normalized) || normalized.startsWith('closed ')
  );
}

export type ArchiveListTab = 'active' | 'archived' | 'all';

const VALID_ARCHIVE_TABS = new Set<ArchiveListTab>(['active', 'archived', 'all']);

/** Parse `?tab=` for Active / Archived / All list pages. */
export function parseArchiveListTab(
  param: string | null | undefined,
): ArchiveListTab {
  if (param && VALID_ARCHIVE_TABS.has(param as ArchiveListTab)) {
    return param as ArchiveListTab;
  }
  return 'active';
}

/**
 * Status lookup IDs implied by Active / Archived / All tabs.
 * - all → undefined (no tab constraint)
 * - options not loaded yet (empty array) → undefined (defer filter; avoid empty Active)
 * - active/archived with no matching lookups → null (empty result set)
 */
export function statusIdsForArchiveListTab(
  tab: ArchiveListTab,
  statusOptions: { id: string; name: string }[],
): string | undefined | null {
  if (tab === 'all') return undefined;
  if (statusOptions.length === 0) return undefined;
  const ids = statusOptions
    .filter((s) => {
      const archived = isArchivedStatus(s.name);
      return tab === 'archived' ? archived : !archived;
    })
    .map((s) => s.id);
  return ids.length > 0 ? ids.sort().join(',') : null;
}

/**
 * String status values implied by Active / Archived / All tabs
 * (journals, assessments, etc.).
 * Empty `allStatuses` defers the tab filter (same as statusIdsForArchiveListTab).
 */
export function statusValuesForArchiveListTab(
  tab: ArchiveListTab,
  allStatuses: string[],
): string | undefined | null {
  if (tab === 'all') return undefined;
  if (allStatuses.length === 0) return undefined;
  const values = allStatuses.filter((s) => {
    const archived = isArchivedStatus(s);
    return tab === 'archived' ? archived : !archived;
  });
  return values.length > 0 ? [...values].sort().join(',') : null;
}

/**
 * Combine column status filter with tab-derived status IDs/values.
 * Column empty-selection (null) wins; otherwise intersect when both set.
 */
export function mergeStatusParamWithTab(
  columnStatus: string | undefined | null,
  tabStatus: string | undefined | null,
): string | undefined | null {
  if (columnStatus === null) return null;
  if (tabStatus === null) return null;
  if (!tabStatus) return columnStatus;
  if (!columnStatus) return tabStatus;
  const tabSet = new Set(
    tabStatus
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const intersect = columnStatus
    .split(',')
    .map((s) => s.trim())
    .filter((id) => id && tabSet.has(id));
  return intersect.length > 0 ? intersect.join(',') : null;
}

/** Initial SSR status param: explicit query wins, else derive from tab + lookups. */
export function resolveArchiveListStatusParam(
  tab: ArchiveListTab,
  explicitStatus: string | undefined,
  statusOptions: { id: string; name: string }[],
): string | undefined {
  if (explicitStatus) return explicitStatus;
  const tabStatus = statusIdsForArchiveListTab(tab, statusOptions);
  return tabStatus ?? undefined;
}
