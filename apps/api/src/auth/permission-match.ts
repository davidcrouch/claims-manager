/**
 * Wildcard-aware permission matching shared by guards and request helpers.
 *
 *   - '*'           matches everything
 *   - 'org.*'       matches 'org.manage', 'org.users.invite', etc.
 *   - 'claims.read' matches exactly 'claims.read'
 */
export function matchPermission(
  heldPermissions: string[] | undefined | null,
  required: string,
): boolean {
  if (!heldPermissions || heldPermissions.length === 0) return false;
  for (const held of heldPermissions) {
    if (held === '*') return true;
    if (held === required) return true;
    if (held.endsWith('.*')) {
      const prefix = held.slice(0, -1);
      if (required.startsWith(prefix)) return true;
    }
  }
  return false;
}

/**
 * Whether the caller has platform-wide administrative capability.
 * Derived from JWT permissions only — never from soft-configured role names.
 */
export function hasPlatformAdminCapability(
  permissions: string[] | undefined | null,
): boolean {
  return (
    matchPermission(permissions, '*') ||
    matchPermission(permissions, 'platform.permissions.manage') ||
    matchPermission(permissions, 'platform.users.manage') ||
    matchPermission(permissions, 'platform.roles.create')
  );
}
