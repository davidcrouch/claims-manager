/**
 * Internal Signup Service
 * 
 * This service handles user registration directly using the database packages,
 * avoiding the need for HTTP calls to api-server.
 * 
 * It provides the same functionality as api-server's internal.service.ts but
 * runs locally in the auth-server process.
 */

import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import {
   createApplicationSignupService,
   ApplicationSignupService,
   createApplicationsService,
   ApplicationsService,
} from '../db/services/index.js';
import type { AccessContext } from '../schemas/index.js';
import * as bcrypt from 'bcrypt';

const baseLogger = createLogger('auth-server:internal-signup', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'internal-signup', 'InternalSignupService', 'auth-server');

export interface InternalSignupInput {
   email: string;
   name?: string;
   avatarUrl?: string;
   provider: string;
   providerUserId: string;
   password?: string;
   organizationName?: string;
   organizationId?: string;
   applicationId?: string;
   origin?: string;
   subdomain?: string;
   accessToken?: string;
   refreshToken?: string;
   tokenExpiresAt?: Date | string;
   providerDisplayName?: string;
   providerRawProfile?: Record<string, unknown>;
}

export type InternalSignupErrorCode = 
   | 'EMAIL_ALREADY_EXISTS'
   | 'IDENTITY_ALREADY_EXISTS'
   | 'INVALID_PASSWORD'
   | 'INVALID_PROVIDER'
   | 'PROVISIONING_FAILED'
   | 'DATABASE_ERROR'
   | 'VALIDATION_ERROR'
   | 'APPLICATION_NOT_FOUND';

export interface InternalSignupResult {
   success: boolean;
   userId?: string;
   userIdentityId?: string;
   organizationId?: string;
   organizationUserId?: string;
   scenario?: string;
   error?: string;
   errorCode?: InternalSignupErrorCode;
}

const MORE0_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const BCRYPT_SALT_ROUNDS = 12;

class InternalSignupService {
   private signupService: ApplicationSignupService;
   private applicationsService: ApplicationsService;

   constructor() {
      this.signupService = createApplicationSignupService();
      this.applicationsService = createApplicationsService();
   }

   /**
    * Unified signup - creates user, identity, organization, and organization_user in one transaction
    */
   async signup(input: InternalSignupInput): Promise<InternalSignupResult> {
      const functionName = 'signup';
      const context: AccessContext = { organizationId: 'public', userId: MORE0_SYSTEM_USER_ID };

      log.info({
         functionName,
         email: input.email,
         provider: input.provider,
         hasPassword: !!input.password,
         hasApplicationId: !!input.applicationId,
         hasSubdomain: !!input.subdomain,
         hasOrigin: !!input.origin
      }, 'auth-server:internal-signup:signup - Starting unified signup');

      try {
         // 1. Resolve application ID
         const applicationId = await this.resolveApplicationId(input, context);

         if (!applicationId) {
            log.error({ functionName }, 'auth-server:internal-signup:signup - Could not resolve application');
            return {
               success: false,
               error: 'Could not resolve application',
               errorCode: 'APPLICATION_NOT_FOUND'
            };
         }

         // 2. Hash password if provided (for password-based auth)
         let passwordHash: string | undefined;
         if (input.provider === 'password' && input.password) {
            passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
            log.debug({ functionName }, 'auth-server:internal-signup:signup - Password hashed');
         }

         // 3. Call signup service - creates everything in one transaction
         const organizationName = input.organizationName;
         const organizationId = input.organizationId;
         log.debug({
            functionName,
            email: input.email,
            provider: input.provider,
            applicationId,
            organizationName,
         }, 'auth-server:internal-signup:signup - Calling local signup service');

         const result = await this.signupService.signup(context, {
            applicationId,
            email: input.email,
            name: input.name,
            avatarUrl: input.avatarUrl,
            passwordHash,
            organizationName,
            organizationId,
            provider: input.provider,
            providerUserId: input.providerUserId,
            providerProfile: {
               displayName: input.providerDisplayName,
               avatarUrl: input.avatarUrl,
               rawProfile: input.providerRawProfile,
               accessToken: input.accessToken,
               refreshToken: input.refreshToken,
               tokenExpiresAt: input.tokenExpiresAt,
            },
            initiatedByEmail: input.email,
         });

         log.info({
            functionName,
            userId: result.userId,
            organizationId: result.organizationId,
            userIdentityId: result.userIdentityId,
            scenario: result.scenario,
         }, 'auth-server:internal-signup:signup - Signup completed successfully');

         return {
            success: true,
            userId: result.userId,
            userIdentityId: result.userIdentityId,
            organizationId: result.organizationId,
            organizationUserId: result.organizationUserId,
            scenario: result.scenario,
         };

      } catch (error: any) {
         console.error('auth-server:internal-signup:signup - Signup failed:', error?.message, error?.stack);
         log.error({
            functionName,
            email: input.email,
            error: error.message,
            stack: error.stack
         }, 'auth-server:internal-signup:signup - Signup failed');

         // Check for duplicate email/identity errors
         if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
            return {
               success: false,
               error: 'User or identity already exists',
               errorCode: 'IDENTITY_ALREADY_EXISTS'
            };
         }

         return {
            success: false,
            error: error.message || 'Signup failed',
            errorCode: 'DATABASE_ERROR'
         };
      }
   }

   /**
    * Resolve application ID from various sources
    */
   private async resolveApplicationId(
      input: { applicationId?: string; subdomain?: string; origin?: string },
      context: AccessContext
   ): Promise<string | null> {
      const functionName = 'resolveApplicationId';

      // Priority 1: Direct application ID
      if (input.applicationId) {
         log.debug({ functionName, applicationId: input.applicationId }, 
            'auth-server:internal-signup:resolveApplicationId - Using direct application ID');
         return input.applicationId;
      }

      // Priority 2: Subdomain header
      if (input.subdomain) {
         try {
            const app = await this.applicationsService.getApplicationBySubdomain(context, input.subdomain);
            if (app) {
               log.debug({
                  functionName,
                  subdomain: input.subdomain,
                  applicationId: app.id
               }, 'auth-server:internal-signup:resolveApplicationId - Resolved from subdomain');
               return app.id;
            }
         } catch (error: any) {
            log.warn({
               functionName,
               subdomain: input.subdomain,
               error: error.message
            }, 'auth-server:internal-signup:resolveApplicationId - Failed to resolve from subdomain');
         }
      }

      // Priority 3: Extract subdomain from origin URL
      if (input.origin) {
         try {
            const url = new URL(input.origin);
            const hostname = url.hostname;
            const parts = hostname.split('.');

            if (parts.length >= 3 && !hostname.includes('localhost')) {
               const originSubdomain = parts[0];
               const app = await this.applicationsService.getApplicationBySubdomain(context, originSubdomain);
               if (app) {
                  log.debug({
                     functionName,
                     origin: input.origin,
                     originSubdomain,
                     applicationId: app.id
                  }, 'auth-server:internal-signup:resolveApplicationId - Resolved from origin');
                  return app.id;
               }
            }
         } catch (error: any) {
            log.warn({
               functionName,
               origin: input.origin,
               error: error.message
            }, 'auth-server:internal-signup:resolveApplicationId - Failed to resolve from origin');
         }
      }

      log.warn({ functionName, input }, 
         'auth-server:internal-signup:resolveApplicationId - Could not resolve application ID');
      return null;
   }
}

// Singleton instance
let internalSignupService: InternalSignupService | null = null;

export function getInternalSignupService(): InternalSignupService {
   if (!internalSignupService) {
      internalSignupService = new InternalSignupService();
   }
   return internalSignupService;
}

export { InternalSignupService };

