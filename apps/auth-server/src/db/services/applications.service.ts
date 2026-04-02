/**
 * Local applications service. Replaces @morezero/database/applications.
 */

import type { AccessContext } from '../../schemas/index.js';
import { getDb } from '../client.js';
import { createApplicationsRepository } from '../repositories/applications-repository.js';
import type { Application } from '../repositories/applications-repository.js';

export class ApplicationsService {
  private repo = createApplicationsRepository(getDb, undefined);

  async getApplication(context: AccessContext, id: string): Promise<Application | null> {
    return this.repo.get(context, id);
  }

  async getApplicationBySubdomain(context: AccessContext, subdomain: string): Promise<Application | null> {
    return this.repo.getBySubdomain(context, subdomain);
  }
}

let _instance: ApplicationsService | null = null;

export function createApplicationsService(): ApplicationsService {
  if (!_instance) _instance = new ApplicationsService();
  return _instance;
}
