import { Application, Request, Response } from 'express';
import { Provider } from 'oidc-provider';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:oauth-discovery', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'oauth-discovery', 'OAuthDiscovery', 'auth-server');

export default function createOAuthDiscoveryRoutes(app: Application, provider: Provider): void {
   // OAuth Authorization Server Discovery endpoint
  
   app.get('/.well-known/oauth-authorization-server', async (req: Request, res: Response) => {
      try {
         log.info({ 
            action: 'oauth_discovery',
            clientIP: req.ip,
            userAgent: req.headers['user-agent']
         }, 'OAuth authorization server discovery request');
         
         // Return proper OAuth 2.1 metadata instead of redirecting
         const baseUrl = `${req.protocol}://${req.get('host')}`;
         
         const oauthMetadata = {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
            registration_endpoint: `${baseUrl}/register`,
            response_types_supported: ['code'],
            response_modes_supported: ['query'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            scopes_supported: ['openid', 'profile', 'email', 'address', 'phone', 'offline_access', 'introspection', 'token-exchange', 'mcp:tools'],
            token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
            end_session_endpoint: `${baseUrl}/session/end`
         };
         
         log.debug({
            oauthMetadata,
            baseUrl
         }, 'Returning OAuth 2.1 metadata');

         res.json(oauthMetadata);
      } catch (error) {
         log.error({
            error: error.message,
            stack: error.stack
         }, 'Failed to return OAuth metadata');
         res.status(500).json({ error: 'Failed to return OAuth metadata' });
      }
   });
}
