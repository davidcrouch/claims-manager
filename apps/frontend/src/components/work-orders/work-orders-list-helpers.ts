import type { MineArchiveListTab } from '@/components/shared/list-mine-tab';
import { parseMineArchiveListTab, resolveMineArchiveListStatusParam } from '@/components/shared/list-mine-tab';

export const WORK_ORDERS_PAGE_SIZE = 20;
export const DEFAULT_WORK_ORDERS_SORT = 'updated_at_desc';

export type WorkOrdersListTab = MineArchiveListTab;

export function parseWorkOrdersListTab(param: string | null | undefined): WorkOrdersListTab {
  return parseMineArchiveListTab(param);
}

export function isWorkOrdersMineTab(tab: WorkOrdersListTab): tab is 'mine' {
  return tab === 'mine';
}

export function resolveWorkOrdersListStatusParam(params: {
  tab: WorkOrdersListTab;
  statusOptions: { id: string; name: string }[];
  explicitStatus?: string;
  archiveState?: string;
}): string | undefined {
  return resolveMineArchiveListStatusParam(params);
}
