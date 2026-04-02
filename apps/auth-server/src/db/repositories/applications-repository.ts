/**
 * Local applications repository – same API as @morezero/database (get, getById, getBySubdomain).
 */

import { eq } from 'drizzle-orm';
import { applications } from '../schema.js';
import type { AccessContext } from '../../schemas/index.js';
import type { DbGetter } from './users-repository.js';

export interface Application {
  id: string;
  name: string;
  status: string;
  object: string;
  created: string;
  modified: string;
  createdBy: string;
  modifiedBy: string;
  subdomain: string;
  systemUserId?: string | null;
  organizationId: string;
}

export class ApplicationsRepository {
  constructor(
    private db: DbGetter,
    private _loggerFactory?: unknown
  ) {}

  async get(context: AccessContext, id: string): Promise<Application | null> {
    const accountId = context.organizationId;
    if (accountId === 'public' || accountId === 'system') return this.getById(id);
    const [row] = await this.db()
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1);
    return row ? (row as Application) : null;
  }

  async getById(id: string): Promise<Application | null> {
    const [row] = await this.db().select().from(applications).where(eq(applications.id, id)).limit(1);
    return row ? (row as Application) : null;
  }

  async getBySubdomain(context: AccessContext, subdomain: string): Promise<Application | null> {
    const [row] = await this.db()
      .select()
      .from(applications)
      .where(eq(applications.subdomain, subdomain))
      .limit(1);
    return row ? (row as Application) : null;
  }
}

export function createApplicationsRepository(database: DbGetter, loggerFactory?: unknown) {
  return new ApplicationsRepository(database, loggerFactory);
}
