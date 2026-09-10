import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import {
  PERMISSION_DENIED_CODE,
  PERMISSION_DENIED_MESSAGE,
} from '../permission-denied';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    if (!user?.roles) {
      this.logger.warn('RolesGuard.canActivate - user has no roles assigned');
      throw new ForbiddenException({
        message: PERMISSION_DENIED_MESSAGE,
        code: PERMISSION_DENIED_CODE,
      });
    }

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRole) {
      this.logger.warn(
        `RolesGuard.canActivate - missing roles ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException({
        message: PERMISSION_DENIED_MESSAGE,
        code: PERMISSION_DENIED_CODE,
      });
    }
    return true;
  }
}
