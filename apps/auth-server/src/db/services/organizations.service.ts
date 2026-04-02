/**
 * Local organizations service (business → organization). Replaces @morezero/database/businesses.
 */

import type { AccessContext } from '../../schemas/index.js';
import { getDb } from '../client.js';
import { createOrganizationsRepository } from '../repositories/organizations-repository.js';

export class OrganizationsService {
  private repo = createOrganizationsRepository(getDb, undefined);

  async getOrganization(context: AccessContext, id: string) {
    return this.repo.get(context, id);
  }
}

let _instance: OrganizationsService | null = null;

export function createOrganizationsService(): OrganizationsService {
  if (!_instance) _instance = new OrganizationsService();
  return _instance;
}

/** Alias for callers that expect getBusiness (organization = renamed business). */
export function createBusinessesService(): OrganizationsService {
  return createOrganizationsService();
}
