import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, or, ilike, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
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

  async findOne(params: {
    id: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<VendorRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, params.id), eq(vendors.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByExternalReference(params: {
    tenantId: string;
    externalReference: string;
    tx?: DrizzleDbOrTx;
  }): Promise<VendorRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(vendors)
      .where(
        and(
          eq(vendors.tenantId, params.tenantId),
          eq(vendors.externalReference, params.externalReference),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByCrunchworkId(params: {
    tenantId: string;
    crunchworkId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<VendorRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(vendors)
      .where(
        and(
          eq(vendors.tenantId, params.tenantId),
          sql`${vendors.vendorPayload}->>'id' = ${params.crunchworkId}`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsertByExternalReference(params: {
    tenantId: string;
    externalReference: string;
    data: Omit<VendorInsert, 'tenantId' | 'externalReference'>;
    tx?: DrizzleDbOrTx;
  }): Promise<VendorRow> {
    const db = params.tx ?? this.db;
    const now = new Date();
    const [row] = await db
      .insert(vendors)
      .values({
        tenantId: params.tenantId,
        externalReference: params.externalReference,
        ...params.data,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [vendors.tenantId, vendors.externalReference],
        set: {
          name: params.data.name,
          address: params.data.address,
          contactDetails: params.data.contactDetails,
          vendorPayload: params.data.vendorPayload,
          postcode: params.data.postcode,
          state: params.data.state,
          city: params.data.city,
          country: params.data.country,
          phone: params.data.phone,
          afterHoursPhone: params.data.afterHoursPhone,
          isActive: params.data.isActive ?? true,
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }
}
