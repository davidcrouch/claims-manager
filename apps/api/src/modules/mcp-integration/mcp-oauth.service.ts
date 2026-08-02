import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import {
  McpIntegrationRepository,
  type McpConnectionRow,
  type McpIntegrationRow,
} from '../../database/repositories/mcp-integration.repository';
import { encryptJsonForTransit } from './credential-transit';
import type { InitiateOAuthDto, McpAuthConfig } from './mcp-integration.types';
import { MCP_LIMITS } from './mcp-integration.types';
import { McpIntegrationService } from './mcp-integration.service';
import { McpToolManifestService } from './mcp-tool-manifest.service';

const logger = new Logger('McpOAuthService');

function generateRandomString(length: number): string {
  return randomBytes(length).toString('base64url').slice(0, length);
}

function generatePkceVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generatePkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function resolveOAuthResource(
  integrationUrl: string,
  authorizationEndpointUrl: string,
): string | undefined {
  try {
    const authHost = new URL(authorizationEndpointUrl).hostname.toLowerCase();
    if (
      authHost === 'login.microsoftonline.com' ||
      authHost.endsWith('.microsoftonline.com') ||
      authHost === 'login.microsoft.com'
    ) {
      return undefined;
    }
  } catch {
    /* fall through */
  }
  return integrationUrl;
}

@Injectable()
export class McpOAuthService {
  constructor(
    private readonly repo: McpIntegrationRepository,
    private readonly integrationService: McpIntegrationService,
    private readonly manifestService: McpToolManifestService,
    private readonly configService: ConfigService,
  ) {}

  async initiateOAuth(
    tenantId: string,
    userId: string,
    dto: InitiateOAuthDto,
  ): Promise<{ authorizeUrl: string; stateId: string }> {
    const integration = await this.repo.findIntegrationById(dto.integrationId);
    if (!integration) {
      throw new NotFoundException(
        '[McpOAuthService.initiateOAuth] integration not found',
      );
    }

    const authConfig = (integration.authConfig as McpAuthConfig)?.oauth;
    if (!authConfig) {
      throw new BadRequestException(
        '[McpOAuthService.initiateOAuth] integration has no OAuth config',
      );
    }

    const redirectUri = this.resolveCallbackUrl(dto.redirectUri);
    let clientId = authConfig.clientId?.trim();

    if (!clientId) {
      if (!authConfig.registrationEndpointUrl?.trim()) {
        throw new BadRequestException(
          '[McpOAuthService.initiateOAuth] configure an OAuth client ID before connecting',
        );
      }

      const registered = await this.dynamicClientRegister(
        integration,
        authConfig,
        redirectUri,
      );
      clientId = registered.clientId;

      const updatedAuthConfig = {
        ...(integration.authConfig as McpAuthConfig),
        oauth: { ...authConfig, clientId },
      };

      await this.repo.updateIntegration(integration.id, {
        authConfig: updatedAuthConfig,
      });

      if (registered.clientSecret) {
        await this.repo.updateIntegration(integration.id, {
          authConfig: {
            ...updatedAuthConfig,
            clientSecretEnc: encryptJsonForTransit({
              clientSecret: registered.clientSecret,
            }),
            clientSecretLast4: `••••${registered.clientSecret.slice(-4)}`,
          },
        });
      }
    }

    const state = generateRandomString(32);
    const nonce = generateRandomString(16);
    const pkceVerifier = authConfig.usePkce
      ? generatePkceVerifier()
      : generatePkceVerifier();
    const expiresAt = new Date(Date.now() + MCP_LIMITS.OAUTH_STATE_TTL_MS);

    const oauthState = await this.repo.createOauthState({
      integrationId: dto.integrationId,
      tenantId,
      userId,
      state,
      nonce,
      pkceVerifier,
      redirectUri,
      expiresAt,
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId!,
      redirect_uri: redirectUri,
      scope: authConfig.scopes,
      state,
      nonce,
    });

    const resource = resolveOAuthResource(
      integration.url,
      authConfig.authorizationEndpointUrl,
    );
    if (resource) {
      params.set('resource', resource);
    }

    if (authConfig.usePkce) {
      params.set('code_challenge', generatePkceChallenge(pkceVerifier));
      params.set('code_challenge_method', 'S256');
    }

    const authorizeUrl = `${authConfig.authorizationEndpointUrl}?${params.toString()}`;

    logger.log(
      `[McpOAuthService.initiateOAuth] OAuth flow initiated integrationId=${dto.integrationId} stateId=${oauthState.id}`,
    );

    return { authorizeUrl, stateId: oauthState.id };
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ connectionId: string; integrationName: string }> {
    const oauthState = await this.repo.findValidOauthStateByState(state);
    if (!oauthState) {
      throw new BadRequestException(
        '[McpOAuthService.handleCallback] invalid or expired OAuth state',
      );
    }

    const integration = await this.repo.findIntegrationById(
      oauthState.integrationId,
    );
    if (!integration) {
      throw new BadRequestException(
        '[McpOAuthService.handleCallback] integration not found',
      );
    }

    const authConfig = (integration.authConfig as McpAuthConfig)?.oauth;
    if (!authConfig) {
      throw new BadRequestException(
        '[McpOAuthService.handleCallback] integration has no OAuth config',
      );
    }

    const clientSecret = this.integrationService.loadClientSecret(integration);

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauthState.redirectUri,
    });

    const resource = resolveOAuthResource(
      integration.url,
      authConfig.authorizationEndpointUrl,
    );
    if (resource) {
      tokenParams.set('resource', resource);
    }

    if (authConfig.clientId) {
      tokenParams.set('client_id', authConfig.clientId);
    }
    if (clientSecret) {
      tokenParams.set('client_secret', clientSecret);
    }
    if (oauthState.pkceVerifier) {
      tokenParams.set('code_verifier', oauthState.pkceVerifier);
    }

    const tokenResponse = await fetch(authConfig.tokenEndpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new BadRequestException(
        `[McpOAuthService.handleCallback] token exchange failed (${tokenResponse.status}): ${errorBody}`,
      );
    }

    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    if (!tokens.access_token) {
      throw new BadRequestException(
        '[McpOAuthService.handleCallback] token response missing access_token',
      );
    }

    const expiresInSec =
      typeof tokens.expires_in === 'number' && tokens.expires_in > 0
        ? tokens.expires_in
        : 3600;

    const connection = await this.ensureOAuthConnection(
      oauthState.tenantId,
      oauthState.userId,
      integration,
    );

    const credentialRef = encryptJsonForTransit({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
      tokenType: tokens.token_type ?? 'Bearer',
      scope: tokens.scope,
    });

    await this.repo.updateConnection(connection.id, {
      authType: 'oauth',
      visibility: 'private',
      credentialRef,
      status: 'connected',
    });

    await this.repo.deleteOauthState(oauthState.id);

    try {
      await this.manifestService.discoverAndCache(
        { ...connection, credentialRef, authType: 'oauth', status: 'connected' },
        integration,
        { token: tokens.access_token },
      );
    } catch (err) {
      logger.warn(
        `[McpOAuthService.handleCallback] tool discovery after OAuth failed: ${String(err)}`,
      );
    }

    logger.log(
      `[McpOAuthService.handleCallback] OAuth completed connectionId=${connection.id}`,
    );

    return { connectionId: connection.id, integrationName: integration.name };
  }

  async cleanupExpiredStates(): Promise<number> {
    return this.repo.deleteExpiredOauthStates();
  }

  private resolveCallbackUrl(fallbackRedirectUri: string): string {
    const apiPrefix =
      this.configService.get<string>('app.apiPrefix') ?? 'api/v1';
    const port = this.configService.get<number>('app.port') ?? 4501;
    const configured =
      process.env.MCP_OAUTH_CALLBACK_URL ??
      process.env.API_BASE_URL ??
      `http://localhost:${port}/${apiPrefix}/oauth/mcp/callback`;
    return configured.replace(/\/+$/, '') || fallbackRedirectUri;
  }

  private async ensureOAuthConnection(
    tenantId: string,
    userId: string,
    integration: McpIntegrationRow,
  ): Promise<McpConnectionRow> {
    const existingLive = await this.repo.findLiveConnection({
      tenantId,
      integrationId: integration.id,
      userId,
    });

    if (existingLive) {
      return existingLive;
    }

    const softDeleted = await this.repo.findSoftDeletedConnection({
      tenantId,
      integrationId: integration.id,
      userId,
    });

    if (softDeleted) {
      return this.repo.reactivateConnection(softDeleted.id, {
        authType: 'oauth',
        visibility: 'private',
        status: 'pending',
        credentialRef: null,
      });
    }

    return this.repo.createConnection({
      integrationId: integration.id,
      tenantId,
      userId,
      authType: 'oauth',
      visibility: 'private',
      status: 'pending',
    });
  }

  private async dynamicClientRegister(
    integration: McpIntegrationRow,
    authConfig: NonNullable<McpAuthConfig['oauth']>,
    redirectUri: string,
  ): Promise<{ clientId: string; clientSecret?: string }> {
    const registrationUrl = authConfig.registrationEndpointUrl?.trim();
    if (!registrationUrl) {
      throw new BadRequestException(
        '[McpOAuthService.dynamicClientRegister] registration endpoint not advertised',
      );
    }

    const body = {
      client_name: `Claims Manager (${integration.id})`,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };

    const response = await fetch(registrationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseBody = await response.text();
    if (!response.ok) {
      throw new BadRequestException(
        `[McpOAuthService.dynamicClientRegister] registration failed (${response.status}): ${responseBody || '(empty)'}`,
      );
    }

    const result = JSON.parse(responseBody) as {
      client_id: string;
      client_secret?: string;
    };

    if (!result.client_id) {
      throw new BadRequestException(
        '[McpOAuthService.dynamicClientRegister] no client_id in response',
      );
    }

    return { clientId: result.client_id, clientSecret: result.client_secret };
  }
}
