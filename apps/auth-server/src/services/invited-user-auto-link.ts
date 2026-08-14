import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { createUsersService, createUserIdentitiesService } from '../db/services/index.js';
import { invalidateInviteTokensForEmail } from './invitation-service.js';
import type { AccessContext } from '../schemas/index.js';

const baseLogger = createLogger('auth-server:auto-link', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'auto-link', 'AutoLink', 'auth-server');

const MORE0_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const systemContext: AccessContext = { organizationId: 'public', userId: MORE0_SYSTEM_USER_ID };

const usersService = createUsersService();
const userIdentitiesService = createUserIdentitiesService();

export interface AutoLinkInput {
  email: string;
  emailVerified: boolean;
  provider: 'microsoft' | 'google';
  providerUserId: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface AutoLinkResult {
  linked: boolean;
  userId?: string;
  reason?: string;
}

export async function tryAutoLinkInvitedUser(input: AutoLinkInput): Promise<AutoLinkResult> {
  const { email, emailVerified, provider, providerUserId, displayName, avatarUrl } = input;

  log.info(
    { email, provider, emailVerified },
    'auth-server:auto-link:tryAutoLinkInvitedUser - Checking auto-link eligibility',
  );

  if (!emailVerified) {
    log.info(
      { email, provider },
      'auth-server:auto-link:tryAutoLinkInvitedUser - Email not verified, skipping',
    );
    return { linked: false, reason: 'email_not_verified' };
  }

  const user = await usersService.getByEmail(systemContext, email);

  if (!user) {
    log.debug(
      { email },
      'auth-server:auto-link:tryAutoLinkInvitedUser - No user found for email',
    );
    return { linked: false, reason: 'no_user_found' };
  }

  if (user.status !== 'Invited') {
    log.debug(
      { email, status: user.status },
      'auth-server:auto-link:tryAutoLinkInvitedUser - User not in Invited status',
    );
    return { linked: false, reason: 'not_invited_status' };
  }

  await userIdentitiesService.createUserIdentity(systemContext, {
    userId: user.id,
    provider,
    providerUserId,
    displayName: displayName || null,
    avatarUrl: avatarUrl || null,
    rawProfile: { provider, providerUserId, displayName, avatarUrl },
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
  });

  const { createUsersRepository } = await import('../db/repositories/users-repository.js');
  const { createOrganizationUsersRepository } = await import('../db/repositories/organization-users-repository.js');
  const { createOrganizationUsersService } = await import('../db/services/index.js');
  const { getDb } = await import('../db/client.js');
  const usersRepo = createUsersRepository(() => getDb(), undefined);
  await usersRepo.update(systemContext, user.id, { status: 'Active' } as any);

  // Activate every Invited org membership so social login finishes the invite join.
  try {
    const orgUsersService = createOrganizationUsersService();
    const memberships = await orgUsersService.getOrganizationsByUserId(systemContext, user.id);
    const orgUsersRepo = createOrganizationUsersRepository(() => getDb(), undefined);
    for (const membership of memberships) {
      if (membership.status === 'Invited') {
        await orgUsersRepo.updateStatus(
          systemContext,
          user.id,
          membership.organizationId,
          'Active',
        );
      }
    }
  } catch (err: any) {
    log.warn(
      { email, userId: user.id, error: err?.message },
      'auth-server:auto-link:tryAutoLinkInvitedUser - Failed to activate org memberships',
    );
  }

  try {
    await invalidateInviteTokensForEmail(email);
  } catch (err: any) {
    log.warn(
      { email, userId: user.id, error: err?.message },
      'auth-server:auto-link:tryAutoLinkInvitedUser - Failed to invalidate invite tokens (user still activated)',
    );
  }

  log.info(
    { email, userId: user.id, provider },
    'auth-server:auto-link:tryAutoLinkInvitedUser - Auto-linked and activated user',
  );

  return { linked: true, userId: user.id };
}
