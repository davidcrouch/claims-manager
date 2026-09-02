import { Injectable, Inject } from '@nestjs/common';
import { eq, and, or, ilike, asc, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { users, organizationUsers, userRoleAssignments } from '../schema';

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export type OrgMemberRow = {
  id: string;
  email: string | null;
  name: string | null;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  membershipRole: string;
  membershipStatus: string;
  joinedAt: string;
  roles: string[];
};

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(params: { id: string }): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1);
    return row ?? null;
  }

  async findByEmail(params: { email: string }): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, params.email))
      .limit(1);
    return row ?? null;
  }

  /** Org member whose email matches (case-insensitive). */
  async findOrgMemberByEmail(params: {
    organizationId: string;
    email: string;
  }): Promise<UserRow | null> {
    const email = params.email.trim().toLowerCase();
    if (!email) return null;
    const [row] = await this.db
      .select({ user: users })
      .from(users)
      .innerJoin(organizationUsers, eq(users.id, organizationUsers.userId))
      .where(
        and(
          eq(organizationUsers.organizationId, params.organizationId),
          sql`lower(btrim(${users.email})) = ${email}`,
        ),
      )
      .limit(1);
    return row?.user ?? null;
  }

  /**
   * Resolve the org user id for a JWT identity.
   * Prefer email match (same as frontend resolveCurrentOrgUserId), then JWT sub.
   */
  async resolveOrgUserId(params: {
    organizationId: string;
    userId?: string | null;
    email?: string | null;
  }): Promise<string | null> {
    const email = params.email?.trim().toLowerCase() || null;
    const sub = params.userId?.trim() || null;
    if (email) {
      const byEmail = await this.findOrgMemberByEmail({
        organizationId: params.organizationId,
        email,
      });
      if (byEmail) return byEmail.id;
    }
    if (sub) {
      const membership = await this.findOrgMembership({
        userId: sub,
        organizationId: params.organizationId,
      });
      if (membership) return sub;
    }
    return null;
  }

  async findByOrganization(params: { organizationId: string }): Promise<UserRow[]> {
    const rows = await this.db
      .select({ user: users })
      .from(users)
      .innerJoin(organizationUsers, eq(users.id, organizationUsers.userId))
      .where(eq(organizationUsers.organizationId, params.organizationId));
    return rows.map((r) => r.user);
  }

  async searchByOrganization(params: {
    organizationId: string;
    search?: string;
    limit?: number;
  }): Promise<UserRow[]> {
    const limit = Math.min(params.limit ?? 20, 100);
    const searchPattern = params.search ? `%${params.search}%` : null;

    const baseCondition = eq(organizationUsers.organizationId, params.organizationId);
    const whereClause = searchPattern
      ? and(baseCondition, or(ilike(users.name, searchPattern), ilike(users.email, searchPattern)))
      : baseCondition;

    const rows = await this.db
      .select({ user: users })
      .from(users)
      .innerJoin(organizationUsers, eq(users.id, organizationUsers.userId))
      .where(whereClause)
      .orderBy(asc(users.name))
      .limit(limit);
    return rows.map((r) => r.user);
  }

  async listOrgMembers(params: { organizationId: string }): Promise<OrgMemberRow[]> {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        status: users.status,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        membershipRole: organizationUsers.role,
        membershipStatus: organizationUsers.status,
        joinedAt: organizationUsers.created,
        roles: sql<string[]>`coalesce(
          array_agg(${userRoleAssignments.roleName})
            filter (where ${userRoleAssignments.revokedAt} is null and ${userRoleAssignments.id} is not null),
          '{}'::text[]
        )`,
      })
      .from(users)
      .innerJoin(
        organizationUsers,
        and(
          eq(users.id, organizationUsers.userId),
          eq(organizationUsers.organizationId, params.organizationId),
        ),
      )
      .leftJoin(
        userRoleAssignments,
        and(
          eq(userRoleAssignments.userId, users.id),
          eq(userRoleAssignments.organizationId, params.organizationId),
          isNull(userRoleAssignments.revokedAt),
        ),
      )
      .groupBy(
        users.id,
        users.email,
        users.name,
        users.status,
        users.isActive,
        users.createdAt,
        users.updatedAt,
        organizationUsers.role,
        organizationUsers.status,
        organizationUsers.created,
      )
      .orderBy(asc(users.name), asc(users.email));

    return rows.map((r) => ({
      ...r,
      roles: Array.isArray(r.roles) ? r.roles.filter(Boolean) : [],
    }));
  }

  async findOrgMembership(params: {
    userId: string;
    organizationId: string;
  }): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: organizationUsers.id })
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.userId, params.userId),
          eq(organizationUsers.organizationId, params.organizationId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async removeOrgMembership(params: {
    userId: string;
    organizationId: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(userRoleAssignments)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(userRoleAssignments.userId, params.userId),
            eq(userRoleAssignments.organizationId, params.organizationId),
            isNull(userRoleAssignments.revokedAt),
          ),
        );

      const deleted = await tx
        .delete(organizationUsers)
        .where(
          and(
            eq(organizationUsers.userId, params.userId),
            eq(organizationUsers.organizationId, params.organizationId),
          ),
        )
        .returning({ id: organizationUsers.id });

      return deleted.length > 0;
    });
  }

  async create(params: { data: UserInsert }): Promise<UserRow> {
    const [inserted] = await this.db.insert(users).values(params.data).returning();
    return inserted!;
  }

  async update(params: { id: string; data: Partial<UserInsert> }): Promise<UserRow | null> {
    const [updated] = await this.db
      .update(users)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(users.id, params.id))
      .returning();
    return updated ?? null;
  }
}
