import { ForbiddenException, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { matchPermission } from './permission-match';
import {
  PERMISSION_DENIED_CODE,
  PERMISSION_DENIED_MESSAGE,
} from './permission-denied';

const logger = new Logger('assertPermission');

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
    logger.warn(`assertPermission - missing ${permission}`);
    throw new ForbiddenException({
      message: message ?? PERMISSION_DENIED_MESSAGE,
      code: PERMISSION_DENIED_CODE,
    });
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
