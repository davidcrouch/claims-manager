/** Escape a string for use inside a RegExp / Postgres regex pattern. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Append the next variation suffix to a base estimate number.
 * EST-200206 + existing [EST-200206-1] → EST-200206-2
 * EST-200206-1 + [] → EST-200206-1-1
 */
export function nextVariationInternalNumber(
  baseNumber: string,
  existingNumbers: string[],
): string {
  const re = new RegExp(`^${escapeRegExp(baseNumber)}-(\\d+)$`);
  let max = 0;
  for (const n of existingNumbers) {
    const match = n.match(re);
    if (match) {
      const suffix = Number.parseInt(match[1], 10);
      if (Number.isFinite(suffix) && suffix > max) max = suffix;
    }
  }
  return `${baseNumber}-${max + 1}`;
}
