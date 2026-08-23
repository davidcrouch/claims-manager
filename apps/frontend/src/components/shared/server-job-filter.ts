import {
  COLUMN_FILTER_BLANK,
  columnFilterKey,
  commitColumnFilterSelection,
  buildColumnFilterOptions,
} from '@/components/shared/list-filters';

export type JobFilterOption = { id: string; label: string };

const JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ensure checkbox labels are unique. Duplicate display names (common when
 * external refs are reused across jobs) otherwise collapse to one option and
 * map Apply → multiple ids / empty selection.
 */
export function withUniqueJobFilterLabels(
  jobs: JobFilterOption[],
): JobFilterOption[] {
  const bases = jobs.map((j) => ({
    id: j.id,
    base: (j.label ?? '').trim() || j.id,
  }));
  const counts = new Map<string, number>();
  for (const row of bases) {
    counts.set(row.base, (counts.get(row.base) ?? 0) + 1);
  }
  return bases.map(({ id, base }) => ({
    id,
    label: (counts.get(base) ?? 0) > 1 ? `${base} (${id.slice(0, 8)})` : base,
  }));
}

/** Include the current job even when it is outside the loaded jobs page. */
export function ensureJobInFilterOptions(
  jobs: JobFilterOption[],
  current?: { id: string; label?: string | null } | null,
): JobFilterOption[] {
  if (!current?.id) return jobs;
  if (jobs.some((j) => j.id === current.id)) return jobs;
  const label = (current.label ?? '').trim() || current.id;
  return [{ id: current.id, label }, ...jobs];
}

/**
 * Build Job column filter options from server-provided jobs (not page rows).
 */
export function buildServerJobFilterOptions(
  jobs: JobFilterOption[],
  opts?: { includeBlank?: boolean },
): string[] {
  const normalized = withUniqueJobFilterLabels(jobs);
  return buildColumnFilterOptions(
    normalized.map((j) => j.label),
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
  const jobs = withUniqueJobFilterLabels(params.jobs);
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
  const idsFromJobs = jobs
    .filter(
      (j) =>
        selectedLabels.has(j.id) ||
        selectedLabels.has(j.label.trim()) ||
        selectedLabels.has(columnFilterKey(j.label)),
    )
    .map((j) => j.id);
  // Preserve raw job ids when the option list did not include that job yet
  // (selected showed a UUID and no checkbox matched).
  const idsFromRaw = [...selectedLabels].filter((value) => JOB_ID_RE.test(value));
  const ids = [...new Set([...idsFromJobs, ...idsFromRaw])];

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

  const rawIds = [
    ...(params.jobIds ?? []),
    ...(params.jobId ? [params.jobId] : []),
  ].filter(Boolean);

  // Active "match nothing" — keep the filter marked on with an empty selection.
  if (rawIds.length > 0 && rawIds.every((id) => id === '__none__')) {
    return { selected: new Set(), active: true };
  }

  const ids = rawIds.filter((id) => id !== '__none__');
  if (ids.length === 0) {
    return { selected: new Set(), active: false };
  }

  const jobs = withUniqueJobFilterLabels(params.jobs);
  const labelById = new Map(jobs.map((j) => [j.id, j.label.trim()]));
  return {
    active: true,
    selected: new Set(
      ids.map((id) => columnFilterKey(labelById.get(id) || id)),
    ),
  };
}

/**
 * Parse jobId / jobIds query string values into a single id list.
 * Prefer a real jobId when jobIds is only the empty-filter sentinel.
 */
export function parseSelectedJobIds(
  jobId?: string | null,
  jobIdsParam?: string | null,
): string[] {
  const fromIds = jobIdsParam
    ? jobIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  const onlyNone =
    fromIds.length > 0 && fromIds.every((id) => id === '__none__');

  if (onlyNone && jobId) return [jobId];
  if (fromIds.length > 0) return fromIds;
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
  params.delete('unlinkedOnly');
  if (!resolved.active) return;
  if (resolved.unlinkedOnly) {
    params.set('unlinkedOnly', '1');
    return;
  }
  if (resolved.jobId) params.set('jobId', resolved.jobId);
  else if (resolved.jobIds?.length) params.set('jobIds', resolved.jobIds.join(','));
}

/**
 * Keep jobId / jobIds mutually exclusive when syncing list URL state.
 * Prefer jobIds when present (multi-select / empty sentinel).
 */
export function syncServerJobFilterParams(
  params: URLSearchParams,
  jobId?: string | null,
  jobIdsParam?: string | null,
): void {
  params.delete('jobId');
  params.delete('jobIds');
  const fromIds = jobIdsParam
    ? jobIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  const onlyNone =
    fromIds.length > 0 && fromIds.every((id) => id === '__none__');

  if (onlyNone && jobId) {
    params.set('jobId', jobId);
    return;
  }
  if (fromIds.length > 0) {
    params.set('jobIds', fromIds.join(','));
    return;
  }
  if (jobId) params.set('jobId', jobId);
}

/** Build JobFilterOption[] from a jobNameById map (all jobs for the page). */
export function jobFilterOptionsFromNameById(
  jobNameById?: Record<string, string>,
): JobFilterOption[] {
  return Object.entries(jobNameById ?? {}).map(([id, label]) => ({ id, label }));
}

/**
 * Standard list Job-column options: prefer explicit jobs, else name map,
 * always include the current job, and uniquify duplicate labels.
 */
export function buildListJobFilterOptions(params: {
  jobNameById?: Record<string, string>;
  jobs?: JobFilterOption[];
  currentJob?: { id: string; label?: string | null } | null;
  jobId?: string | null;
}): JobFilterOption[] {
  const raw =
    params.jobs && params.jobs.length > 0
      ? params.jobs.map((j) => ({ id: j.id, label: j.label }))
      : jobFilterOptionsFromNameById(params.jobNameById);
  const current =
    params.currentJob ??
    (params.jobId
      ? {
          id: params.jobId,
          label: params.jobNameById?.[params.jobId],
        }
      : null);
  return withUniqueJobFilterLabels(ensureJobInFilterOptions(raw, current));
}
