/**
 * Local user_identities repository – same API as @morezero/database.
 */

import { and, eq } from 'drizzle-orm';
import { userIdentities } from '../schema.js';
import type { AccessContext } from '../../schemas/index.js';
import type { DbGetter } from './users-repository.js';

export interface UserIdentity {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  rawProfile?: unknown;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface NewUserIdentity {
  userId: string;
  provider: string;
  providerUserId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  rawProfile?: unknown;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | string | null;
}

export class UserIdentitiesRepository {
  constructor(
    private db: DbGetter,
    private loggerFactory?: unknown
  ) {}

  async getByProviderAndProviderUserId(
    context: AccessContext,
    provider: string,
    providerUserId: string
  ): Promise<{ id: string; userId: string } | null> {
    const [row] = await this.db()
      .select({ id: userIdentities.id, userId: userIdentities.userId })
      .from(userIdentities)
      .where(and(eq(userIdentities.provider, provider), eq(userIdentities.providerSubject, providerUserId)))
      .limit(1);
    return row ?? null;
  }

  async getWithCredentials(
    context: AccessContext,
    params: { provider: string; providerUserId: string }
  ): Promise<UserIdentity | null> {
    const [row] = await this.db()
      .select()
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, params.provider),
          eq(userIdentities.providerSubject, params.providerUserId)
        )
      )
      .limit(1);
    return row ? this.mapToIdentity(row) : null;
  }

  async get(context: AccessContext, id: string): Promise<UserIdentity | null> {
    const [row] = await this.db().select().from(userIdentities).where(eq(userIdentities.id, id)).limit(1);
    return row ? this.mapToIdentity(row) : null;
  }

  async getByUserId(context: AccessContext, userId: string): Promise<UserIdentity[]> {
    const rows = await this.db().select().from(userIdentities).where(eq(userIdentities.userId, userId));
    return rows.map((r) => this.mapToIdentity(r));
  }

  async hasIdentities(context: AccessContext, userId: string): Promise<boolean> {
    const [row] = await this.db()
      .select({ id: userIdentities.userId })
      .from(userIdentities)
      .where(eq(userIdentities.userId, userId))
      .limit(1);
    return !!row;
  }

  async create(context: AccessContext, data: NewUserIdentity): Promise<{ id: string }> {
    const [row] = await this.db()
      .insert(userIdentities)
      .values({
        userId: data.userId,
        provider: data.provider,
        providerSubject: data.providerUserId,
        displayName: data.displayName ?? null,
        avatarUrl: data.avatarUrl ?? null,
        rawProfile: (data.rawProfile ?? {}) as Record<string, unknown>,
        accessToken: data.accessToken ?? null,
        refreshToken: data.refreshToken ?? null,
        tokenExpiresAt: data.tokenExpiresAt ?? null,
      } as typeof userIdentities.$inferInsert)
      .returning({ id: userIdentities.id });
    if (!row) throw new Error('Failed to create user identity');
    return row;
  }

  private mapToIdentity(row: typeof userIdentities.$inferSelect): UserIdentity {
    return {
      id: row.id,
      userId: row.userId,
      provider: row.provider,
      providerUserId: row.providerSubject,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      rawProfile: row.rawProfile,
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      tokenExpiresAt: row.tokenExpiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export function createUserIdentitiesRepository(database: DbGetter, loggerFactory?: unknown) {
  return new UserIdentitiesRepository(database, loggerFactory);
}
