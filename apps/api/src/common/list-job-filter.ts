/**
 * Normalize list query job filters into an id list.
 * - undefined → no job filter
 * - includes `__none__` → empty list (caller should return zero rows)
 * - otherwise unique ids from jobId + jobIds
 */
export function normalizeListJobIds(params: {
  jobId?: string;
  jobIds?: string[];
}): string[] | undefined {
  const raw = [
    ...(params.jobIds ?? []),
    ...(params.jobId ? [params.jobId] : []),
  ]
    .map((id) => id.trim())
    .filter(Boolean);

  if (raw.length === 0) return undefined;
  if (raw.includes('__none__')) return [];
  return [...new Set(raw)];
}

/**
 * Parse a CSV list query param (or repeated query values as string[]).
 * - undefined/empty → no filter
 * - includes `__none__` → empty list (caller should return zero rows)
 * - otherwise unique trimmed values
 */
export function parseCsvFilterValues(
  csv?: string | string[] | null,
): string[] | undefined {
  if (csv == null) return undefined;
  const joined = Array.isArray(csv) ? csv.join(',') : csv;
  if (!joined.trim()) return undefined;
  const raw = joined
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (raw.length === 0) return undefined;
  if (raw.includes('__none__')) return [];
  return [...new Set(raw)];
}

/**
 * Merge single + CSV user-id filters (e.g. assignedToUserId + assignedToUserIds).
 * Same semantics as parseCsvFilterValues / normalizeListJobIds.
 */
export function normalizeListUserIds(params: {
  userId?: string;
  userIds?: string;
}): string[] | undefined {
  const fromCsv = params.userIds
    ? params.userIds.split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  const raw = [
    ...fromCsv,
    ...(params.userId ? [params.userId.trim()] : []),
  ].filter(Boolean);

  if (raw.length === 0) return undefined;
  if (raw.includes('__none__')) return [];
  return [...new Set(raw)];
}
