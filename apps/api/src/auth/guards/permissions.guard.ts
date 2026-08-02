import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const userPermissions = user?.permissions;

    // Soft-fail for legacy tokens without a permissions claim.
    if (!userPermissions?.length) return true;

    const hasPermission =
      userPermissions.includes('*') ||
      requiredPermissions.some((permission) =>
        userPermissions.includes(permission),
      );

    if (!hasPermission) {
      throw new ForbiddenException(
        `[PermissionsGuard.canActivate] Required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
