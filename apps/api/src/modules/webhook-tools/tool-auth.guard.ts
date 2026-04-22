import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guards the `/api/v1/webhook-tools/*` HTTP endpoints that back the
 * `claims-manager-webhook` More0 app tools. The inline-ts tool modules
 * (under `apps/api/more0/definitions/tools/<name>/<name>.ts`) call these
 * endpoints from the More0 sandbox, authenticating with an `X-Tool-Secret`
 * header whose value is injected into the sandbox via the `{TOOL_SECRET}`
 * placeholder in each `tool.json`.
 */
@Injectable()
export class ToolAuthGuard implements CanActivate {
  private readonly logger = new Logger('ToolAuthGuard');

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('more0.toolSecret', '');
    if (!expected) {
      this.logger.error(
        'ToolAuthGuard.canActivate — MORE0_TOOL_SECRET not configured; rejecting.',
      );
      throw new UnauthorizedException('Tool authentication not configured');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided =
      (req.headers['x-tool-secret'] as string | undefined) ??
      (req.headers['X-Tool-Secret'] as unknown as string | undefined);

    if (!provided || provided !== expected) {
      this.logger.warn(
        `ToolAuthGuard.canActivate — missing/invalid X-Tool-Secret from ${req.ip ?? 'unknown'}`,
      );
      throw new UnauthorizedException('Invalid tool secret');
    }

    return true;
  }
}
