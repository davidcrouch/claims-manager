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
   | 'VALIDATION_ERROR';

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

   constructor() {
      this.signupService = createApplicationSignupService();
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
         hasOrigin: !!input.origin
      }, 'auth-server:internal-signup:signup - Starting unified signup');

      try {
         // 1. Hash password if provided (for password-based auth)
         let passwordHash: string | undefined;
         if (input.provider === 'password' && input.password) {
            passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
            log.debug({ functionName }, 'auth-server:internal-signup:signup - Password hashed');
         }

         // 2. Call signup service - creates everything in one transaction
         const organizationName = input.organizationName;
         const organizationId = input.organizationId;
         log.debug({
            functionName,
            email: input.email,
            provider: input.provider,
            organizationName,
         }, 'auth-server:internal-signup:signup - Calling local signup service');

         const result = await this.signupService.signup(context, {
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

