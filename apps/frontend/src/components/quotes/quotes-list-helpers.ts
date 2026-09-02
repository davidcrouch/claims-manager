import type { MineArchiveListTab } from '@/components/shared/list-mine-tab';
import { parseMineArchiveListTab, resolveMineArchiveListStatusParam } from '@/components/shared/list-mine-tab';

export const QUOTES_PAGE_SIZE = 20;
export const DEFAULT_QUOTES_SORT = 'updated_at_desc';

export type QuotesListTab = MineArchiveListTab;

export function parseQuotesListTab(param: string | null | undefined): QuotesListTab {
  return parseMineArchiveListTab(param);
}

export function isQuotesMineTab(tab: QuotesListTab): boolean {
  return tab === 'mine';
}

export function resolveQuotesListStatusParam(params: {
  tab: QuotesListTab;
  statusOptions: { id: string; name: string }[];
  explicitStatus?: string;
  archiveState?: string;
}): string | undefined {
  return resolveMineArchiveListStatusParam(params);
}
