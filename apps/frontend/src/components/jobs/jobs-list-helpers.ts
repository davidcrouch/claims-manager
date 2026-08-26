import { COLUMN_FILTER_BLANK } from '@/components/shared/list-filters';
import type { ArchiveListTab } from '@/components/shared/archive-list';

const ARCHIVED_STATUS_NAMES = new Set(['archived', 'closed']);

export const JOBS_PAGE_SIZE = 20;
export const DEFAULT_JOBS_SORT = 'updated_at_desc';

export type JobsListTab = ArchiveListTab;

export type JobSortField =
  | 'external_reference'
  | 'external_job_id'
  | 'status'
  | 'job_type'
  | 'assignee'
  | 'address'
  | 'request_date'
  | 'updated_at';

const JOB_SORT_FIELDS = new Set<JobSortField>([
  'external_reference',
  'external_job_id',
  'status',
  'job_type',
  'assignee',
  'address',
  'request_date',
  'updated_at',
]);

const VALID_TABS = new Set<JobsListTab>(['active', 'archived', 'all']);

export function parseJobsListTab(param: string | null): JobsListTab {
  if (param && VALID_TABS.has(param as JobsListTab)) return param as JobsListTab;
  return 'active';
}

export function parseJobsColumnSort(
  sortParam: string | null,
): { field: JobSortField; order: 'asc' | 'desc' } {
  if (!sortParam) return { field: 'updated_at', order: 'desc' };
  const idx = sortParam.lastIndexOf('_');
  if (idx <= 0) return { field: 'updated_at', order: 'desc' };
  const order = sortParam.slice(idx + 1);
  const field = sortParam.slice(0, idx);
  if (order !== 'asc' && order !== 'desc') {
    return { field: 'updated_at', order: 'desc' };
  }
  if (!JOB_SORT_FIELDS.has(field as JobSortField)) {
    return { field: 'updated_at', order: 'desc' };
  }
  return { field: field as JobSortField, order };
}

export function statusIdsForJobsListTab(
  tab: JobsListTab,
  statusOptions: { id: string; name: string }[],
): string | undefined {
  if (tab === 'all') return undefined;
  if (statusOptions.length === 0) return undefined;
  const ids = statusOptions
    .filter((status) => {
      const archived = ARCHIVED_STATUS_NAMES.has(status.name.trim().toLowerCase());
      return tab === 'archived' ? archived : !archived;
    })
    .map((status) => status.id);
  return ids.length > 0 ? ids.sort().join(',') : undefined;
}

export function buildJobsListFetchKey(params: {
  search?: string;
  sort?: string;
  tab?: string;
  page?: string | number;
  status?: string | null;
  jobType?: string | null;
  refs?: string | null;
  assignedToUserIds?: string | null;
  refreshNonce?: number;
}): string {
  const statusKey = params.status === null ? '__none__' : (params.status ?? '');
  const typeKey = params.jobType === null ? '__none__' : (params.jobType ?? '');
  const refsKey = params.refs === null ? '__none__' : (params.refs ?? '');
  const assigneesKey =
    params.assignedToUserIds === null ? '__none__' : (params.assignedToUserIds ?? '');
  const page = String(params.page ?? 1);
  const sort = params.sort ?? DEFAULT_JOBS_SORT;
  const tab = params.tab ?? 'active';
  const refreshNonce = params.refreshNonce ?? 0;
  return `${params.search ?? ''}|${sort}|${tab}|${page}|${statusKey}|${typeKey}|${refsKey}|${assigneesKey}|${refreshNonce}`;
}

export function buildJobsListFetchKeyFromPageParams(params: {
  search?: string;
  sort?: string;
  tab?: string;
  page?: string;
  status?: string;
  jobType?: string;
  refs?: string;
  assignedToUserIds?: string;
}): string {
  return buildJobsListFetchKey({
    search: params.search,
    sort: params.sort && JOB_SORT_FIELDS.has(parseJobsColumnSort(params.sort).field)
      ? params.sort
      : DEFAULT_JOBS_SORT,
    tab: parseJobsListTab(params.tab ?? null),
    page: params.page ?? '1',
    status: params.status,
    jobType: params.jobType,
    refs: params.refs,
    assignedToUserIds: params.assignedToUserIds,
  });
}

export function columnFilterFromValuesParam(
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

export function columnFilterFromIdsParam(
  param: string | null,
  options: { id: string; name: string }[],
  opts?: { blankId?: string },
): { selected: Set<string>; active: boolean } {
  if (!param) return { selected: new Set(), active: false };
  const ids = new Set(
    param
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (ids.size === 0) return { selected: new Set(), active: true };
  const selected = new Set<string>();
  for (const option of options) {
    if (ids.has(option.id)) selected.add(option.name);
  }
  if (opts?.blankId && ids.has(opts.blankId)) {
    selected.add(COLUMN_FILTER_BLANK);
  }
  return { selected, active: true };
}
