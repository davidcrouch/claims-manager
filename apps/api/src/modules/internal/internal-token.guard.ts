/**
 * InternalTokenGuard
 *
 * Guards the `/internal/*` surface with a shared-secret header. Used only
 * for service-to-service calls (e.g. auth-server → api-server after
 * signup). Not a substitute for JwtAuthGuard on user-facing routes.
 *
 * Safety model:
 *   - If INTERNAL_API_TOKEN is unset on the api-server, every call is
 *     rejected (defense-in-depth: missing config must not open the door).
 *   - Header `x-internal-token` must match exactly.
 *   - The caller MUST also pair this with @Public() so JwtAuthGuard does
 *     not demand a user bearer token.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LOG = '[InternalTokenGuard.canActivate]';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected =
      this.config.get<string>('INTERNAL_API_TOKEN') ??
      process.env.INTERNAL_API_TOKEN;

    if (!expected || expected.trim() === '') {
      console.warn(
        `${LOG} INTERNAL_API_TOKEN is not configured — rejecting internal request`,
      );
      throw new UnauthorizedException('Internal endpoints disabled');
    }

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const headerRaw = req.headers['x-internal-token'];
    const provided = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

    if (!provided || provided !== expected) {
      console.warn(
        `${LOG} rejecting internal request — token mismatch or missing`,
      );
      throw new UnauthorizedException('Invalid internal token');
    }

    return true;
  }
}
