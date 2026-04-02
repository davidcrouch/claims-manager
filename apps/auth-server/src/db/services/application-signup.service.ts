/**
 * Local application signup service – organization naming (business → organization).
 * Creates user, identity, organization, and organization_user records.
 */

import { createLogger, LoggerType } from '../../lib/logger.js';
import type { AccessContext } from '../../schemas/index.js';
import { getDb, type DbGetter, type Db } from '../client.js';
import { createApplicationsRepository } from '../repositories/applications-repository.js';
import { createUsersRepository } from '../repositories/users-repository.js';
import { createUserIdentitiesRepository } from '../repositories/user-identities-repository.js';
import { createOrganizationsRepository } from '../repositories/organizations-repository.js';
import { createOrganizationUsersRepository } from '../repositories/organization-users-repository.js';
import type { NewUser } from '../../schemas/index.js';

const log = createLogger('auth-server:db:application-signup-service', LoggerType.NODEJS);

type ProviderProfile = {
  displayName?: string;
  avatarUrl?: string;
  rawProfile?: Record<string, unknown>;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | string;
};

export interface ApplicationSignupInput {
  email: string;
  name?: string;
  avatarUrl?: string;
  passwordHash?: string;
  organizationName?: string;
  organizationId?: string;
  applicationId: string;
  provider?: string;
  providerUserId?: string;
  providerProfile?: ProviderProfile;
  initiatedByEmail?: string;
}

export type ApplicationSignupScenario =
  | 'new_user_new_organization'
  | 'existing_user_new_organization'
  | 'existing_user_existing_organization';

export interface ApplicationSignupResult {
  userId: string;
  organizationId: string;
  organizationUserId: string;
  scenario: ApplicationSignupScenario;
  userIdentityId?: string;
}

export class ApplicationSignupService {
  /**
   * Orchestrate user signup: user, identity, organization, organization_user.
   * Uses organization naming throughout.
   */
  async signup(context: AccessContext, input: ApplicationSignupInput): Promise<ApplicationSignupResult> {
    if (!input.email) {
      log.error({ input }, 'auth-server:db:application-signup-service:signup - Email is required');
      throw new Error('Email is required for signup');
    }

    const db = getDb();
    return db.transaction(async (tx) => {
      const txDb: DbGetter = () => tx as unknown as Db;
      const applicationsRepo = createApplicationsRepository(txDb, undefined);
      const app = await applicationsRepo.get({ organizationId: 'public', userId: '00000000-0000-0000-0000-000000000000' }, input.applicationId);
      if (!app) {
        log.error({ applicationId: input.applicationId }, 'auth-server:db:application-signup-service:signup - Application not found');
        throw new Error('Application not found');
      }
      const systemUserId = app.systemUserId ?? '00000000-0000-0000-0000-000000000000';
      const systemContext: AccessContext = { organizationId: 'public', userId: systemUserId };

      const usersRepo = createUsersRepository(txDb, undefined);
      const userIdentitiesRepo = createUserIdentitiesRepository(txDb, undefined);

      let userId: string | null = null;
      let userIdentityId: string | null = null;

      if (input.provider && input.providerUserId) {
        const identity = await userIdentitiesRepo.getByProviderAndProviderUserId(
          systemContext,
          input.provider,
          input.providerUserId
        );
        if (identity) {
          userId = identity.userId;
          userIdentityId = identity.id;
        }
      }

      if (!userId) {
        const existingUser = await usersRepo.getByEmail(systemContext, input.email);
        if (existingUser) {
          userId = existingUser.id;
        }
      }

      if (!userId) {
        const createUserData: NewUser = {
          name: input.name ?? input.email,
          email: input.email,
          status: 'Active',
          object: 'user',
          config: { initiatedByEmail: input.initiatedByEmail ?? input.email },
        };
        const createdUser = await usersRepo.create(systemContext, createUserData);
        userId = createdUser.id;
        log.info({ userId, email: input.email }, 'auth-server:db:application-signup-service:signup - User created');

        if (input.provider && input.providerUserId) {
          const rawProfile: Record<string, unknown> = { ...(input.providerProfile?.rawProfile ?? {}) };
          if (input.provider === 'password' && input.passwordHash) {
            rawProfile.passwordHash = input.passwordHash;
            rawProfile.passwordSetAt = new Date().toISOString();
          }
          const identityData = {
            userId,
            provider: input.provider,
            providerUserId: input.providerUserId,
            displayName: input.providerProfile?.displayName ?? null,
            avatarUrl: input.providerProfile?.avatarUrl ?? null,
            rawProfile,
            accessToken: input.providerProfile?.accessToken ?? null,
            refreshToken: input.providerProfile?.refreshToken ?? null,
            tokenExpiresAt: input.providerProfile?.tokenExpiresAt ?? null,
          };
          const createdIdentity = await userIdentitiesRepo.create(systemContext, identityData);
          userIdentityId = createdIdentity.id;
        }
      } else if (input.provider && input.providerUserId) {
        const existingIdentity = await userIdentitiesRepo.getByProviderAndProviderUserId(
          systemContext,
          input.provider,
          input.providerUserId
        );
        if (!existingIdentity) {
          const isOAuth = ['google', 'apple', 'microsoft', 'saml'].includes(input.provider);
          if (isOAuth) {
            const identityData = {
              userId,
              provider: input.provider,
              providerUserId: input.providerUserId,
              displayName: input.providerProfile?.displayName ?? null,
              avatarUrl: input.providerProfile?.avatarUrl ?? null,
              rawProfile: input.providerProfile?.rawProfile ?? {},
              accessToken: input.providerProfile?.accessToken ?? null,
              refreshToken: input.providerProfile?.refreshToken ?? null,
              tokenExpiresAt: input.providerProfile?.tokenExpiresAt ?? null,
            };
            const created = await userIdentitiesRepo.create(systemContext, identityData);
            userIdentityId = created.id;
          }
        } else {
          userIdentityId = existingIdentity.id;
        }
      }

      const organizationsRepo = createOrganizationsRepository(txDb, undefined);
      const organizationUsersRepo = createOrganizationUsersRepository(txDb, undefined);
      let organizationId: string;
      let scenario: ApplicationSignupScenario;

      if (input.organizationId) {
        const existing = await organizationsRepo.get(systemContext, input.organizationId);
        if (!existing) throw new Error('Organization not found');
        organizationId = existing.id;
        const userExists = await this.existsUser(txDb, userId!);
        scenario = userIdentityId || userExists ? 'existing_user_existing_organization' : 'new_user_new_organization';
      } else {
        const orgCode = this.generateOrgCode(input.organizationName ?? input.email);
        const created = await organizationsRepo.create(systemContext, {
          name: input.organizationName ?? `${input.name ?? input.email}'s Organization`,
          description: '',
          orgCode,
          config: { url: null },
        });
        organizationId = created.id;
        const userExists = await this.existsUser(txDb, userId!);
        scenario = userExists ? 'existing_user_new_organization' : 'new_user_new_organization';
      }

      let organizationUserId: string;
      const existingOU = await organizationUsersRepo.getByUserIdAndOrganizationId(systemContext, userId!, organizationId);
      if (existingOU) {
        organizationUserId = existingOU.id;
      } else {
        const now = new Date().toISOString();
        const createdOU = await organizationUsersRepo.create(systemContext, {
          userId: userId!,
          organizationId,
          role: 'member',
          status: 'Active',
          object: 'organization_user',
          created: now,
          modified: now,
          createdBy: systemUserId,
          modifiedBy: systemUserId,
        });
        organizationUserId = createdOU.id;
      }

      return {
        userId: userId!,
        organizationId,
        organizationUserId,
        scenario,
        userIdentityId: userIdentityId ?? undefined,
      };
    });
  }

  private async existsUser(txDb: DbGetter, userId: string): Promise<boolean> {
    const userIdentitiesRepo = createUserIdentitiesRepository(txDb, undefined);
    const usersRepo = createUsersRepository(txDb, undefined);
    const sysCtx: AccessContext = { organizationId: 'public', userId: '00000000-0000-0000-0000-000000000000' };
    const hasIdentities = await userIdentitiesRepo.hasIdentities(sysCtx, userId);
    if (hasIdentities) return true;
    const user = await usersRepo.get(sysCtx, userId);
    return !!user;
  }

  private generateOrgCode(seed: string): string {
    const base = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`.slice(0, 32);
  }
}

let _instance: ApplicationSignupService | null = null;

export function createApplicationSignupService(): ApplicationSignupService {
  if (!_instance) _instance = new ApplicationSignupService();
  return _instance;
}
