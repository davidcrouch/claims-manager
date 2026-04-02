/**
 * Local users repository – same API as @morezero/database users repository.
 */

import { and, eq, count, ilike, asc, desc } from 'drizzle-orm';
import { users } from '../schema.js';
import type { AccessContext } from '../../schemas/index.js';
import type { User, NewUser } from '../../schemas/index.js';
import { createLogger, LoggerType } from '../../lib/logger.js';
import type { DbGetter } from '../client.js';

const log = createLogger('auth-server:db:users-repository', LoggerType.NODEJS);

export type { DbGetter };

export interface ListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export class UsersRepository {
  constructor(
    private db: DbGetter,
    private loggerFactory?: unknown
  ) {}

  async list(context: AccessContext, options: ListOptions = {}): Promise<ListResult<User>> {
    const { page = 1, limit = 20, search, status, sortBy = 'created', sortOrder = 'desc' } = options;
    const offset = (page - 1) * limit;
    const conditions = [];
    if (search) conditions.push(ilike(users.name, `%${search}%`));
    if (status) conditions.push(eq(users.status, status));
    const orderBy = sortOrder === 'asc' ? asc(users.created) : desc(users.created);

    const [totalResult] = await this.db()
      .select({ count: count() })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined);
    const total = Number(totalResult?.count ?? 0);
    const data = await this.db()
      .select()
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return {
      data: data.map((row) => this.mapToUser(row)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(context: AccessContext, id: string): Promise<User | null> {
    const [row] = await this.db().select().from(users).where(eq(users.id, id)).limit(1);
    return row ? this.mapToUser(row) : null;
  }

  async create(context: AccessContext, data: NewUser): Promise<User> {
    const now = new Date().toISOString();
    const [row] = await this.db()
      .insert(users)
      .values({
        name: data.name ?? '',
        email: (data as { email?: string }).email ?? '',
        created: now,
        modified: now,
        object: 'user',
        status: (data as { status?: string }).status || 'Active',
        createdBy: context.userId ?? '00000000-0000-0000-0000-000000000000',
        modifiedBy: context.userId ?? '00000000-0000-0000-0000-000000000000',
        config: (data as { config?: unknown }).config ?? null,
      } as typeof users.$inferInsert)
      .returning();
    if (!row) throw new Error('Failed to create user');
    return this.mapToUser(row);
  }

  async update(context: AccessContext, id: string, data: Partial<User>): Promise<User | null> {
    const [row] = await this.db()
      .update(users)
      .set({
        ...data,
        modified: new Date().toISOString(),
        modifiedBy: context.userId ?? '00000000-0000-0000-0000-000000000000',
      } as Record<string, unknown>)
      .where(eq(users.id, id))
      .returning();
    return row ? this.mapToUser(row) : null;
  }

  async delete(context: AccessContext, id: string, forceDelete: boolean): Promise<User | null> {
    const user = await this.get(context, id);
    if (!user) return null;
    if (forceDelete) {
      await this.db().delete(users).where(eq(users.id, id));
      return user;
    }
    const [updated] = await this.db()
      .update(users)
      .set({
        status: 'Archived',
        modifiedBy: context.userId,
        modified: new Date().toISOString(),
      } as Record<string, unknown>)
      .where(and(eq(users.id, id), eq(users.status, 'Active')))
      .returning();
    return updated ? this.mapToUser(updated) : null;
  }

  async getByEmail(context: AccessContext, email: string): Promise<User | null> {
    if (email === undefined || email === null || email === '') return null;
    const [row] = await this.db().select().from(users).where(eq(users.email, email)).limit(1);
    return row ? this.mapToUser(row) : null;
  }

  private mapToUser(row: typeof users.$inferSelect): User {
    return { ...row } as User;
  }
}

export function createUsersRepository(database: DbGetter, loggerFactory?: unknown) {
  return new UsersRepository(database, loggerFactory);
}
