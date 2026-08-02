import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { McpOAuthService } from './mcp-oauth.service';

@ApiTags('mcp-oauth')
@Controller('oauth/mcp')
export class McpOAuthController {
  private readonly logger = new Logger('McpOAuthController');

  constructor(private readonly oauthService: McpOAuthService) {}

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'OAuth callback — exchange code for tokens' })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Query('error_uri') errorUri: string,
    @Res() res: Response,
  ) {
    if (error) {
      const detail = [error, errorDescription, errorUri]
        .filter(Boolean)
        .join(' — ');
      return res.status(400).send(this.buildCallbackHtml(false, detail));
    }

    if (!code || !state) {
      return res
        .status(400)
        .send(this.buildCallbackHtml(false, 'Missing code or state'));
    }

    try {
      const result = await this.oauthService.handleCallback(code, state);
      return res
        .status(200)
        .send(
          this.buildCallbackHtml(
            true,
            undefined,
            result.connectionId,
            result.integrationName,
          ),
        );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[McpOAuthController.oauthCallback] callback failed: ${message}`,
      );
      return res.status(400).send(this.buildCallbackHtml(false, message));
    }
  }

  private buildCallbackHtml(
    success: boolean,
    error?: string,
    connectionId?: string,
    integrationName?: string,
  ): string {
    const message = success
      ? {
          type: 'mcp-oauth-callback',
          success: true,
          connectionId,
          integrationName,
        }
      : { type: 'mcp-oauth-callback', success: false, error };

    const targetOrigin = process.env.FRONTEND_URL
      ? JSON.stringify(process.env.FRONTEND_URL.replace(/\/+$/, ''))
      : 'window.location.origin';

    return `<!DOCTYPE html>
<html>
<head><title>MCP OAuth</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(${JSON.stringify(message)}, ${targetOrigin});
  }
  window.close();
</script>
<p>${success ? 'Connected successfully. You may close this window.' : `Error: ${error ?? 'unknown'}`}</p>
</body>
</html>`;
  }
}
