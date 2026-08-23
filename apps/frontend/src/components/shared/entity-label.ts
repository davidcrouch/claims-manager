/** Prefer tenant-internal record number, then external/business refs, then name/id. */
export function entityDisplayLabel(
  internalNumber?: string | null,
  ...fallbacks: Array<string | null | undefined>
): string {
  const internal = internalNumber?.trim();
  if (internal) return internal;
  for (const value of fallbacks) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '—';
}
