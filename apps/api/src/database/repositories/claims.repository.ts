import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, sql, ilike, or, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { claims } from '../schema';

export type ClaimRow = typeof claims.$inferSelect;
export type ClaimInsert = typeof claims.$inferInsert;

@Injectable()
export class ClaimsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: ClaimRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const searchPattern = params.search ? `%${params.search}%` : null;
    const whereClause = searchPattern
      ? and(
          eq(claims.tenantId, params.tenantId),
          isNull(claims.deletedAt),
          or(
            ilike(claims.claimNumber, searchPattern),
            ilike(claims.externalReference, searchPattern),
            ilike(claims.policyNumber, searchPattern),
          ),
        )
      : and(eq(claims.tenantId, params.tenantId), isNull(claims.deletedAt));

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(claims)
        .where(whereClause)
        .orderBy(desc(claims.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(claims)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<ClaimRow | null> {
    const [row] = await this.db
      .select()
      .from(claims)
      .where(and(eq(claims.id, params.id), eq(claims.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByIdAndTenant(params: { id: string; tenantId: string }): Promise<ClaimRow | null> {
    return this.findOne(params);
  }

  async create(params: { data: ClaimInsert }): Promise<ClaimRow> {
    const [inserted] = await this.db.insert(claims).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<ClaimInsert>;
  }): Promise<ClaimRow | null> {
    const [updated] = await this.db
      .update(claims)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(claims.id, params.id))
      .returning();
    return updated ?? null;
  }

  async countByTenant(params: { tenantId: string }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(claims)
      .where(eq(claims.tenantId, params.tenantId));
    return r?.count ?? 0;
  }
}
