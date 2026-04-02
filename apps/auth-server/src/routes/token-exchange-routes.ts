/**
 * =============================================================================
 * TOKEN EXCHANGE ROUTES MODULE
 * =============================================================================
 * 
 * This module handles OAuth 2.0 Token Exchange (RFC 8693) routes for the auth server.
 * It integrates with the existing OIDC provider and uses the existing infrastructure.
 * 
 * Key Features:
 * - RFC 8693 compliant token exchange endpoint
 * - Integrates with existing OIDC provider
 * - Uses existing Redis storage and BackendService
 * - Comprehensive error handling and logging
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

import { Application, Request, Response, NextFunction } from 'express';
import { Provider } from 'oidc-provider';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { TokenExchangeService } from '../services/token-exchange-service.js';
import { 
  TokenExchangeRequest, 
  TokenExchangeResponse, 
  TokenExchangeErrorResponse 
} from '../types/token-exchange.js';

const baseLogger = createLogger('auth-server:token-exchange-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'token-exchange-routes', 'TokenExchangeRoutes', 'auth-server');

// =============================================================================
// MAIN ROUTE FACTORY FUNCTION
// =============================================================================

/**
 * Creates and configures token exchange routes for the Express application.
 * 
 * This function sets up RFC 8693 compliant token exchange endpoints including:
 * - Token exchange endpoint with validation
 * - Subject token validation
 * - Backend token retrieval and refresh
 * - Comprehensive error handling
 * 
 * @param app - Express Application instance
 * @param provider - OIDC Provider instance for handling OAuth flows
 */
function createTokenExchangeRoutes(
   app: Application, 
   provider: Provider
): void {
   
   // =============================================================================
   // SERVICE INITIALIZATION
   // =============================================================================
   
   const tokenExchangeService = new TokenExchangeService(provider);
   
   log.info({
      providerAvailable: !!provider,
      tokenExchangeServiceAvailable: !!tokenExchangeService
   }, 'auth-server:token-exchange-routes - Token exchange routes initialized');

   // =============================================================================
   // UTILITY FUNCTIONS
   // =============================================================================

   /**
    * Middleware function to set no-cache headers for security.
    * Prevents caching of token exchange responses to ensure security.
    * 
    * @param req - Express Request object
    * @param res - Express Response object
    * @param next - Express NextFunction
    */
   function setNoCache(req: Request, res: Response, next: NextFunction) {
      res.set('cache-control', 'no-store');
      next();
   }

   /**
    * Middleware function to validate token exchange requests.
    * Ensures required parameters are present and properly formatted.
    * 
    * @param req - Express Request object
    * @param res - Express Response object
    * @param next - Express NextFunction
    */
   function validateTokenExchangeRequest(req: Request, res: Response, next: NextFunction) {
      const { grant_type, subject_token, subject_token_type } = req.body;

      if (!grant_type) {
         return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing grant_type parameter'
         });
      }

      if (grant_type !== 'urn:ietf:params:oauth:grant-type:token-exchange') {
         return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Unsupported grant_type'
         });
      }

      if (!subject_token) {
         return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing subject_token parameter'
         });
      }

      if (!subject_token_type) {
         return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing subject_token_type parameter'
         });
      }

      if (subject_token_type !== 'urn:ietf:params:oauth:token-type:access_token') {
         return res.status(400).json({
            error: 'unsupported_token_type',
            error_description: 'Unsupported subject_token_type'
         });
      }

      next();
   }

   /**
    * Middleware function to log token exchange requests.
    * Logs request details for audit and debugging purposes.
    * 
    * @param req - Express Request object
    * @param res - Express Response object
    * @param next - Express NextFunction
    */
   function logTokenExchangeRequest(req: Request, res: Response, next: NextFunction) {
      const { grant_type, subject_token_type, requested_token_type, resource, scope } = req.body;
      
      log.info({
         method: req.method,
         path: req.path,
         grant_type,
         subject_token_type,
         requested_token_type,
         resource,
         scope,
         client_ip: req.ip,
         user_agent: req.headers['user-agent']
      }, 'auth-server:token-exchange-routes:logTokenExchangeRequest - Token exchange request received');

      next();
   }

   // =============================================================================
   // TOKEN EXCHANGE ROUTES
   // =============================================================================

   /**
    * POST /token/exchange - OAuth 2.0 Token Exchange endpoint (RFC 8693)
    * 
    * This endpoint implements the OAuth 2.0 Token Exchange specification (RFC 8693)
    * to exchange subject tokens for backend access tokens.
    * 
    * Request Body:
    * - grant_type: Must be 'urn:ietf:params:oauth:grant-type:token-exchange'
    * - subject_token: The token to be exchanged
    * - subject_token_type: Type of the subject token
    * - resource: Optional resource identifier
    * - requested_token_type: Optional type of token requested
    * - audience: Optional audience for the requested token
    * - scope: Optional scope for the requested token
    * 
    * @route POST /token/exchange
    * @middleware setNoCache - Prevents caching of token exchange responses
    * @middleware validateTokenExchangeRequest - Validates request parameters
    * @middleware logTokenExchangeRequest - Logs request for audit purposes
    * @returns Token exchange response or error response
    */
   app.post('/token/exchange', 
      setNoCache, 
      validateTokenExchangeRequest, 
      logTokenExchangeRequest,
      async (req: Request, res: Response, next: NextFunction) => {
         try {
            const tokenExchangeRequest: TokenExchangeRequest = {
               grant_type: req.body.grant_type,
               subject_token: req.body.subject_token,
               subject_token_type: req.body.subject_token_type,
               resource: req.body.resource,
               requested_token_type: req.body.requested_token_type,
               audience: req.body.audience,
               scope: req.body.scope
            };

            log.debug({
               request: tokenExchangeRequest
            }, 'auth-server:token-exchange-routes:tokenExchange - Processing token exchange request');

            // Process the token exchange
            const result = await tokenExchangeService.exchangeToken(tokenExchangeRequest);

            if ('error' in result) {
               // Error response
               const errorResponse = result as TokenExchangeErrorResponse;
               
               log.warn({
                  error: errorResponse.error,
                  error_description: errorResponse.error_description,
                  request: tokenExchangeRequest
               }, 'auth-server:token-exchange-routes:tokenExchange - Token exchange failed');

               return res.status(400).json(errorResponse);
            } else {
               // Success response
               const successResponse = result as TokenExchangeResponse;
               
               log.info({
                  issued_token_type: successResponse.issued_token_type,
                  expires_in: successResponse.expires_in,
                  scope: successResponse.scope,
                  request: tokenExchangeRequest
               }, 'auth-server:token-exchange-routes:tokenExchange - Token exchange completed successfully');

               return res.json(successResponse);
            }
         } catch (error) {
            log.error({
               error: error.message,
               stack: error.stack,
               request: req.body
            }, 'auth-server:token-exchange-routes:tokenExchange - Token exchange error');

            return res.status(500).json({
               error: 'server_error',
               error_description: 'Internal server error'
            });
         }
      }
   );

   /**
    * GET /token/exchange - Token exchange endpoint information
    * 
    * This endpoint provides information about the token exchange endpoint
    * and supported parameters.
    * 
    * @route GET /token/exchange
    * @returns Information about the token exchange endpoint
    */
   app.get('/token/exchange', (req: Request, res: Response) => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      res.json({
         endpoint: `${baseUrl}/token/exchange`,
         grant_types_supported: [
            'urn:ietf:params:oauth:grant-type:token-exchange'
         ],
         subject_token_types_supported: [
            'urn:ietf:params:oauth:token-type:access_token'
         ],
         requested_token_types_supported: [
            'urn:ietf:params:oauth:token-type:access_token',
            'urn:example:token-type:backend'
         ],
         documentation: 'https://tools.ietf.org/html/rfc8693'
      });
   });

   // =============================================================================
   // ERROR HANDLING MIDDLEWARE
   // =============================================================================

   /**
    * Global error handler for token exchange routes
    * 
    * This middleware handles errors specific to token exchange operations
    * and provides appropriate error responses.
    * 
    * @param err - Error object from previous middleware
    * @param req - Express Request object
    * @param res - Express Response object
    * @param next - Express NextFunction
    */
   app.use('/token/exchange', (err: any, req: Request, res: Response, next: NextFunction) => {
      log.error({
         error: err.message,
         stack: err.stack,
         path: req.path,
         method: req.method
      }, 'auth-server:token-exchange-routes:error-handler - Token exchange error');

      // Handle specific error types
      if (err.name === 'ValidationError') {
         return res.status(400).json({
            error: 'invalid_request',
            error_description: err.message
         });
      }

      if (err.name === 'TokenExchangeError') {
         return res.status(400).json({
            error: 'invalid_grant',
            error_description: err.message
         });
      }

      // Default error response
      return res.status(500).json({
         error: 'server_error',
         error_description: 'Internal server error'
      });
   });
}

// =============================================================================
// EXPORTS
// =============================================================================

export default createTokenExchangeRoutes;
