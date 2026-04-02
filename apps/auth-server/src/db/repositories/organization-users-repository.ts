/**
 * Local organization_users repository (migration: business → organization).
 */

import { and, eq } from 'drizzle-orm';
import { organizationUsers } from '../schema.js';
import type { AccessContext } from '../../schemas/index.js';
import type { DbGetter } from './users-repository.js';

export interface OrganizationUser {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  status: string;
  object: string;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
  profile?: unknown;
  config?: unknown;
  ext?: unknown;
}

export interface NewOrganizationUser {
  userId: string;
  organizationId: string;
  role: string;
  status: string;
  object: string;
  created: string;
  createdBy: string;
  modified: string;
  modifiedBy: string;
  profile?: unknown;
  config?: unknown;
  ext?: unknown;
}

export class OrganizationUsersRepository {
  constructor(
    private db: DbGetter,
    private _loggerFactory?: unknown
  ) {}

  async getByUserIdAndOrganizationId(
    context: AccessContext,
    userId: string,
    organizationId: string
  ): Promise<{ id: string } | null> {
    const [row] = await this.db()
      .select({ id: organizationUsers.id })
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.organizationId, organizationId)
        )
      )
      .limit(1);
    return row ?? null;
  }

  async getByUserId(context: AccessContext, userId: string): Promise<OrganizationUser[]> {
    const rows = await this.db()
      .select()
      .from(organizationUsers)
      .where(eq(organizationUsers.userId, userId));
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      organizationId: r.organizationId,
      role: r.role,
      status: r.status,
      object: r.object,
      created: r.created,
      createdBy: r.createdBy,
      modified: r.modified,
      modifiedBy: r.modifiedBy,
      profile: r.profile,
      config: r.config,
      ext: r.ext,
    }));
  }

  async create(context: AccessContext, data: NewOrganizationUser): Promise<{ id: string }> {
    const [row] = await this.db()
      .insert(organizationUsers)
      .values({
        userId: data.userId,
        organizationId: data.organizationId,
        role: data.role,
        status: data.status,
        object: data.object,
        created: data.created,
        modified: data.modified,
        createdBy: data.createdBy ?? '00000000-0000-0000-0000-000000000000',
        modifiedBy: data.modifiedBy ?? '00000000-0000-0000-0000-000000000000',
        profile: data.profile ?? null,
        config: data.config ?? null,
        ext: data.ext ?? null,
      } as typeof organizationUsers.$inferInsert)
      .returning({ id: organizationUsers.id });
    if (!row) throw new Error('Failed to create organization_user');
    return row;
  }
}

export function createOrganizationUsersRepository(database: DbGetter, loggerFactory?: unknown) {
  return new OrganizationUsersRepository(database, loggerFactory);
}
