import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { matchPermission } from './permission-match';

/**
 * Assert the caller holds a specific permission. Throws ForbiddenException if not.
 */
export function assertPermission(
  userOrPermissions: AuthenticatedUser | string[] | undefined | null,
  permission: string,
  message?: string,
): void {
  const permissions = Array.isArray(userOrPermissions)
    ? userOrPermissions
    : userOrPermissions?.permissions;

  if (!matchPermission(permissions, permission)) {
    throw new ForbiddenException(
      message ??
        `[assertPermission] requires permission '${permission}'`,
    );
  }
}

/** True when the caller holds the permission (no throw). */
export function hasPermission(
  userOrPermissions: AuthenticatedUser | string[] | undefined | null,
  permission: string,
): boolean {
  const permissions = Array.isArray(userOrPermissions)
    ? userOrPermissions
    : userOrPermissions?.permissions;
  return matchPermission(permissions, permission);
}
