import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  eq,
  and,
  isNull,
  sql,
  ilike,
  or,
  desc,
  asc,
  inArray,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { claims } from '../schema';

export type ClaimRow = typeof claims.$inferSelect;
export type ClaimInsert = typeof claims.$inferInsert;

function buildOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(claims.updatedAt)];
    case 'created_at_desc':
      return [desc(claims.createdAt)];
    case 'created_at_asc':
      return [asc(claims.createdAt)];
    case 'claim_number_asc':
      return [asc(claims.claimNumber)];
    case 'claim_number_desc':
      return [desc(claims.claimNumber)];
    case 'updated_at_desc':
    default:
      return [desc(claims.updatedAt)];
  }
}

@Injectable()
export class ClaimsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    status?: string;
  }): Promise<{ data: ClaimRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusIds = params.status
      ? params.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const searchPattern = params.search ? `%${params.search}%` : null;
    const searchClause = searchPattern
      ? or(
          ilike(claims.claimNumber, searchPattern),
          ilike(claims.externalReference, searchPattern),
          ilike(claims.policyNumber, searchPattern),
        )
      : undefined;

    const statusClause =
      statusIds.length > 0
        ? inArray(claims.statusLookupId, statusIds)
        : undefined;

    const whereParts = [
      eq(claims.tenantId, params.tenantId),
      isNull(claims.deletedAt),
      ...(searchClause ? [searchClause] : []),
      ...(statusClause ? [statusClause] : []),
    ];
    const whereClause = and(...whereParts);

    const orderBy = buildOrderBy(params.sort);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(claims)
        .where(whereClause)
        .orderBy(...orderBy)
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

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<ClaimRow | null> {
    const [row] = await this.db
      .select()
      .from(claims)
      .where(
        and(eq(claims.id, params.id), eq(claims.tenantId, params.tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByIdAndTenant(params: {
    id: string;
    tenantId: string;
  }): Promise<ClaimRow | null> {
    return this.findOne(params);
  }

  async findByExternalReference(params: {
    tenantId: string;
    externalReference: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(claims)
      .where(
        and(
          eq(claims.tenantId, params.tenantId),
          eq(claims.externalReference, params.externalReference),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByClaimNumber(params: {
    tenantId: string;
    claimNumber: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(claims)
      .where(
        and(
          eq(claims.tenantId, params.tenantId),
          eq(claims.claimNumber, params.claimNumber),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    data: ClaimInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(claims).values(params.data).returning();
    return inserted;
  }

  async createIfNotExists(params: {
    data: ClaimInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimRow | null> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(claims)
      .values(params.data)
      .onConflictDoNothing()
      .returning();
    return inserted ?? null;
  }

  async update(params: {
    id: string;
    data: Partial<ClaimInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
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
