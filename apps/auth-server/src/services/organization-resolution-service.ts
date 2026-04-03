import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import {
  createUserIdentitiesService,
  createUsersService,
  createOrganizationUsersService,
  createOrganizationsService,
  createApplicationsService,
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
const applicationsService = createApplicationsService();

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
  origin?: string;
  appKey?: string;
}

export interface ResolveWithOrganizationInput {
  userId: string;
  organizationId: string;
  origin?: string;
  appKey?: string;
}

export interface OrganizationResolutionResult {
  success: boolean;
  userId?: string;
  organizationId?: string;
  applicationId?: string;
  error?: string;
  errorCode?: 'USER_NOT_FOUND' | 'NO_ORGANIZATIONS' | 'MULTIPLE_ORGANIZATIONS' | 'APPLICATION_NOT_FOUND';
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
  applicationId: string;
}

export interface AuthResultWithOrganizationParams {
  userId: string;
  email: string;
  name: string;
  avatarURL?: string;
  provider?: string;
  organizationId: string;
  applicationId: string;
}

// Legacy aliases
export type TenantResolutionInput = OrganizationResolutionInput;
export type TenantResolutionResult = OrganizationResolutionResult;
export type AuthResultWithTenant = AuthResultWithOrganization;
export type AuthResultWithTenantParams = AuthResultWithOrganizationParams;

// ============================================================================
// Functions
// ============================================================================

export function extractSubdomainFromOrigin(origin: string | undefined): string | null {
  if (!origin) {
    log.warn({}, 'auth-server:organization-resolution:extractSubdomainFromOrigin - No origin provided');
    return null;
  }
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    const parts = hostname.split('.');

    if (parts.length >= 3 && !hostname.includes('localhost')) {
      const subdomain = parts[0];
      log.debug({ origin, subdomain }, 'auth-server:organization-resolution:extractSubdomainFromOrigin - Subdomain extracted');
      return subdomain;
    }

    if (hostname.includes('localhost') || hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
      log.debug({ origin }, 'auth-server:organization-resolution:extractSubdomainFromOrigin - Localhost detected, no subdomain');
      return null;
    }

    log.debug({ origin, hostname, parts }, 'auth-server:organization-resolution:extractSubdomainFromOrigin - No subdomain found');
    return null;
  } catch (error) {
    log.error(
      { origin, error: error instanceof Error ? error.message : error },
      'auth-server:organization-resolution:extractSubdomainFromOrigin - Failed to parse origin'
    );
    return null;
  }
}

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

  if (user.isDisabled) {
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

export async function getApplicationById(applicationId: string): Promise<{ id: string; name: string } | null> {
  log.debug({ applicationId }, 'auth-server:organization-resolution:getApplicationById - Looking up application');

  const application = await applicationsService.getApplication(systemContext, applicationId);
  if (application) {
    log.info({ applicationId, applicationName: application.name }, 'auth-server:organization-resolution:getApplicationById - Application found');
    return { id: application.id, name: application.name! };
  }

  log.warn({ applicationId }, 'auth-server:organization-resolution:getApplicationById - Application not found');
  return null;
}

export async function getApplicationBySubdomain(subdomain: string): Promise<{ id: string; name: string } | null> {
  log.debug({ subdomain }, 'auth-server:organization-resolution:getApplicationBySubdomain - Looking up application');

  const application = await applicationsService.getApplicationBySubdomain(systemContext, subdomain);
  if (application) {
    log.info({ subdomain, applicationId: application.id, applicationName: application.name }, 'auth-server:organization-resolution:getApplicationBySubdomain - Application found');
    return { id: application.id, name: application.name! };
  }

  log.warn({ subdomain }, `auth-server:organization-resolution:getApplicationBySubdomain - Application not found: subdomain=${subdomain}`);
  return null;
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
  const { provider, providerSubject, origin, appKey } = input;
  log.info(
    { provider, providerSubject, origin, appKey },
    `auth-server:organization-resolution:resolveOrganization - Starting organization resolution: provider=${provider}, providerSubject=${providerSubject}, origin=${origin ?? '(none)'}, appKey=${appKey ?? '(none)'}`
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
  return resolveWithOrganization({ userId, organizationId, origin, appKey });
}

export async function resolveWithOrganization(input: ResolveWithOrganizationInput): Promise<OrganizationResolutionResult> {
  const { userId, organizationId, origin, appKey } = input;
  log.info(
    { userId, organizationId, origin, appKey },
    `auth-server:organization-resolution:resolveWithOrganization - Resolving with selected organization: userId=${userId}, organizationId=${organizationId}, origin=${origin ?? '(none)'}, appKey=${appKey ?? '(none)'}`
  );

  const subdomain = appKey || extractSubdomainFromOrigin(origin);
  log.info(
    { appKey: appKey ?? null, origin, subdomain: subdomain ?? null },
    `auth-server:organization-resolution:resolveWithOrganization - Application lookup: appKey=${appKey ?? '(none)'}, origin=${origin || '(none)'}, subdomain=${subdomain ?? '(none)'}`
  );

  if (!subdomain) {
    return {
      success: false,
      userId,
      organizationId,
      error: 'Unable to determine application from URL. Please ensure you are accessing the correct URL.',
      errorCode: 'APPLICATION_NOT_FOUND',
    };
  }

  const application = await getApplicationBySubdomain(subdomain);
  if (!application) {
    return {
      success: false,
      userId,
      organizationId,
      error: `Application not found for subdomain "${subdomain}". Please check the URL or contact your administrator.`,
      errorCode: 'APPLICATION_NOT_FOUND',
    };
  }

  log.info({ userId, organizationId, applicationId: application.id }, 'auth-server:organization-resolution:resolveWithOrganization - Organization resolution successful');
  return {
    success: true,
    userId,
    organizationId,
    applicationId: application.id,
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
    applicationId: params.applicationId,
  };
}

export const resolveTenant = resolveOrganization;
