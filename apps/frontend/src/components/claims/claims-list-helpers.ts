import {
  archiveStateLabel,
  isMineListTab,
  parseMineArchiveListTab,
  resolveMineArchiveListStatusParam,
  type MineArchiveListTab,
} from '@/components/shared/list-mine-tab';

export type ClaimsListTab = MineArchiveListTab;

export function parseClaimsListTab(param: string | null | undefined): ClaimsListTab {
  return parseMineArchiveListTab(param, 'active');
}

export function isClaimsMineTab(tab: ClaimsListTab): boolean {
  return isMineListTab(tab);
}

export function resolveClaimsListStatusParam(params: {
  tab: ClaimsListTab;
  statusOptions: { id: string; name: string }[];
  explicitStatus?: string;
  archiveState?: string;
}): string | undefined {
  return resolveMineArchiveListStatusParam(params);
}

export { archiveStateLabel };

export const DEFAULT_CLAIMS_SORT = 'updated_at_desc';

const ALLOWED_SORT = new Set([
  'updated_at_desc',
  'updated_at_asc',
  'created_at_desc',
  'created_at_asc',
  'claim_number_asc',
  'claim_number_desc',
]);

export function normalizeSortParam(param: string | null): string {
  return param && ALLOWED_SORT.has(param) ? param : DEFAULT_CLAIMS_SORT;
}

export const ARCHIVED_STATUS_NAMES = new Set([
  'archived',
  'closed',
]);

export function buildClaimsListFetchKey(params: {
  search?: string;
  sort?: string;
  tab?: string;
  page?: string | number;
  status?: string | null;
  account?: string | null;
  jobType?: string | null;
  assignedToUserId?: string | null;
  archiveState?: string | null;
}): string {
  const sort = normalizeSortParam(params.sort ?? null);
  const tab = params.tab ?? 'active';
  const statusKey = params.status === null ? '__none__' : (params.status ?? '');
  const accountKey = params.account === null ? '__none__' : (params.account ?? '');
  const jobTypeKey = params.jobType === null ? '__none__' : (params.jobType ?? '');
  const assigneeKey =
    params.assignedToUserId === null ? '__none__' : (params.assignedToUserId ?? '');
  const archiveStateKey =
    params.archiveState === null ? '__none__' : (params.archiveState ?? '');
  const page = String(params.page ?? 1);
  return `${params.search ?? ''}|${sort}|${tab}|${statusKey}|${accountKey}|${jobTypeKey}|${assigneeKey}|${archiveStateKey}|${page}`;
}

export function buildClaimsListFetchKeyFromPageParams(params: {
  search?: string;
  sort?: string;
  status?: string;
  account?: string;
  jobType?: string;
  tab?: string;
  page?: string;
  assignedToUserId?: string;
  archiveState?: string;
}): string {
  return buildClaimsListFetchKey({
    search: params.search,
    sort: params.sort,
    tab: parseClaimsListTab(params.tab ?? null),
    page: params.page ?? '1',
    status: params.status,
    account: params.account,
    jobType: params.jobType,
    assignedToUserId: params.assignedToUserId,
    archiveState: params.archiveState,
  });
}

export function columnFilterFromIdsParam(
  param: string | null,
  options: { id: string; name: string }[],
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
  return { selected, active: true };
}
