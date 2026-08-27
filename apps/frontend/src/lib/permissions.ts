/**
 * Wildcard-aware permission match for UI gating.
 * Mirrors apps/api/src/auth/permission-match.ts.
 */

export const CATALOG_UPDATE_FROM_ESTIMATE = 'catalogs.update-from-estimate';

/** Existing Organisation Admin-only permission, used until the dedicated permission is seeded. */
export const ORG_ADMIN_SETTINGS = 'org.settings.manage';

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

export function hasAnyPermission(
  held: string[] | undefined | null,
  required: string[],
): boolean {
  return required.some((permission) => hasPermission(held, permission));
}

/** Organisation Admin (or the dedicated catalogue-from-estimate permission). */
export function canUpdateCatalogFromEstimate(held: string[] | undefined | null): boolean {
  return hasAnyPermission(held, [CATALOG_UPDATE_FROM_ESTIMATE, ORG_ADMIN_SETTINGS]);
}
