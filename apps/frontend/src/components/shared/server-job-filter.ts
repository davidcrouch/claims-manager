import {
  COLUMN_FILTER_BLANK,
  columnFilterKey,
  commitColumnFilterSelection,
  buildColumnFilterOptions,
} from '@/components/shared/list-filters';

export type JobFilterOption = { id: string; label: string };

/**
 * Build Job column filter options from server-provided jobs (not page rows).
 */
export function buildServerJobFilterOptions(
  jobs: JobFilterOption[],
  opts?: { includeBlank?: boolean },
): string[] {
  return buildColumnFilterOptions(
    jobs.map((j) => j.label),
    { alwaysIncludeBlank: opts?.includeBlank },
  );
}

/**
 * Map applied Job column checkbox selection → URL/query job filter params.
 * Uses server job option list (id + label), not page-local row values.
 */
export function resolveServerJobFilterSelection(params: {
  next: Set<string>;
  options: string[];
  jobs: JobFilterOption[];
}): {
  active: boolean;
  jobId?: string;
  jobIds?: string[];
  unlinkedOnly?: boolean;
} {
  const committed = commitColumnFilterSelection({
    next: params.next,
    optionCount: params.options.length,
  });

  if (!committed.active) {
    return { active: false };
  }

  if (committed.selected.size === 0) {
    return { active: true, jobIds: ['__none__'] };
  }

  const wantsBlank = committed.selected.has(COLUMN_FILTER_BLANK);
  const selectedLabels = new Set(
    [...committed.selected]
      .filter((label) => label !== COLUMN_FILTER_BLANK)
      .map((label) => label.trim()),
  );
  const ids = params.jobs
    .filter((j) => selectedLabels.has(j.label.trim()) || selectedLabels.has(columnFilterKey(j.label)))
    .map((j) => j.id);

  if (wantsBlank && ids.length === 0) {
    return { active: true, unlinkedOnly: true };
  }
  if (ids.length === 1) {
    return { active: true, jobId: ids[0] };
  }
  if (ids.length > 1) {
    return { active: true, jobIds: ids };
  }
  return { active: true, jobIds: ['__none__'] };
}

/** Selected label set for Job column UI from current URL/query ids. */
export function selectedJobFilterLabels(params: {
  jobId?: string;
  jobIds?: string[];
  unlinkedOnly?: boolean;
  jobs: JobFilterOption[];
}): { selected: Set<string>; active: boolean } {
  if (params.unlinkedOnly) {
    return { selected: new Set([COLUMN_FILTER_BLANK]), active: true };
  }
  const ids = [
    ...(params.jobIds ?? []),
    ...(params.jobId ? [params.jobId] : []),
  ].filter((id) => id && id !== '__none__');

  if (ids.length === 0) {
    return { selected: new Set(), active: false };
  }

  const labelById = new Map(params.jobs.map((j) => [j.id, j.label.trim()]));
  return {
    active: true,
    selected: new Set(
      ids.map((id) => columnFilterKey(labelById.get(id) || id)),
    ),
  };
}

/** Parse jobId / jobIds query string values into a single id list. */
export function parseSelectedJobIds(
  jobId?: string | null,
  jobIdsParam?: string | null,
): string[] {
  if (jobIdsParam) {
    return jobIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
  }
  if (jobId) return [jobId];
  return [];
}

/** Map selected ids → fetch params (single jobId vs jobIds array). */
export function toServerJobFetchParams(selectedJobIds: string[]): {
  jobId?: string;
  jobIds?: string[];
} {
  if (selectedJobIds.length === 1 && selectedJobIds[0] !== '__none__') {
    return { jobId: selectedJobIds[0] };
  }
  if (selectedJobIds.length > 1 || selectedJobIds[0] === '__none__') {
    return { jobIds: selectedJobIds };
  }
  return {};
}

/** Write resolveServerJobFilterSelection result onto URLSearchParams. */
export function writeServerJobFilterParams(
  params: URLSearchParams,
  resolved: ReturnType<typeof resolveServerJobFilterSelection>,
): void {
  params.delete('jobId');
  params.delete('jobIds');
  if (!resolved.active) return;
  if (resolved.jobId) params.set('jobId', resolved.jobId);
  else if (resolved.jobIds?.length) params.set('jobIds', resolved.jobIds.join(','));
}

/** Build JobFilterOption[] from a jobNameById map (all jobs for the page). */
export function jobFilterOptionsFromNameById(
  jobNameById?: Record<string, string>,
): JobFilterOption[] {
  return Object.entries(jobNameById ?? {}).map(([id, label]) => ({ id, label }));
}
