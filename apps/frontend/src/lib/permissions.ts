/**
 * Wildcard-aware permission match for UI gating.
 * Mirrors apps/api/src/auth/permission-match.ts.
 */
export function hasPermission(
  held: string[] | undefined | null,
  required: string,
): boolean {
  if (!held || held.length === 0) return false;
  for (const perm of held) {
    if (perm === '*') return true;
    if (perm === required) return true;
    if (perm.endsWith('.*')) {
      const prefix = perm.slice(0, -1);
      if (required.startsWith(prefix)) return true;
    }
  }
  return false;
}
