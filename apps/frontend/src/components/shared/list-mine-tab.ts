/**
 * Shared "My [entity]" tab + Active/Archived State column helpers for assignable list pages.
 * Server-safe — no 'use client' imports.
 */

import {
  isArchivedStatus,
  mergeStatusParamWithTab,
  statusIdsForArchiveListTab,
  type ArchiveListTab,
} from '@/components/shared/archive-list';

export type MineArchiveListTab = ArchiveListTab | 'mine';

export const ARCHIVE_STATE_OPTIONS = ['Active', 'Archived'] as const;
export type ArchiveStateOption = (typeof ARCHIVE_STATE_OPTIONS)[number];

function columnFilterFromValuesParam(
  param: string | null,
): { selected: Set<string>; active: boolean } {
  if (!param) return { selected: new Set(), active: false };
  const selected = new Set(
    param
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (selected.size === 0) return { selected: new Set(), active: true };
  return { selected, active: true };
}

export function isMineListTab(tab: string): tab is 'mine' {
  return tab === 'mine';
}

export function parseMineArchiveListTab(
  param: string | null | undefined,
  defaultTab: ArchiveListTab = 'active',
): MineArchiveListTab {
  if (param === 'mine') return 'mine';
  if (param === 'active' || param === 'archived' || param === 'all') return param;
  return defaultTab;
}

export function archiveStateLabel(
  statusName: string | null | undefined,
): ArchiveStateOption {
  return isArchivedStatus(statusName) ? 'Archived' : 'Active';
}

/** Task statuses treated as closed/archived for the State column. */
const TASK_CLOSED_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export function taskArchiveStateLabel(
  statusName: string | null | undefined,
): ArchiveStateOption {
  const normalized = statusName?.trim().toLowerCase() ?? '';
  if (!normalized) return 'Active';
  return TASK_CLOSED_STATUSES.has(normalized) ? 'Archived' : 'Active';
}

const TASK_ACTIVE_STATUS_VALUES = 'Open,In Progress,On Hold';
const TASK_ARCHIVED_STATUS_VALUES = 'Completed,Failed,Cancelled';

export function statusValuesForTaskArchiveStateFilter(
  selected: Set<string>,
): string | undefined | null {
  if (selected.size === 0) return null;
  if (selected.has('Active') && selected.has('Archived')) return undefined;
  if (selected.has('Archived')) return TASK_ARCHIVED_STATUS_VALUES;
  return TASK_ACTIVE_STATUS_VALUES;
}

export function columnFilterToTaskArchiveStateStatus(
  active: boolean,
  selected: Set<string>,
): string | undefined | null {
  if (!active) return undefined;
  return statusValuesForTaskArchiveStateFilter(selected);
}

export function statusIdsForArchiveStateFilter(
  selected: Set<string>,
  statusOptions: { id: string; name: string }[],
): string | undefined | null {
  if (selected.size === 0) return null;
  if (selected.has('Active') && selected.has('Archived')) return undefined;
  if (statusOptions.length === 0) return undefined;
  const wantArchived = selected.has('Archived');
  const ids = statusOptions
    .filter((status) =>
      wantArchived ? isArchivedStatus(status.name) : !isArchivedStatus(status.name),
    )
    .map((status) => status.id);
  return ids.length > 0 ? ids.sort().join(',') : null;
}

export function columnFilterToArchiveStateStatusIds(
  active: boolean,
  selected: Set<string>,
  statusOptions: { id: string; name: string }[],
): string | undefined | null {
  if (!active) return undefined;
  return statusIdsForArchiveStateFilter(selected, statusOptions);
}

export function resolveMineArchiveListStatusParam(params: {
  tab: MineArchiveListTab;
  statusOptions: { id: string; name: string }[];
  explicitStatus?: string;
  archiveState?: string;
}): string | undefined {
  const tabStatusIds = isMineListTab(params.tab)
    ? undefined
    : statusIdsForArchiveListTab(params.tab, params.statusOptions);

  const archiveHydrated = columnFilterFromValuesParam(params.archiveState ?? null);
  const archiveStateStatus = isMineListTab(params.tab)
    ? columnFilterToArchiveStateStatusIds(
        archiveHydrated.active,
        archiveHydrated.selected,
        params.statusOptions,
      )
    : undefined;

  const merged = mergeStatusParamWithTab(
    mergeStatusParamWithTab(params.explicitStatus, archiveStateStatus),
    tabStatusIds ?? undefined,
  );
  return merged ?? undefined;
}
