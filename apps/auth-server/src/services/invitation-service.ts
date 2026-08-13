import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { GlobalCacheManager } from '../lib/cache/global-cache-manager.js';
import { getBaseUrl } from '../config/env-validation.js';
import { getDb } from '../db/client.js';
import {
  createUsersService,
  createUserIdentitiesService,
  createOrganizationUsersService,
  createOrganizationsService,
} from '../db/services/index.js';
import { assignUserRoles } from '../db/services/user-role-assignments.js';
import { sendInviteEmail } from './email/index.js';
import type { AccessContext } from '../schemas/index.js';

const baseLogger = createLogger('auth-server:invitation', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'invitation', 'InvitationService', 'auth-server');

const MORE0_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const systemContext: AccessContext = { organizationId: 'public', userId: MORE0_SYSTEM_USER_ID };

const INVITE_TOKEN_PREFIX = 'auth:invite:';
const INVITE_TOKEN_TTL_SECONDS = 72 * 60 * 60; // 72 hours

const usersService = createUsersService();
const userIdentitiesService = createUserIdentitiesService();
const orgUsersService = createOrganizationUsersService();
const orgsService = createOrganizationsService();

interface InviteTokenData {
  email: string;
  userId: string;
  organizationId: string;
  roles: string[];
  invitedByUserId: string;
  createdAt: number;
}

export interface InviteUserParams {
  email: string;
  givenName?: string;
  familyName?: string;
  roles: string[];
  organizationId: string;
  invitedByUserId: string;
}

export interface InviteUserResult {
  userId: string;
  email: string;
  givenName: string | null;
  familyName: string | null;
  roles: string[];
  inviteUrl: string;
  status: string;
}

async function activateUserAndMembership(userId: string, organizationId: string): Promise<void> {
  const { createUsersRepository } = await import('../db/repositories/users-repository.js');
  const { createOrganizationUsersRepository } = await import('../db/repositories/organization-users-repository.js');
  const usersRepo = createUsersRepository(() => getDb(), undefined);
  const orgUsersRepo = createOrganizationUsersRepository(() => getDb(), undefined);
  await usersRepo.update(systemContext, userId, { status: 'Active' } as any);
  await orgUsersRepo.updateStatus(systemContext, userId, organizationId, 'Active');
}

export async function inviteUser(params: InviteUserParams): Promise<InviteUserResult> {
  const { email: rawEmail, givenName, familyName, roles, organizationId, invitedByUserId } = params;
  const email = rawEmail.trim().toLowerCase();

  log.info(
    { email, organizationId, roles },
    'auth-server:invitation:inviteUser - Processing invitation',
  );

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('auth-server:invitation:inviteUser - Invalid email address');
  }
  if (!organizationId) {
    throw new Error('auth-server:invitation:inviteUser - organizationId is required');
  }
  if (!roles || roles.length === 0) {
    throw new Error('auth-server:invitation:inviteUser - At least one role is required');
  }

  const redis = await GlobalCacheManager.getInstance('auth-server');
  const inviterContext: AccessContext = { organizationId, userId: invitedByUserId };
  const name = [givenName, familyName].filter(Boolean).join(' ') || undefined;

  let user = await usersService.getByEmail(systemContext, email);
  let userId: string;

  if (user) {
    if (user.status !== 'Invited' && user.status !== 'Active') {
      throw new Error(
        `auth-server:invitation:inviteUser - User ${email} has status ${user.status} and cannot be invited`,
      );
    }
    userId = user.id;
    log.info(
      { email, userId, status: user.status },
      'auth-server:invitation:inviteUser - Existing user found',
    );
  } else {
    user = await usersService.createUser(inviterContext, {
      name: name || '',
      email,
      status: 'Invited',
    } as any);
    userId = user.id;
    log.info(
      { email, userId },
      'auth-server:invitation:inviteUser - Created new user with Invited status',
    );
  }

  const existingMembership = await orgUsersService.getByUserIdAndOrganizationId({
    context: inviterContext,
    userId,
    organizationId,
  });

  if (!existingMembership) {
    const { createOrganizationUsersRepository } = await import('../db/repositories/organization-users-repository.js');
    const orgUsersRepo = createOrganizationUsersRepository(() => getDb(), undefined);
    const now = new Date().toISOString();
    await orgUsersRepo.create(inviterContext, {
      userId,
      organizationId,
      role: roles[0] || 'member',
      status: 'Invited',
      object: 'organization_user',
      created: now,
      modified: now,
      createdBy: invitedByUserId,
      modifiedBy: invitedByUserId,
    });

    log.info(
      { userId, organizationId },
      'auth-server:invitation:inviteUser - Created org membership',
    );
  }

  const db = getDb();
  await assignUserRoles(db, userId, organizationId, roles);

  await invalidateInviteTokensForEmail(email);

  const token = randomBytes(32).toString('hex');
  const tokenData: InviteTokenData = {
    email,
    userId,
    organizationId,
    roles,
    invitedByUserId,
    createdAt: Date.now(),
  };
  await redis.set(`${INVITE_TOKEN_PREFIX}${token}`, JSON.stringify(tokenData), {
    ex: INVITE_TOKEN_TTL_SECONDS,
  });

  const inviteUrl = `${getBaseUrl()}/accept-invite?token=${token}`;

  const org = await orgsService.getOrganization(systemContext, organizationId);
  const orgName = org?.name || 'your organization';

  try {
    await sendInviteEmail({
      to: email,
      inviteUrl,
      organizationName: orgName,
      givenName,
    });
  } catch (emailError: any) {
    log.error(
      { email, error: emailError.message },
      'auth-server:invitation:inviteUser - Failed to send invite email (invite still valid)',
    );
  }

  log.info(
    { email, userId, inviteUrl },
    'auth-server:invitation:inviteUser - Invitation created successfully',
  );

  return {
    userId,
    email,
    givenName: givenName || null,
    familyName: familyName || null,
    roles,
    inviteUrl,
    status: 'Invited',
  };
}

export async function acceptInvite(params: {
  token: string;
  password: string;
}): Promise<{ success: boolean; error?: string; email?: string }> {
  const { token, password } = params;

  log.info({}, 'auth-server:invitation:acceptInvite - Processing invite acceptance');

  const redis = await GlobalCacheManager.getInstance('auth-server');
  const raw = await redis.get<string>(`${INVITE_TOKEN_PREFIX}${token}`);

  if (!raw) {
    log.warn({}, 'auth-server:invitation:acceptInvite - Invalid or expired token');
    return {
      success: false,
      error: 'Invalid or expired invitation. Please ask your admin to send a new invite.',
    };
  }

  const tokenData: InviteTokenData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const { email, userId, organizationId } = tokenData;

  if (!password || password.length < 12) {
    return { success: false, error: 'Password must be at least 12 characters.', email };
  }

  const user = await usersService.getUser(systemContext, userId);
  if (!user) {
    return { success: false, error: 'Account not found. The invitation may be stale.', email };
  }

  const existingIdentity = await userIdentitiesService.getByProviderAndProviderUserId({
    context: systemContext,
    provider: 'password',
    providerUserId: email,
  });

  if (!existingIdentity) {
    const passwordHash = await bcrypt.hash(password, 12);
    await userIdentitiesService.createUserIdentity(systemContext, {
      userId,
      provider: 'password',
      providerUserId: email,
      displayName: null,
      avatarUrl: null,
      rawProfile: {
        passwordHash,
        passwordSetAt: new Date().toISOString(),
      },
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    });
  } else if (existingIdentity.userId !== userId) {
    log.warn(
      { email, userId, existingUserId: existingIdentity.userId },
      'auth-server:invitation:acceptInvite - Password identity belongs to another user',
    );
    return { success: false, error: 'An account with this email already exists.', email };
  }

  await activateUserAndMembership(userId, organizationId);
  await redis.del(`${INVITE_TOKEN_PREFIX}${token}`);

  log.info(
    { email, userId },
    'auth-server:invitation:acceptInvite - Invite accepted, user activated',
  );

  return { success: true, email };
}

export async function acceptInviteWithoutPassword(
  token: string,
): Promise<{ success: boolean; email?: string; error?: string }> {
  log.info({}, 'auth-server:invitation:acceptInviteWithoutPassword - Processing passwordless acceptance');

  const redis = await GlobalCacheManager.getInstance('auth-server');
  const raw = await redis.get<string>(`${INVITE_TOKEN_PREFIX}${token}`);

  if (!raw) {
    log.warn({}, 'auth-server:invitation:acceptInviteWithoutPassword - Invalid or expired token');
    return {
      success: false,
      error: 'Invalid or expired invitation. Please ask your admin to send a new invite.',
    };
  }

  const tokenData: InviteTokenData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const { email, userId, organizationId } = tokenData;

  await activateUserAndMembership(userId, organizationId);
  await redis.del(`${INVITE_TOKEN_PREFIX}${token}`);

  log.info(
    { email, userId },
    'auth-server:invitation:acceptInviteWithoutPassword - User activated without password',
  );

  return { success: true, email };
}

export async function getInviteTokenPreview(
  token: string,
): Promise<{ valid: boolean; email?: string; userId?: string; error?: string }> {
  log.debug({}, 'auth-server:invitation:getInviteTokenPreview - Peeking at token');

  const redis = await GlobalCacheManager.getInstance('auth-server');
  const raw = await redis.get<string>(`${INVITE_TOKEN_PREFIX}${token}`);

  if (!raw) {
    return {
      valid: false,
      error: 'Invalid or expired invitation. Please ask your admin to send a new invite.',
    };
  }

  const tokenData: InviteTokenData = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return { valid: true, email: tokenData.email, userId: tokenData.userId };
}

export async function invalidateInviteTokensForEmail(email: string): Promise<number> {
  const normalizedEmail = email.trim().toLowerCase();
  log.info(
    { email: normalizedEmail },
    'auth-server:invitation:invalidateInviteTokensForEmail - Scanning for tokens',
  );

  try {
    const redis = await GlobalCacheManager.getInstance('auth-server');
    const keys = await redis.keys(`${INVITE_TOKEN_PREFIX}*`);
    let deleted = 0;

    for (const key of keys) {
      try {
        const raw = await redis.get<string>(key);
        if (!raw) continue;
        const data: InviteTokenData = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (data.email === normalizedEmail) {
          await redis.del(key);
          deleted++;
        }
      } catch {
        // Skip malformed entries
      }
    }

    log.info(
      { email: normalizedEmail, deleted },
      'auth-server:invitation:invalidateInviteTokensForEmail - Cleanup complete',
    );

    return deleted;
  } catch (err: any) {
    log.warn(
      { email: normalizedEmail, error: err.message },
      'auth-server:invitation:invalidateInviteTokensForEmail - Failed (non-fatal)',
    );
    return 0;
  }
}
