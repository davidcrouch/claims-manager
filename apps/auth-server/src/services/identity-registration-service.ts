/**
 * =============================================================================
 * IDENTITY REGISTRATION SERVICE
 * =============================================================================
 * 
 * Unified registration service for all identity providers.
 * This service handles the creation of user identities regardless of the
 * authentication method (password, Google OAuth, Apple, etc.).
 * 
 * Architecture:
 * - ALL database operations (user, identity, organization, organization_user) are handled locally
 *   using the InternalSignupService which wraps the database packages
 * - This ensures atomicity - everything is created in a single transaction
 * - No HTTP calls to api-server required
 */

import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { createUserIdentitiesService, createUsersService } from '../db/services/index.js';
import type { AccessContext } from '../schemas/index.js';
import { getInternalSignupService } from './internal-signup-service.js';

const baseLogger = createLogger('auth-server:identity-registration', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'identity-registration', 'IdentityRegistration', 'auth-server');

// System context for internal operations (only used for read-only queries)
const MORE0_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const systemContext: AccessContext = { organizationId: 'public', userId: MORE0_SYSTEM_USER_ID };

// Initialize services (for read-only identity lookup, not for writes)
const userIdentitiesService = createUserIdentitiesService();
const usersService = createUsersService();

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Supported identity providers
 */
export type IdentityProvider = 'password' | 'google' | 'apple' | 'microsoft' | 'saml';

/**
 * Provider-specific credentials
 */
export interface ProviderCredentials {
   /** Password for password provider */
   password?: string;
   
   /** OAuth tokens for OAuth providers */
   oauthTokens?: {
      accessToken: string;
      refreshToken?: string;
      expiresAt?: number;
   };
   
   /** SAML assertion data for SAML providers */
   samlAssertion?: string;
}

/**
 * User profile information
 */
export interface UserProfile {
   email: string;
   name?: string;
   firstName?: string;
   lastName?: string;
   avatarUrl?: string;
}

/**
 * Organization context for registration
 */
export interface OrganizationContext {
   /** Name for new organization (if creating) */
   organizationName?: string;
   
   /** Existing organization ID (if joining) */
   organizationId?: string;
}

/**
 * Input for identity registration
 */
export interface IdentityRegistrationInput {
   /** Identity provider type */
   provider: IdentityProvider;
   
   /** Provider-specific user ID (email for password, google ID for google, etc.) */
   providerUserId: string;
   
   /** Provider-specific credentials */
   credentials?: ProviderCredentials;
   
   /** User profile information */
   profile: UserProfile;
   
   /** Organization context for account provisioning */
   organizationContext?: OrganizationContext;
   
   /** OIDC interaction UID (if in interactive flow) */
   interactionUid?: string;
   
   /** Origin URL for subdomain extraction */
   origin?: string;
}

/**
 * Result of identity registration
 */
export interface IdentityRegistrationResult {
   success: boolean;
   
   /** Created user ID */
   userId?: string;
   
   /** Created identity ID */
   identityId?: string;
   
   /** Provisioned organization ID */
   organizationId?: string;
   
   /** User's email */
   email?: string;
   
   /** User's name */
   name?: string;
   
   /** Error message if failed */
   error?: string;
   
   /** Error code for programmatic handling */
   errorCode?: RegistrationErrorCode;
}

export type RegistrationErrorCode = 
   | 'EMAIL_ALREADY_EXISTS'
   | 'IDENTITY_ALREADY_EXISTS'
   | 'INVALID_PASSWORD'
   | 'INVALID_PROVIDER'
   | 'PROVISIONING_FAILED'
   | 'DATABASE_ERROR'
   | 'VALIDATION_ERROR';

// =============================================================================
// PROVIDER VALIDATORS
// =============================================================================

/**
 * Validate provider-specific input
 */
interface ProviderValidationResult {
   valid: boolean;
   error?: string;
   errorCode?: RegistrationErrorCode;
}

function validatePasswordProvider(input: IdentityRegistrationInput): ProviderValidationResult {
   if (!input.credentials?.password) {
      return { valid: false, error: 'Password is required', errorCode: 'INVALID_PASSWORD' };
   }
   
   const password = input.credentials.password;
   
   // Minimum length
   if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters', errorCode: 'INVALID_PASSWORD' };
   }
   
   return { valid: true };
}

function validateOAuthProvider(input: IdentityRegistrationInput): ProviderValidationResult {
   if (!input.providerUserId) {
      return { valid: false, error: 'Provider user ID is required', errorCode: 'VALIDATION_ERROR' };
   }
   
   return { valid: true };
}

function validateProviderInput(input: IdentityRegistrationInput): ProviderValidationResult {
   // Common validation
   if (!input.profile.email) {
      return { valid: false, error: 'Email is required', errorCode: 'VALIDATION_ERROR' };
   }
   
   // Email format validation
   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   if (!emailRegex.test(input.profile.email)) {
      return { valid: false, error: 'Invalid email format', errorCode: 'VALIDATION_ERROR' };
   }
   
   // Provider-specific validation
   switch (input.provider) {
      case 'password':
         return validatePasswordProvider(input);
      case 'google':
      case 'apple':
      case 'microsoft':
         return validateOAuthProvider(input);
      default:
         return { valid: false, error: `Unsupported provider: ${input.provider}`, errorCode: 'INVALID_PROVIDER' };
   }
}

// =============================================================================
// MAIN REGISTRATION FUNCTION
// =============================================================================

/**
 * Register a new identity
 * 
 * This is the main entry point for all identity registration.
 * It delegates ALL database operations to api-server for atomicity:
 * 1. Input validation (local)
 * 2. Quick check for existing identity (local, for fast feedback)
 * 3. Call api-server /internal/signup to create everything in one transaction
 * 
 * @param input - Registration input
 * @returns Registration result
 */
export async function registerIdentity(input: IdentityRegistrationInput): Promise<IdentityRegistrationResult> {
   const functionName = 'registerIdentity';
   
   log.info({
      functionName,
      provider: input.provider,
      email: input.profile.email,
      hasOrganizationContext: !!input.organizationContext,
      hasInteraction: !!input.interactionUid
   }, 'auth-server:identity-registration:registerIdentity - Starting registration');
   
   try {
      // =======================================================================
      // STEP 1: Validate input (local validation for fast feedback)
      // =======================================================================
      const validationResult = validateProviderInput(input);
      if (!validationResult.valid) {
         log.warn({
            functionName,
            error: validationResult.error,
            errorCode: validationResult.errorCode
         }, 'auth-server:identity-registration:registerIdentity - Validation failed');
         
         return {
            success: false,
            error: validationResult.error,
            errorCode: validationResult.errorCode
         };
      }
      
      // =======================================================================
      // STEP 2: Quick check for existing identity (optional, for fast feedback)
      // Note: api-server will also check and return conflict if exists
      // =======================================================================
      try {
         const existingIdentity = await userIdentitiesService.getByProviderAndProviderUserId({
            context: systemContext,
            provider: input.provider,
            providerUserId: input.providerUserId
         });
         
         if (existingIdentity) {
            log.warn({
               functionName,
               provider: input.provider,
               providerUserId: input.providerUserId
            }, 'auth-server:identity-registration:registerIdentity - Identity already exists');
            
            return {
               success: false,
               error: 'An account with this identity already exists',
               errorCode: 'IDENTITY_ALREADY_EXISTS'
            };
         }
      } catch (checkError: any) {
         // If check fails, continue - api-server will validate
         log.warn({
            functionName,
            error: checkError.message
         }, 'auth-server:identity-registration:registerIdentity - Identity check failed, continuing to api-server');
      }
      
      // =======================================================================
      // STEP 3: Create user, identity, and organization membership (atomic transaction)
      // =======================================================================
      const internalSignupService = getInternalSignupService();
      const computedName = input.profile.name || 
         `${input.profile.firstName || ''} ${input.profile.lastName || ''}`.trim() || 
         undefined;
      
      // Extract OAuth tokens if present
      const oauthTokens = input.credentials?.oauthTokens;
      
      const signupResult = await internalSignupService.signup({
         email: input.profile.email,
         name: computedName,
         avatarUrl: input.profile.avatarUrl,
         provider: input.provider,
         providerUserId: input.providerUserId,
         password: input.credentials?.password,
         organizationName: input.organizationContext?.organizationName,
         organizationId: input.organizationContext?.organizationId,
         origin: input.origin,
         // OAuth tokens
         accessToken: oauthTokens?.accessToken,
         refreshToken: oauthTokens?.refreshToken,
         tokenExpiresAt: oauthTokens?.expiresAt ? new Date(oauthTokens.expiresAt) : undefined,
         // Provider profile
         providerDisplayName: input.profile.name,
         providerRawProfile: input.credentials?.oauthTokens ? {
            accessToken: oauthTokens?.accessToken,
            refreshToken: oauthTokens?.refreshToken,
            expiresAt: oauthTokens?.expiresAt,
         } : undefined,
      });
      
      if (!signupResult.success) {
         log.error({
            functionName,
            email: input.profile.email,
            error: signupResult.error,
            errorCode: signupResult.errorCode
         }, 'auth-server:identity-registration:registerIdentity - Signup failed');
         
         const errorCode: RegistrationErrorCode = 
            (signupResult.errorCode as RegistrationErrorCode) || 'DATABASE_ERROR';
         
         return {
            success: false,
            error: signupResult.error,
            errorCode
         };
      }
      
      log.info({
         functionName,
         userId: signupResult.userId,
         identityId: signupResult.userIdentityId,
         organizationId: signupResult.organizationId
      }, 'auth-server:identity-registration:registerIdentity - Registration completed successfully');
      
      return {
         success: true,
         userId: signupResult.userId,
         identityId: signupResult.userIdentityId,
         organizationId: signupResult.organizationId,
         email: input.profile.email,
         name: computedName
      };
      
   } catch (error: any) {
      log.error({
         functionName,
         error: error.message,
         stack: error.stack,
         provider: input.provider,
         email: input.profile.email
      }, 'auth-server:identity-registration:registerIdentity - Registration failed');
      
      return {
         success: false,
         error: error.message || 'Registration failed',
         errorCode: 'DATABASE_ERROR'
      };
   }
}


// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if an identity exists for the given provider and subject
 */
export async function identityExists(params: {
   provider: IdentityProvider;
   providerUserId: string;
}): Promise<boolean> {
   const identity = await userIdentitiesService.getByProviderAndProviderUserId({
      context: systemContext,
      provider: params.provider,
      providerUserId: params.providerUserId
   });
   return !!identity;
}

/**
 * Get user by identity
 */
export async function getUserByIdentity(params: {
   provider: IdentityProvider;
   providerUserId: string;
}): Promise<{ userId: string; email: string; name?: string } | null> {
   const identity = await userIdentitiesService.getByProviderAndProviderUserId({
      context: systemContext,
      provider: params.provider,
      providerUserId: params.providerUserId
   });
   
   if (!identity) return null;
   
   const user = await usersService.getUser(systemContext, identity.userId);
   if (!user) return null;
   
   return {
      userId: user.id,
      email: user.email || '',
      name: user.name || undefined
   };
}

/**
 * Get existing user by email
 */
export async function getUserByEmail(email: string): Promise<{ userId: string; email: string; name?: string } | null> {
   const user = await usersService.getByEmail(systemContext, email);
   
   if (!user) return null;
   
   return {
      userId: user.id,
      email: user.email || '',
      name: user.name || undefined
   };
}

/**
 * Add password identity to existing user
 * 
 * SCENARIO 1: User registered with OAuth, now wants to add password authentication
 * 
 * This requires the user to be authenticated via another identity (OAuth) first
 * to prove their identity before adding password auth.
 * 
 * @param params.userId - User ID (must be authenticated via another identity)
 * @param params.email - User's email (must match existing user)
 * @param params.password - Password to set
 * @returns Result indicating success or failure
 */
export async function addPasswordIdentityToUser(params: {
   userId: string;
   email: string;
   password: string;
}): Promise<{ success: boolean; identityId?: string; error?: string; errorCode?: RegistrationErrorCode }> {
   const functionName = 'addPasswordIdentityToUser';
   
   log.info({
      functionName,
      userId: params.userId,
      email: params.email
   }, 'auth-server:identity-registration:addPasswordIdentityToUser - Starting password identity addition');
   
   try {
      // =======================================================================
      // STEP 1: Validate input
      // =======================================================================
      if (!params.password) {
         return {
            success: false,
            error: 'Password is required',
            errorCode: 'INVALID_PASSWORD'
         };
      }
      
      if (params.password.length < 8) {
         return {
            success: false,
            error: 'Password must be at least 8 characters',
            errorCode: 'INVALID_PASSWORD'
         };
      }
      
      // =======================================================================
      // STEP 2: Verify user exists and email matches
      // =======================================================================
      const user = await usersService.getUser(systemContext, params.userId);
      if (!user) {
         log.warn({ functionName, userId: params.userId }, 
            'auth-server:identity-registration:addPasswordIdentityToUser - User not found');
         return {
            success: false,
            error: 'User not found',
            errorCode: 'VALIDATION_ERROR'
         };
      }
      
      if (user.email !== params.email) {
         log.warn({ functionName, userId: params.userId, email: params.email, userEmail: user.email }, 
            'auth-server:identity-registration:addPasswordIdentityToUser - Email mismatch');
         return {
            success: false,
            error: 'Email does not match user account',
            errorCode: 'VALIDATION_ERROR'
         };
      }
      
      // =======================================================================
      // STEP 3: Check if password identity already exists
      // =======================================================================
      const existingPasswordIdentity = await userIdentitiesService.getByProviderAndProviderUserId({
         context: systemContext,
         provider: 'password',
         providerUserId: params.email
      });
      
      if (existingPasswordIdentity) {
         if (existingPasswordIdentity.userId === params.userId) {
            log.warn({ functionName, userId: params.userId }, 
               'auth-server:identity-registration:addPasswordIdentityToUser - Password identity already exists for this user');
            return {
               success: false,
               error: 'Password identity already exists for this account',
               errorCode: 'IDENTITY_ALREADY_EXISTS'
            };
         } else {
            log.warn({ functionName, userId: params.userId, existingUserId: existingPasswordIdentity.userId }, 
               'auth-server:identity-registration:addPasswordIdentityToUser - Password identity exists for different user');
            return {
               success: false,
               error: 'An account with this email and password already exists',
               errorCode: 'IDENTITY_ALREADY_EXISTS'
            };
         }
      }
      
      // =======================================================================
      // STEP 4: Verify user has at least one other identity (OAuth)
      // =======================================================================
      const userIdentities = await userIdentitiesService.getIdentitiesByUserId(systemContext, params.userId);
      const hasOtherIdentity = userIdentities.some(identity => identity.provider !== 'password');
      
      if (!hasOtherIdentity) {
         log.warn({ functionName, userId: params.userId }, 
            'auth-server:identity-registration:addPasswordIdentityToUser - User has no other identities');
         return {
            success: false,
            error: 'Cannot add password identity: user must have at least one other authentication method',
            errorCode: 'VALIDATION_ERROR'
         };
      }
      
      // =======================================================================
      // STEP 5: Hash password and create identity
      // =======================================================================
      const bcrypt = await import('bcrypt');
      const BCRYPT_SALT_ROUNDS = 12;
      const passwordHash = await bcrypt.hash(params.password, BCRYPT_SALT_ROUNDS);
      
      const identityData = {
         userId: params.userId,
         provider: 'password',
         providerUserId: params.email,
         displayName: user.name || null,
         avatarUrl: null,
         rawProfile: {
            passwordHash,
            passwordSetAt: new Date().toISOString()
         },
         accessToken: null,
         refreshToken: null,
         tokenExpiresAt: null
      };
      
      log.debug({ functionName, userId: params.userId }, 
         'auth-server:identity-registration:addPasswordIdentityToUser - Creating password identity');
      
      const createdIdentity = await userIdentitiesService.createUserIdentity(systemContext, identityData);
      
      log.info({
         functionName,
         userId: params.userId,
         identityId: createdIdentity.id
      }, 'auth-server:identity-registration:addPasswordIdentityToUser - Password identity added successfully');
      
      return {
         success: true,
         identityId: createdIdentity.id
      };
      
   } catch (error: any) {
      log.error({
         functionName,
         userId: params.userId,
         email: params.email,
         error: error.message,
         stack: error.stack
      }, 'auth-server:identity-registration:addPasswordIdentityToUser - Failed to add password identity');
      
      return {
         success: false,
         error: error.message || 'Failed to add password identity',
         errorCode: 'DATABASE_ERROR'
      };
   }
}

