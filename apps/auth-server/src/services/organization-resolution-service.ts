import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import {
  createUserIdentitiesService,
  createUsersService,
  createOrganizationUsersService,
  createOrganizationsService,
} from '../db/services/index.js';
import bcrypt from 'bcrypt';

const baseLogger = createLogger('auth-server:organization-resolution', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'organization-resolution', 'OrganizationResolution', 'auth-server');

const MORE0_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const systemContext = { organizationId: 'public', userId: MORE0_SYSTEM_USER_ID };

const userIdentitiesService = createUserIdentitiesService();
const usersService = createUsersService();
const organizationUsersService = createOrganizationUsersService();
const organizationsService = createOrganizationsService();

// ============================================================================
// Types
// ============================================================================

export interface OrganizationInfo {
  id: string;
  name: string;
}

export interface OrganizationResolutionInput {
  provider: string;
  providerSubject: string;
}

export interface ResolveWithOrganizationInput {
  userId: string;
  organizationId: string;
}

export interface OrganizationResolutionResult {
  success: boolean;
  userId?: string;
  organizationId?: string;
  error?: string;
  errorCode?: 'USER_NOT_FOUND' | 'NO_ORGANIZATIONS' | 'MULTIPLE_ORGANIZATIONS';
  organizations?: OrganizationInfo[];
  registrationUrl?: string;
}

export interface PasswordVerificationResult {
  success: boolean;
  userId?: string;
  email?: string;
  name?: string;
  error?: string;
  errorCode?: 'USER_NOT_FOUND' | 'INVALID_PASSWORD' | 'NO_PASSWORD_SET' | 'ACCOUNT_DISABLED';
}

export interface AuthResultWithOrganization {
  user: {
    userId: string;
    email: string;
    name: string;
    avatarURL?: string;
    provider?: string;
  };
  organizationId: string;
}

export interface AuthResultWithOrganizationParams {
  userId: string;
  email: string;
  name: string;
  avatarURL?: string;
  provider?: string;
  organizationId: string;
}

// ============================================================================
// Functions
// ============================================================================

export async function verifyPasswordCredentials(params: {
  email: string;
  password: string;
}): Promise<PasswordVerificationResult> {
  const { email, password } = params;
  log.debug({ email }, 'auth-server:organization-resolution:verifyPasswordCredentials - Verifying password credentials');

  const identity = await userIdentitiesService.getWithCredentials({
    context: systemContext,
    provider: 'password',
    providerUserId: email,
  });

  if (!identity) {
    log.warn({ email }, 'auth-server:organization-resolution:verifyPasswordCredentials - Password identity not found');
    return { success: false, error: 'Invalid email or password', errorCode: 'USER_NOT_FOUND' };
  }

  const user = await usersService.getUser(systemContext, identity.userId);
  if (!user) {
    log.warn({ email, userId: identity.userId }, 'auth-server:organization-resolution:verifyPasswordCredentials - User not found for identity');
    return { success: false, error: 'Invalid email or password', errorCode: 'USER_NOT_FOUND' };
  }

  if (user.isActive === false) {
    log.warn({ email, userId: user.id }, 'auth-server:organization-resolution:verifyPasswordCredentials - Account is disabled');
    return { success: false, error: 'Account is disabled. Please contact support.', errorCode: 'ACCOUNT_DISABLED' };
  }

  const passwordHash = (identity.rawProfile as any)?.passwordHash;
  if (!passwordHash) {
    log.warn({ email, userId: user.id, identityId: identity.id }, 'auth-server:organization-resolution:verifyPasswordCredentials - No password set in identity');
    return { success: false, error: 'No password set. Please use another login method or reset your password.', errorCode: 'NO_PASSWORD_SET' };
  }

  const isValidPassword = await bcrypt.compare(password, passwordHash);
  if (!isValidPassword) {
    log.warn({ email, userId: user.id }, 'auth-server:organization-resolution:verifyPasswordCredentials - Invalid password');
    return { success: false, error: 'Invalid email or password', errorCode: 'INVALID_PASSWORD' };
  }

  log.info({ email, userId: user.id }, 'auth-server:organization-resolution:verifyPasswordCredentials - Password verified successfully');
  return { success: true, userId: user.id, email: user.email, name: user.name };
}

export async function resolveUserIdentity(params: {
  provider: string;
  providerSubject: string;
}): Promise<{ userId: string } | null> {
  const { provider, providerSubject } = params;
  log.debug({ provider, providerSubject }, 'auth-server:organization-resolution:resolveUserIdentity - Looking up user identity');

  const identity = await userIdentitiesService.getByProviderAndProviderUserId({
    context: systemContext,
    provider,
    providerUserId: providerSubject,
  });

  if (identity) {
    log.info(
      { provider, providerSubject, userId: identity.userId },
      `auth-server:organization-resolution:resolveUserIdentity - User identity found: provider=${provider}, providerSubject=${providerSubject}, userId=${identity.userId}`
    );
    return { userId: identity.userId };
  }

  log.warn({ provider, providerSubject }, 'auth-server:organization-resolution:resolveUserIdentity - User identity not found');
  return null;
}

export async function getOrganizationsForUser(userId: string): Promise<OrganizationInfo[]> {
  log.debug({ userId }, 'auth-server:organization-resolution:getOrganizationsForUser - Fetching organizations for user');

  const orgUsers = await organizationUsersService.getOrganizationsByUserId(systemContext, userId);
  if (orgUsers.length === 0) {
    log.warn({ userId }, 'auth-server:organization-resolution:getOrganizationsForUser - No organizations found for user');
    return [];
  }

  const result: OrganizationInfo[] = [];
  for (const ou of orgUsers) {
    const org = await organizationsService.getOrganization(systemContext, ou.organizationId);
    if (org) result.push({ id: org.id, name: org.name });
  }

  log.info(
    { userId, organizationCount: result.length },
    `auth-server:organization-resolution:getOrganizationsForUser - Organizations fetched: userId=${userId}, organizationCount=${result.length}`
  );
  return result;
}

export async function getOrganizationById(organizationId: string): Promise<{ id: string; name: string } | null> {
  log.debug({ organizationId }, 'auth-server:organization-resolution:getOrganizationById - Looking up organization');

  const org = await organizationsService.getOrganization(systemContext, organizationId);
  if (org) {
    log.info({ organizationId, organizationName: org.name }, 'auth-server:organization-resolution:getOrganizationById - Organization found');
    return { id: org.id, name: org.name };
  }

  log.warn({ organizationId }, 'auth-server:organization-resolution:getOrganizationById - Organization not found');
  return null;
}

export async function resolveOrganization(input: OrganizationResolutionInput): Promise<OrganizationResolutionResult> {
  const { provider, providerSubject } = input;
  log.info(
    { provider, providerSubject },
    `auth-server:organization-resolution:resolveOrganization - Starting organization resolution: provider=${provider}, providerSubject=${providerSubject}`
  );

  const userIdentity = await resolveUserIdentity({ provider, providerSubject });
  if (!userIdentity) {
    log.warn({ provider, providerSubject }, 'auth-server:organization-resolution:resolveOrganization - User not found');
    return {
      success: false,
      error: 'No account found for this identity. Please register first.',
      errorCode: 'USER_NOT_FOUND',
      registrationUrl: '/register',
    };
  }

  const { userId } = userIdentity;
  const organizations = await getOrganizationsForUser(userId);

  if (organizations.length === 0) {
    log.warn({ userId }, 'auth-server:organization-resolution:resolveOrganization - User has no organization associations');
    return {
      success: false,
      userId,
      error: 'Your account is not associated with any organization. Please contact your administrator or register a new organization.',
      errorCode: 'NO_ORGANIZATIONS',
      registrationUrl: '/register',
      organizations,
    };
  }

  if (organizations.length > 1) {
    log.info({ userId, organizationCount: organizations.length }, 'auth-server:organization-resolution:resolveOrganization - Multiple organizations found, selection required');
    return {
      success: false,
      userId,
      errorCode: 'MULTIPLE_ORGANIZATIONS',
      organizations,
    };
  }

  const organizationId = organizations[0].id;
  return resolveWithOrganization({ userId, organizationId });
}

export async function resolveWithOrganization(input: ResolveWithOrganizationInput): Promise<OrganizationResolutionResult> {
  const { userId, organizationId } = input;
  log.info(
    { userId, organizationId },
    `auth-server:organization-resolution:resolveWithOrganization - Resolving with selected organization: userId=${userId}, organizationId=${organizationId}`
  );

  return {
    success: true,
    userId,
    organizationId,
  };
}

export function createAuthResult(params: AuthResultWithOrganizationParams): AuthResultWithOrganization {
  if (!params.organizationId) throw new Error('organizationId required');
  return {
    user: {
      userId: params.userId,
      email: params.email,
      name: params.name,
      avatarURL: params.avatarURL,
      provider: params.provider,
    },
    organizationId: params.organizationId,
  };
}

