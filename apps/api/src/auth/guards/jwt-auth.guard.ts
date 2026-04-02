import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly authConfigured: boolean;

  constructor(private reflector: Reflector) {
    super();
    this.authConfigured = !!(
      process.env.AUTH_JWKS_URI &&
      process.env.AUTH_ISSUER_URL
    );
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (!this.authConfigured) {
      throw new UnauthorizedException(
        '[JwtAuthGuard.canActivate] Auth not configured - set AUTH_JWKS_URI, AUTH_ISSUER_URL',
      );
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: unknown,
  ): TUser {
    if (err) {
      throw err;
    }
    if (!user) {
      throw new UnauthorizedException(
        '[JwtAuthGuard.handleRequest] Invalid or missing token',
      );
    }
    return user as TUser;
  }
}
