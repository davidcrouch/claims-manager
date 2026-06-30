import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql, aliasedTable, getTableColumns } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { quotes, lookupValues } from '../schema';

export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteInsert = typeof quotes.$inferInsert;

export interface QuoteViewRow extends QuoteRow {
  statusName: string | null;
  statusExternalReference: string | null;
  quoteTypeName: string | null;
  quoteTypeExternalReference: string | null;
}

function buildQuotesOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(quotes.updatedAt)];
    case 'created_at_desc':
      return [desc(quotes.createdAt)];
    case 'created_at_asc':
      return [asc(quotes.createdAt)];
    case 'quote_number_asc':
      return [asc(quotes.quoteNumber)];
    case 'quote_number_desc':
      return [desc(quotes.quoteNumber)];
    case 'total_amount_asc':
      return [asc(quotes.totalAmount)];
    case 'total_amount_desc':
      return [desc(quotes.totalAmount)];
    case 'quote_date_asc':
      return [asc(quotes.quoteDate)];
    case 'quote_date_desc':
      return [desc(quotes.quoteDate)];
    case 'reference_asc':
      return [asc(quotes.reference)];
    case 'reference_desc':
      return [desc(quotes.reference)];
    case 'updated_at_desc':
    default:
      return [desc(quotes.updatedAt)];
  }
}

@Injectable()
export class QuotesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    statusId?: string;
    sort?: string;
  }): Promise<{ data: QuoteViewRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const quoteTypeLookup = aliasedTable(lookupValues, 'quote_type_lookup');

    let whereClause = and(
      eq(quotes.tenantId, params.tenantId),
      isNull(quotes.deletedAt),
    );
    if (params.jobId) {
      whereClause = and(whereClause, eq(quotes.jobId, params.jobId));
    }
    if (params.statusId) {
      whereClause = and(
        whereClause,
        eq(quotes.statusLookupId, params.statusId),
      );
    }

    let orderBy;
    switch (params.sort) {
      case 'status_asc':
        orderBy = [asc(statusLookup.name)];
        break;
      case 'status_desc':
        orderBy = [desc(statusLookup.name)];
        break;
      case 'estimate_type_asc':
        orderBy = [asc(quoteTypeLookup.name)];
        break;
      case 'estimate_type_desc':
        orderBy = [desc(quoteTypeLookup.name)];
        break;
      default:
        orderBy = buildQuotesOrderBy(params.sort);
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          ...getTableColumns(quotes),
          statusName: statusLookup.name,
          statusExternalReference: statusLookup.externalReference,
          quoteTypeName: quoteTypeLookup.name,
          quoteTypeExternalReference: quoteTypeLookup.externalReference,
        })
        .from(quotes)
        .leftJoin(statusLookup, eq(quotes.statusLookupId, statusLookup.id))
        .leftJoin(quoteTypeLookup, eq(quotes.quoteTypeLookupId, quoteTypeLookup.id))
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotes)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data: data as QuoteViewRow[], total };
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<QuoteRow | null> {
    const [row] = await this.db
      .select()
      .from(quotes)
      .where(
        and(eq(quotes.id, params.id), eq(quotes.tenantId, params.tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: {
    jobId: string;
    tenantId: string;
  }): Promise<QuoteViewRow[]> {
    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const quoteTypeLookup = aliasedTable(lookupValues, 'quote_type_lookup');

    const data = await this.db
      .select({
        ...getTableColumns(quotes),
        statusName: statusLookup.name,
        statusExternalReference: statusLookup.externalReference,
        quoteTypeName: quoteTypeLookup.name,
        quoteTypeExternalReference: quoteTypeLookup.externalReference,
      })
      .from(quotes)
      .leftJoin(statusLookup, eq(quotes.statusLookupId, statusLookup.id))
      .leftJoin(quoteTypeLookup, eq(quotes.quoteTypeLookupId, quoteTypeLookup.id))
      .where(
        and(
          eq(quotes.jobId, params.jobId),
          eq(quotes.tenantId, params.tenantId),
          isNull(quotes.deletedAt),
        ),
      )
      .orderBy(desc(quotes.updatedAt));
    return data as QuoteViewRow[];
  }

  async create(params: {
    data: QuoteInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<QuoteRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(quotes).values(params.data).returning();
    return inserted;
  }

  async update(params: {
    id: string;
    data: Partial<QuoteInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<QuoteRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(quotes)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(quotes.id, params.id))
      .returning();
    return updated ?? null;
  }

  async softDelete(params: {
    id: string;
    tenantId: string;
  }): Promise<QuoteRow | null> {
    const [updated] = await this.db
      .update(quotes)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(quotes.id, params.id), eq(quotes.tenantId, params.tenantId)),
      )
      .returning();
    return updated ?? null;
  }

  async hardDelete(params: {
    id: string;
    tenantId: string;
  }): Promise<boolean> {
    const result = await this.db
      .delete(quotes)
      .where(
        and(eq(quotes.id, params.id), eq(quotes.tenantId, params.tenantId)),
      )
      .returning();
    return result.length > 0;
  }

  async countByTenant(params: { tenantId: string }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotes)
      .where(eq(quotes.tenantId, params.tenantId));
    return r?.count ?? 0;
  }
}
