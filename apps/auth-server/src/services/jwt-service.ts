import { SignJWT, importJWK } from 'jose';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getOidcIssuer, getJwksConfig } from '../config/env-validation.js';

// Create the base logger using the logger package
const baseLogger = createLogger('auth-server:jwt-service', LoggerType.NODEJS);

// Create telemetry logger that wraps the base logger
const log = createTelemetryLogger(baseLogger, 'jwt-service', 'JwtService', 'auth-server');

export class JwtService {
   private issuer: string;
   private privateKey: any; // Cached RSA private key from JWKS

   constructor() {
      this.issuer = getOidcIssuer();
      
      // Load and cache the RSA private key from JWKS config
      try {
         const jwks = getJwksConfig();
         const rsaKey = jwks.keys.find((key: any) => key.kty === 'RSA');
         if (!rsaKey) {
            throw new Error('No RSA key found in JWKS configuration');
         }
         // Cache the private key for signing
         this.privateKey = rsaKey;
         
         log.info({
            functionName: 'constructor',
            keyType: 'RSA',
            keyId: rsaKey.kid || 'default'
         }, 'JWT service initialized with JWKS RSA key');
      } catch (error: any) {
         log.error({
            functionName: 'constructor',
            error: error.message
         }, 'Failed to load JWKS configuration for JWT signing');
         throw new Error(`JWT service initialization failed: ${error.message}`);
      }
   }

   /**
    * Generate API token for API server access using JWKS RSA key
    * This replaces the old generateBackendJwt method and uses JWKS keys instead of HS256
    */
   async generateApiToken(params: {
      userId: string;
      email: string;
      name: string;
      organizationId: string;
      avatarURL?: string;
      phone?: string;
   }): Promise<string> {
      const now = Math.floor(Date.now() / 1000);

      const payload = {
         sub: params.userId,
         email: params.email,
         name: params.name,
         organization_id: params.organizationId,
         roles: ['user'],
         features: [],
         avatarURL: params.avatarURL,
         phone: params.phone
      };

      log.debug({
         functionName: 'generateApiToken',
         userId: params.userId,
         email: params.email,
         organizationId: params.organizationId,
      }, 'auth-server:jwt-service:generateApiToken - Generating API token with JWKS RSA key');

      try {
         // Import the private key from JWKS format
         const key = await importJWK(this.privateKey, 'RS256'); // RSA with SHA-256
         
         // Sign the token using JWKS RSA key
         const token = await new SignJWT(payload)
            .setProtectedHeader({ 
               alg: 'RS256', // RSA with SHA-256
               typ: 'JWT',
               kid: this.privateKey.kid // Include Key ID for JWKS lookup
            })
            .setIssuer(this.issuer)
            .setAudience('morezero-api-server')
            .setIssuedAt(now)
            .setExpirationTime(now + (24 * 60 * 60)) // 24 hours
            .sign(key);

         return token;
      } catch (error: any) {
         log.error({
            functionName: 'generateApiToken',
            error: error.message,
            stack: error.stack
         }, 'Failed to generate API token with JWKS key');
         throw new Error(`Failed to generate API token: ${error.message}`);
      }
   }

   /**
    * Verify JWT token (for backward compatibility - tokens are now verified via JWKS)
    * Note: This method is kept for backward compatibility but tokens should be verified
    * using JWKS endpoint in the consuming service (api-server)
    */
   verifyToken(token: string): any {
      log.warn({
         functionName: 'verifyToken'
      }, 'verifyToken is deprecated - tokens should be verified via JWKS endpoint');
      // This method is kept for backward compatibility
      // In production, tokens should be verified using JWKS
      throw new Error('Token verification should be done via JWKS endpoint, not shared secret');
   }

   /**
    * Decode JWT token without verification
    */
   decodeToken(token: string): any {
      try {
         // For decoding without verification, we can use a simple base64 decode
         const parts = token.split('.');
         if (parts.length !== 3) {
            throw new Error('Invalid token format');
         }
         const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
         return payload;
      } catch (error: any) {
         log.error({
            functionName: 'decodeToken',
            error: error.message
         }, 'JWT decode failed');
         throw new Error('Invalid token format');
      }
   }

   /**
    * Generate a service token for internal service-to-service communication
    * This token is used by auth-server to call api-server internal endpoints
    * 
    * The token has:
    * - type: 'service' to identify it as a service token
    * - scope: 'internal' for internal API access
    * - Short expiry (5 minutes) since it's only used for immediate requests
    */
   async generateServiceToken(): Promise<string> {
      const now = Math.floor(Date.now() / 1000);

      const payload = {
         sub: 'auth-server',
         type: 'service',
         scope: 'internal',
         organization_id: 'system',
         roles: ['service'],
         features: ['internal-api']
      };

      log.debug({
         functionName: 'generateServiceToken',
         sub: payload.sub,
         type: payload.type
      }, 'Generating service token for internal API calls');

      try {
         // Import the private key from JWKS format
         const key = await importJWK(this.privateKey, 'RS256');
         
         // Sign the token using JWKS RSA key
         const token = await new SignJWT(payload)
            .setProtectedHeader({ 
               alg: 'RS256',
               typ: 'JWT',
               kid: this.privateKey.kid // Include Key ID for JWKS lookup
            })
            .setIssuer(this.issuer)
            .setAudience('morezero-api-server')
            .setIssuedAt(now)
            .setExpirationTime(now + (5 * 60)) // 5 minutes - short lived for service calls
            .sign(key);

         return token;
      } catch (error: any) {
         log.error({
            functionName: 'generateServiceToken',
            error: error.message,
            stack: error.stack
         }, 'Failed to generate service token');
         throw new Error(`Failed to generate service token: ${error.message}`);
      }
   }
}
