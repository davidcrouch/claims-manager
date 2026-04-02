/**
 * Local user identities service – wraps user-identities repository. Replaces @morezero/database/users.
 */

import type { AccessContext } from '../../schemas/index.js';
import { getDb } from '../client.js';
import { createUserIdentitiesRepository } from '../repositories/user-identities-repository.js';
import type { UserIdentity, NewUserIdentity } from '../repositories/user-identities-repository.js';

export class UserIdentitiesService {
  private repo = createUserIdentitiesRepository(getDb, undefined);

  async getByProviderAndProviderUserId(params: {
    context: AccessContext;
    provider: string;
    providerUserId: string;
  }): Promise<{ id: string; userId: string } | null> {
    return this.repo.getByProviderAndProviderUserId(params.context, params.provider, params.providerUserId);
  }

  async getWithCredentials(params: {
    context: AccessContext;
    provider: string;
    providerUserId: string;
  }): Promise<UserIdentity | null> {
    return this.repo.getWithCredentials(params.context, { provider: params.provider, providerUserId: params.providerUserId });
  }

  async getIdentitiesByUserId(context: AccessContext, userId: string): Promise<UserIdentity[]> {
    return this.repo.getByUserId(context, userId);
  }

  async createUserIdentity(context: AccessContext, data: NewUserIdentity): Promise<{ id: string }> {
    return this.repo.create(context, data);
  }

  async hasIdentities(context: AccessContext, userId: string): Promise<boolean> {
    return this.repo.hasIdentities(context, userId);
  }
}

let _instance: UserIdentitiesService | null = null;

export function createUserIdentitiesService(): UserIdentitiesService {
  if (!_instance) _instance = new UserIdentitiesService();
  return _instance;
}
