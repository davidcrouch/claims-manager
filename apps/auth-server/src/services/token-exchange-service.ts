/**
 * =============================================================================
 * TOKEN EXCHANGE SERVICE
 * =============================================================================
 * 
 * This module provides OAuth 2.0 Token Exchange (RFC 8693) functionality
 * that leverages the existing auth-server infrastructure.
 * 
 * Key Features:
 * - RFC 8693 compliant token exchange
 * - Uses existing Redis storage (storeAuthResult/getStoredAuthResult keyed by userId)
 * - Integrates with existing BackendService
 * - Leverages existing OIDC provider
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { getStoredAuthResult } from '../config/oidc-provider.js';
import { BackendTokenExchangeService } from './token-exchange/backend-token-exchange-service.js';
import { getTokenTtlConfig } from '../config/env-validation.js';
import { 
  TokenExchangeRequest, 
  TokenExchangeResponse, 
  TokenExchangeErrorResponse,
  SubjectTokenValidationResult
} from '../types/token-exchange.js';
import { Provider } from 'oidc-provider';

const baseLogger = createLogger('auth-server:token-exchange-service', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'token-exchange-service', 'TokenExchangeService', 'auth-server');

// =============================================================================
// TOKEN EXCHANGE SERVICE CLASS
// =============================================================================

/**
 * Token exchange service that leverages existing auth-server infrastructure
 */
export class TokenExchangeService {
  private provider?: Provider;
  private backendTokenExchangeService?: BackendTokenExchangeService;

  constructor(provider?: Provider) {
    this.provider = provider;
    
    // Initialize backend token exchange service
    this.initializeBackendTokenExchangeService();
    
    log.info({
      providerAvailable: !!provider,
      backendTokenExchangeServiceAvailable: !!this.backendTokenExchangeService
    }, 'auth-server:token-exchange-service - TokenExchangeService initialized');
  }

  /**
   * Initialize backend token exchange service
   */
  private initializeBackendTokenExchangeService(): void {
    try {
      // Initialize backend token exchange service with simplified approach
      this.backendTokenExchangeService = new BackendTokenExchangeService();
      
      log.info({}, 'auth-server:token-exchange-service:initializeBackendTokenExchangeService - Backend token exchange service initialized');
    } catch (error) {
      log.warn({
        error: error.message
      }, 'auth-server:token-exchange-service:initializeBackendTokenExchangeService - Failed to initialize backend token exchange service');
    }
  }

  /**
   * Exchange a subject token for a backend access token
   */
  public async exchangeToken(request: TokenExchangeRequest): Promise<TokenExchangeResponse | TokenExchangeErrorResponse> {
    const tracer = trace.getTracer('token-exchange-service', '1.0.0');
    
    return tracer.startActiveSpan('exchangeToken', {
      attributes: {
        'token_exchange.grant_type': request.grant_type,
        'token_exchange.subject_token_type': request.subject_token_type,
        'token_exchange.requested_token_type': request.requested_token_type,
        'token_exchange.has_resource': !!request.resource,
        'token_exchange.has_audience': !!request.audience,
        'token_exchange.has_scope': !!request.scope,
        'token_exchange.subject_token_length': request.subject_token?.length || 0
      }
    }, async (span) => {
      const startTime = Date.now();
      
      try {
      // Validate the request
      const validationResult = this.validateTokenExchangeRequest(request);
      if (!validationResult.valid) {
        span.setAttributes({ 'token_exchange.validation_failed': true, 'token_exchange.validation_errors': validationResult.errors.join(', ') });
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Request validation failed' });
        return this.createErrorResponse('invalid_request', validationResult.errors.join(', '));
      }

      // Validate the subject token
      const subjectTokenResult = await this.validateSubjectToken(request.subject_token, request.subject_token_type);
      
      if (!subjectTokenResult.success || !subjectTokenResult.data) {
        span.setAttributes({ 'token_exchange.subject_token_validation_failed': true, 'token_exchange.subject_token_error': subjectTokenResult.error });
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Subject token validation failed' });
        return this.createErrorResponse('invalid_grant', 'Invalid subject token');
      }

      const { user_id, organization_id } = subjectTokenResult.data;

      // Validate resource access if specified
      if (request.resource) {
        const resourceValidation = await this.validateResourceAccess(user_id, organization_id, request.resource);
        if (!resourceValidation.success) {
          return this.createErrorResponse('invalid_target', resourceValidation.error || 'Resource access denied');
        }
      }

      // Handle custom backend token type
      if (request.requested_token_type === 'urn:example:token-type:backend') {
        if (!this.backendTokenExchangeService) {
          return this.createErrorResponse('server_error', 'Backend token exchange service not available');
        }

        return await this.backendTokenExchangeService.exchangeForBackendToken(request);
      }

      // Handle standard OIDC token exchange
      const backendTokenResult = await this.getBackendTokenForOrganization(user_id, organization_id, request.resource);
      if (!backendTokenResult.success || !backendTokenResult.data) {
        return this.createErrorResponse('invalid_grant', 'Unable to obtain backend token');
      }

      // Validate backend token before exchange
      const backendValidation = this.validateBackendToken(backendTokenResult.data);
      if (!backendValidation.valid) {
        return this.createErrorResponse('invalid_grant', backendValidation.error || 'Backend token validation failed');
      }

      // Sanitize token data to ensure refresh tokens are never exposed
      const sanitizedData = this.sanitizeTokenResponse(backendTokenResult.data);

      // Create the response based on requested token type
      const response = this.createTokenExchangeResponse(sanitizedData, request.requested_token_type);

      const duration = Date.now() - startTime;

      span.setAttributes({
        'token_exchange.success': true,
        'token_exchange.duration_ms': duration,
        'token_exchange.organization_id': organization_id,
        'token_exchange.issued_token_type': response.issued_token_type,
        'token_exchange.expires_in': response.expires_in
      });
        span.setStatus({ code: SpanStatusCode.OK });
        
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        log.error({
          error: error.message,
          grant_type: request.grant_type,
          duration_ms: duration
        }, 'auth-server:token-exchange-service:exchangeToken - Token exchange failed');

        span.recordException(error);
        span.setAttributes({
          'token_exchange.success': false,
          'token_exchange.duration_ms': duration,
          'token_exchange.error': error.message
        });
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

        return this.createErrorResponse('server_error', 'Internal server error');
      } finally {
        span.end();
      }
    });
  }

  /**
   * Validate a subject token and extract account information
   */
  public async validateSubjectToken(
    subjectToken: string, 
    tokenType: string
  ): Promise<{ success: boolean; data?: SubjectTokenValidationResult; error?: string }> {
    const tracer = trace.getTracer('token-exchange-service', '1.0.0');
    
    return tracer.startActiveSpan('validateSubjectToken', {
      attributes: {
        'token_validation.token_type': tokenType,
        'token_validation.token_length': subjectToken.length,
        'token_validation.has_provider': !!this.provider
      }
    }, async (span) => {
      try {
        // Validate token type
        if (tokenType !== 'urn:ietf:params:oauth:token-type:access_token') {
          span.setAttributes({ 'token_validation.error': 'unsupported_token_type' });
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Unsupported subject token type' });
          return {
            success: false,
            error: 'Unsupported subject token type'
          };
        }

      // If we have an OIDC provider, use it to validate the token
      if (this.provider) {
        try {
          // Use OIDC provider to validate the access token
          const tokenInfo = await this.provider.AccessToken.find(subjectToken);
          
          if (!tokenInfo) {
            span.setAttributes({ 'token_validation.error': 'token_not_found' });
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Token not found in OIDC provider' });
            return {
              success: false,
              error: 'Invalid or expired subject token'
            };
          }

          // Check if token is expired
          if (tokenInfo.isExpired) {
            span.setAttributes({ 'token_validation.error': 'token_expired', 'token_validation.expires_at': tokenInfo.exp });
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Token is expired' });
            return {
              success: false,
              error: 'Subject token has expired'
            };
          }

          const userId = tokenInfo.accountId; // OIDC standard: accountId = userId
          const organizationId = tokenInfo.organizationId;
          const clientId = tokenInfo.clientId;
          const scope = tokenInfo.scope;

          const validationResult: SubjectTokenValidationResult = {
            valid: true,
            user_id: userId,
            organization_id: organizationId,
            client_id: clientId,
            scope: scope || 'openid profile email',
            expires_at: tokenInfo.exp
          };

          span.setAttributes({
            'token_validation.success': true,
            'token_validation.organization_id': validationResult.organization_id,
            'token_validation.client_id': validationResult.client_id,
            'token_validation.scope': validationResult.scope
          });
          span.setStatus({ code: SpanStatusCode.OK });

          return {
            success: true,
            data: validationResult
          };
        } catch (providerError) {
          span.recordException(providerError);
          span.setAttributes({ 'token_validation.provider_error': providerError.message });
        }
      }

        // Fallback: Manual token validation via JWT decode
        const { userId: fallbackUserId, organizationId: fallbackOrgId } = this.extractClaimsFromToken(subjectToken);
        
        if (!fallbackOrgId) {
          span.setAttributes({ 'token_validation.error': 'invalid_token_format' });
          span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid subject token format' });
          return {
            success: false,
            error: 'Invalid subject token format'
          };
        }

        const validationResult: SubjectTokenValidationResult = {
          valid: true,
          user_id: fallbackUserId || undefined,
          organization_id: fallbackOrgId,
          client_id: 'fallback-client-id',
          scope: 'openid profile email',
          expires_at: Date.now() + (getTokenTtlConfig().refreshToken * 1000)
        };

        span.setAttributes({
          'token_validation.success': true,
          'token_validation.organization_id': validationResult.organization_id,
          'token_validation.client_id': validationResult.client_id,
          'token_validation.scope': validationResult.scope
        });
        span.setStatus({ code: SpanStatusCode.OK });

        return {
          success: true,
          data: validationResult
        };
      } catch (error) {
        log.error({
          error: error.message,
          tokenType
        }, 'auth-server:token-exchange-service:validateSubjectToken - Failed to validate subject token');

        span.recordException(error);
        span.setAttributes({ 'token_validation.error': error.message });
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

        return {
          success: false,
          error: error.message
        };
      } finally {
        span.end();
      }
    });
  }

  /**
   * Get backend token for an organization, refreshing if necessary.
   * Uses userId to look up the stored OIDC auth result (keyed by userId in Redis).
   */
  private async getBackendTokenForOrganization(userId: string | undefined, organizationId: string, resource?: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      if (!userId) {
        return { success: false, error: 'No user ID available for auth result lookup' };
      }

      log.debug({
        userId,
        organizationId,
        resource
      }, 'auth-server:token-exchange-service:getBackendTokenForOrganization - Getting backend token for organization');

      const storedAuthResult = await getStoredAuthResult(userId);
      
      if (!storedAuthResult) {
        return {
          success: false,
          error: 'No stored auth result found'
        };
      }

      // Check if we need to refresh the token
      const needsRefresh = this.shouldRefreshToken(storedAuthResult);
      
      if (needsRefresh) {
        log.info({
          organizationId,
          lastRefresh: (storedAuthResult as any).metadata?.last_refresh
        }, 'auth-server:token-exchange-service:getBackendTokenForOrganization - Token needs refresh, refreshing...');

        log.warn({
          organizationId
        }, 'auth-server:token-exchange-service:getBackendTokenForOrganization - Token refresh not available, using existing token');
        
        if (this.isTokenValid(storedAuthResult)) {
          return {
            success: true,
            data: storedAuthResult
          };
        }
        
        return {
          success: false,
          error: 'Token refresh failed and existing token is invalid'
        };
      }

      return {
        success: true,
        data: storedAuthResult
      };
    } catch (error) {
      log.error({
        error: error.message,
        organizationId
      }, 'auth-server:token-exchange-service:getBackendTokenForOrganization - Failed to get backend token');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate token exchange request
   */
  private validateTokenExchangeRequest(request: TokenExchangeRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate grant_type
    if (!request.grant_type) {
      errors.push('Missing grant_type parameter');
    } else if (request.grant_type !== 'urn:ietf:params:oauth:grant-type:token-exchange') {
      errors.push('Invalid grant_type. Must be urn:ietf:params:oauth:grant-type:token-exchange');
    }

    // Validate subject_token
    if (!request.subject_token) {
      errors.push('Missing subject_token parameter');
    } else if (typeof request.subject_token !== 'string' || request.subject_token.trim().length === 0) {
      errors.push('Invalid subject_token parameter');
    }

    // Validate subject_token_type
    if (!request.subject_token_type) {
      errors.push('Missing subject_token_type parameter');
    } else if (request.subject_token_type !== 'urn:ietf:params:oauth:token-type:access_token') {
      errors.push('Unsupported subject_token_type. Only urn:ietf:params:oauth:token-type:access_token is supported');
    }

    // Validate requested_token_type (optional)
    if (request.requested_token_type) {
      const supportedTypes = [
        'urn:ietf:params:oauth:token-type:access_token',
        'urn:example:token-type:backend'
      ];
      
      if (!supportedTypes.includes(request.requested_token_type)) {
        errors.push(`Unsupported requested_token_type. Supported types: ${supportedTypes.join(', ')}`);
      }
    }

    // Validate resource (optional)
    if (request.resource && typeof request.resource !== 'string') {
      errors.push('Invalid resource parameter. Must be a string');
    }

    // Validate audience (optional)
    if (request.audience && typeof request.audience !== 'string') {
      errors.push('Invalid audience parameter. Must be a string');
    }

    // Validate scope (optional)
    if (request.scope && typeof request.scope !== 'string') {
      errors.push('Invalid scope parameter. Must be a string');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create token exchange response
   */
  private createTokenExchangeResponse(accountData: any, requestedTokenType?: string): TokenExchangeResponse {
    const tokenType = requestedTokenType || 'urn:ietf:params:oauth:token-type:access_token';
    
    let accessToken: string;
    let expiresIn: number;
    let scope: string;

    if (tokenType === 'urn:example:token-type:backend') {
      // Return backend access token with proper formatting
      accessToken = accountData.accessToken;
      expiresIn = this.calculateBackendTokenExpiration(accountData);
      scope = this.determineBackendTokenScope(accountData);
      
      log.info({
        tokenType,
        expiresIn,
        scope,
        hasBackendToken: !!accessToken
      }, 'auth-server:token-exchange-service:createTokenExchangeResponse - Creating backend token response');
    } else {
      // Return OIDC access token (placeholder - would be generated by OIDC provider)
      accessToken = accountData.accessToken; // For now, return backend token
      expiresIn = 3600; // 1 hour
      scope = 'openid profile email';
    }

    return {
      access_token: accessToken,
      issued_token_type: tokenType as 'urn:ietf:params:oauth:token-type:access_token' | 'urn:example:token-type:backend',
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: string, errorDescription?: string): TokenExchangeErrorResponse {
    return {
      error,
      error_description: errorDescription
    };
  }

  /**
   * Extract user ID (sub) and organization ID from a JWT subject token
   */
  private extractClaimsFromToken(subjectToken: string): { userId: string | null; organizationId: string | null } {
    try {
      const parts = subjectToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return {
          userId: payload.sub || null,
          organizationId: payload.organization_id || null,
        };
      }
      
      return { userId: null, organizationId: null };
    } catch (error) {
      log.warn({
        error: error.message,
        tokenLength: subjectToken.length
      }, 'auth-server:token-exchange-service:extractClaimsFromToken - Failed to extract claims from token');
      
      return { userId: null, organizationId: null };
    }
  }

  /**
   * Check if token needs refresh
   */
  private shouldRefreshToken(accountData: any): boolean {
    const now = Date.now();
    const expiresAt = accountData.metadata?.expires_at || (now + (getTokenTtlConfig().refreshToken * 1000)); // Use refresh token TTL from env
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes
    
    return (expiresAt - now) < refreshThreshold;
  }

  /**
   * Check if token is valid
   */
  private isTokenValid(accountData: any): boolean {
    const now = Date.now();
    const expiresAt = accountData.metadata?.expires_at || (now + (getTokenTtlConfig().refreshToken * 1000)); // Use refresh token TTL from env
    
    return expiresAt > now;
  }

  /**
   * Calculate backend token expiration time
   */
  private calculateBackendTokenExpiration(accountData: any): number {
    try {
      // Get expiration from metadata if available
      const expiresAt = accountData.metadata?.expires_at;
      if (expiresAt) {
        const now = Date.now();
        const expirationMs = expiresAt - now;
        // Return seconds, minimum 60 seconds
        return Math.max(Math.floor(expirationMs / 1000), 60);
      }

      // Default to 1 hour if no expiration metadata
      return 3600;
    } catch (error) {
      log.warn({
        error: error.message,
        accountData: !!accountData
      }, 'auth-server:token-exchange-service:calculateBackendTokenExpiration - Failed to calculate expiration, using default');

      return 3600; // 1 hour default
    }
  }

  /**
   * Determine backend token scope based on account data
   */
  private determineBackendTokenScope(accountData: any): string {
    try {
      // Get scope from metadata if available
      const metadataScope = accountData.metadata?.scope;
      if (metadataScope) {
        return metadataScope;
      }

      // Determine scope based on user permissions
      const user = accountData.user;
      if (user?.isAdmin) {
        return 'openid profile email admin backend:full';
      }

      // Default scope for regular users
      return 'openid profile email backend:read';
    } catch (error) {
      log.warn({
        error: error.message,
        accountData: !!accountData
      }, 'auth-server:token-exchange-service:determineBackendTokenScope - Failed to determine scope, using default');

      return 'openid profile email backend:read';
    }
  }

  /**
   * Validate backend token before exchange
   */
  private validateBackendToken(accountData: any): {
    valid: boolean;
    error?: string;
  } {
    try {
      // Check if account data exists
      if (!accountData) {
        return {
          valid: false,
          error: 'No account data available'
        };
      }

      // Check if access token exists
      if (!accountData.accessToken) {
        return {
          valid: false,
          error: 'No backend access token available'
        };
      }

      // Check if token is expired
      if (!this.isTokenValid(accountData)) {
        return {
          valid: false,
          error: 'Backend token has expired'
        };
      }

      // Check if user data exists
      if (!accountData.user || !accountData.user.userId) {
        return {
          valid: false,
          error: 'Invalid user data in account'
        };
      }

      log.debug({
        hasAccessToken: !!accountData.accessToken,
        hasUser: !!accountData.user,
        userId: accountData.user?.userId,
        isAdmin: accountData.user?.isAdmin
      }, 'auth-server:token-exchange-service:validateBackendToken - Backend token validation successful');

      return {
        valid: true
      };
    } catch (error) {
      log.error({
        error: error.message,
        accountData: !!accountData
      }, 'auth-server:token-exchange-service:validateBackendToken - Backend token validation failed');

      return {
        valid: false,
        error: 'Backend token validation failed'
      };
    }
  }

  /**
   * Ensure refresh tokens are never exposed in responses
   */
  private sanitizeTokenResponse(accountData: any): any {
    try {
      // Create a sanitized copy without sensitive data
      const sanitized = {
        accessToken: accountData.accessToken,
        user: {
          userId: accountData.user?.userId,
          name: accountData.user?.name,
          email: accountData.user?.email,
          compName: accountData.user?.compName,
          compId: accountData.user?.compId,
          isAdmin: accountData.user?.isAdmin,
          roleInCompany: accountData.user?.roleInCompany,
          avatarURL: accountData.user?.avatarURL,
          phone: accountData.user?.phone
        },
        metadata: {
          created_at: accountData.metadata?.created_at,
          expires_at: accountData.metadata?.expires_at,
          source: accountData.metadata?.source,
          version: accountData.metadata?.version,
          organization_id: accountData.metadata?.organization_id,
          refresh_count: accountData.metadata?.refresh_count,
          last_refresh: accountData.metadata?.last_refresh,
          access_count: accountData.metadata?.access_count,
          last_accessed_at: accountData.metadata?.last_accessed_at
        }
      };

      // Explicitly remove refresh token if it exists
      delete (sanitized as any).refreshToken;

      log.debug({
        hasAccessToken: !!sanitized.accessToken,
        hasRefreshToken: false, // Explicitly false
        userId: sanitized.user?.userId
      }, 'auth-server:token-exchange-service:sanitizeTokenResponse - Token response sanitized');

      return sanitized;
    } catch (error) {
      log.error({
        error: error.message,
        accountData: !!accountData
      }, 'auth-server:token-exchange-service:sanitizeTokenResponse - Failed to sanitize token response');

      // Return minimal safe data
      return {
        accessToken: accountData.accessToken,
        user: accountData.user,
        metadata: accountData.metadata
      };
    }
  }

  /**
   * Validate resource access for the user/organization.
   * Uses userId to look up the stored OIDC auth result (keyed by userId in Redis).
   */
  private async validateResourceAccess(userId: string | undefined, organizationId: string, resource: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!userId) {
        return { success: false, error: 'No user ID available for auth result lookup' };
      }

      log.debug({
        userId,
        organizationId,
        resource
      }, 'auth-server:token-exchange-service:validateResourceAccess - Validating resource access');

      const storedAuthResult = await getStoredAuthResult(userId);
      if (!storedAuthResult) {
        return {
          success: false,
          error: 'Auth result not found'
        };
      }

      const allowedResources = [
        'https://api.morezero.com/',
        'https://api.morezero.com/v1/',
        'https://mcp.morezero.com/',
        'https://auth.morezero.com/'
      ];

      const isResourceAllowed = allowedResources.some(allowedResource => 
        resource.startsWith(allowedResource)
      );

      if (!isResourceAllowed) {
        log.warn({
          organizationId,
          resource,
          allowedResources
        }, 'auth-server:token-exchange-service:validateResourceAccess - Resource access denied');

        return {
          success: false,
          error: 'Access denied to requested resource'
        };
      }

      if (resource.includes('/admin/') && !storedAuthResult.user?.isAdmin) {
        log.warn({
          organizationId,
          resource,
          isAdmin: storedAuthResult.user?.isAdmin
        }, 'auth-server:token-exchange-service:validateResourceAccess - Admin resource access denied for non-admin user');

        return {
          success: false,
          error: 'Admin privileges required for this resource'
        };
      }

      log.info({
        organizationId,
        resource,
        isAdmin: storedAuthResult.user?.isAdmin
      }, 'auth-server:token-exchange-service:validateResourceAccess - Resource access granted');

      return {
        success: true
      };
    } catch (error) {
      log.error({
        error: error.message,
        organizationId,
        resource
      }, 'auth-server:token-exchange-service:validateResourceAccess - Resource validation failed');

      return {
        success: false,
        error: 'Resource validation failed'
      };
    }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a new token exchange service instance
 */
export function createTokenExchangeService(provider?: Provider): TokenExchangeService {
  return new TokenExchangeService(provider);
}

export default TokenExchangeService;
