import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, or, ilike, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { vendors } from '../schema';

export type VendorRow = typeof vendors.$inferSelect;
export type VendorInsert = typeof vendors.$inferInsert;

@Injectable()
export class VendorsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: VendorRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const searchPattern = params.search ? `%${params.search}%` : null;
    const whereClause = searchPattern
      ? and(
          eq(vendors.tenantId, params.tenantId),
          eq(vendors.isActive, true),
          or(
            ilike(vendors.name, searchPattern),
            ilike(vendors.externalReference, searchPattern),
          )!,
        )
      : and(eq(vendors.tenantId, params.tenantId), eq(vendors.isActive, true));

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(vendors)
        .where(whereClause)
        .orderBy(asc(vendors.name))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(vendors)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<VendorRow | null> {
    const [row] = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, params.id), eq(vendors.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }
}
