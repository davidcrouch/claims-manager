/**
 * Local organizations repository (migration: business → organization).
 */

import { and, eq } from 'drizzle-orm';
import { organizations } from '../schema.js';
import type { AccessContext } from '../../schemas/index.js';
import type { DbGetter } from './users-repository.js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  object: string;
  created: string;
  modified: string;
  createdBy: string;
  modifiedBy: string;
  orgCode: string;
  config?: unknown;
}

export interface NewOrganization {
  name: string;
  /** URL-safe identifier; if omitted, orgCode is used. */
  slug?: string;
  description?: string | null;
  orgCode: string;
  config?: unknown;
  ext?: unknown;
}

export class OrganizationsRepository {
  constructor(
    private db: DbGetter,
    private _loggerFactory?: unknown
  ) {}

  async get(context: AccessContext, id: string): Promise<Organization | null> {
    const [row] = await this.db()
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, id), eq(organizations.status, 'Active')))
      .limit(1);
    return row ? { ...row, description: row.description ?? undefined, config: row.config ?? undefined } : null;
  }

  async create(context: AccessContext, data: NewOrganization): Promise<Organization> {
    const now = new Date().toISOString();
    const slug = data.slug ?? data.orgCode;
    const [row] = await this.db()
      .insert(organizations)
      .values({
        name: data.name,
        slug,
        description: data.description ?? null,
        orgCode: data.orgCode,
        config: data.config ?? null,
        createdBy: context.userId ?? '00000000-0000-0000-0000-000000000000',
        modifiedBy: context.userId ?? '00000000-0000-0000-0000-000000000000',
        created: now,
        modified: now,
        status: 'Active',
        object: 'organization',
      } as typeof organizations.$inferInsert)
      .returning();
    if (!row) throw new Error('Failed to create organization');
    return { ...row, description: row.description ?? undefined, config: row.config ?? undefined };
  }
}

export function createOrganizationsRepository(database: DbGetter, loggerFactory?: unknown) {
  return new OrganizationsRepository(database, loggerFactory);
}
