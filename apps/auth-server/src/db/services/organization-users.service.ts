/**
 * Local organization_users service (business_users → organization_users). Replaces @morezero/database/businesses.
 */

import type { AccessContext } from '../../schemas/index.js';
import { getDb } from '../client.js';
import { createOrganizationUsersRepository } from '../repositories/organization-users-repository.js';
import type { OrganizationUser } from '../repositories/organization-users-repository.js';

export class OrganizationUsersService {
  private repo = createOrganizationUsersRepository(getDb, undefined);

  async getByUserIdAndOrganizationId(params: {
    context: AccessContext;
    userId: string;
    organizationId: string;
  }): Promise<{ id: string } | null> {
    return this.repo.getByUserIdAndOrganizationId(params.context, params.userId, params.organizationId);
  }

  async getOrganizationsByUserId(context: AccessContext, userId: string): Promise<OrganizationUser[]> {
    return this.repo.getByUserId(context, userId);
  }
}

let _instance: OrganizationUsersService | null = null;

export function createOrganizationUsersService(): OrganizationUsersService {
  if (!_instance) _instance = new OrganizationUsersService();
  return _instance;
}

/** Alias for callers that expect getBusinessesByUserId (returns org memberships). */
export function createBusinessUsersService(): OrganizationUsersService {
  return createOrganizationUsersService();
}
