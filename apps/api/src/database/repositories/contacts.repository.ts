import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, or, ilike, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { contacts } from '../schema';

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;

@Injectable()
export class ContactsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: ContactRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const searchPattern = params.search ? `%${params.search}%` : null;
    const whereClause = searchPattern
      ? and(
          eq(contacts.tenantId, params.tenantId),
          or(
            ilike(contacts.firstName, searchPattern),
            ilike(contacts.lastName, searchPattern),
            ilike(contacts.email, searchPattern),
            ilike(contacts.mobilePhone, searchPattern),
          )!,
        )
      : eq(contacts.tenantId, params.tenantId);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(contacts)
        .where(whereClause)
        .orderBy(asc(contacts.lastName), asc(contacts.firstName))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(contacts)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<ContactRow | null> {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, params.id), eq(contacts.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }
}
