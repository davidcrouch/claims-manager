import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql, inArray, or, aliasedTable, getTableColumns, ilike } from 'drizzle-orm';
import { normalizeListJobIds, normalizeListUserIds, parseCsvFilterValues } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { quotes, lookupValues, users, jobs } from '../schema';

export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteInsert = typeof quotes.$inferInsert;

export interface QuoteViewRow extends QuoteRow {
  statusName: string | null;
  statusExternalReference: string | null;
  quoteTypeName: string | null;
  quoteTypeExternalReference: string | null;
  assigneeName: string | null;
}

const assigneeJoinOn = sql`${quotes.assignedToUserId} = ${users.id}::text`;

function buildQuotesOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(quotes.updatedAt)];
    case 'created_at_desc':
      return [desc(quotes.createdAt)];
    case 'created_at_asc':
      return [asc(quotes.createdAt)];
    case 'quote_number_asc':
    case 'insurer_ref_asc':
      return [asc(quotes.quoteNumber)];
    case 'quote_number_desc':
    case 'insurer_ref_desc':
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
    jobIds?: string[];
    /** Comma-separated status lookup IDs. */
    status?: string;
    /** Comma-separated quote type lookup IDs. */
    quoteType?: string;
    /** @deprecated Use status. */
    statusId?: string;
    assignedToUserId?: string;
    assignedToUserIds?: string;
    /**
     * When true, combine assignedToUserId(s) and jobIds with OR instead of AND.
     * Used by dashboard My Work (assignee on quote or quote on my jobs).
     */
    matchAssigneeOrJobIds?: boolean;
    search?: string;
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
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    const assigneeIds = normalizeListUserIds({
      userId: params.assignedToUserId,
      userIds: params.assignedToUserIds,
    });
    const useOrScope = Boolean(params.matchAssigneeOrJobIds);

    if (useOrScope) {
      const orParts = [];
      if (assigneeIds && assigneeIds.length > 0) {
        const realIds = assigneeIds.filter((id) => id !== '__blank__');
        if (realIds.length > 0) {
          orParts.push(inArray(quotes.assignedToUserId, realIds));
        }
      }
      if (jobIds && jobIds.length > 0) {
        orParts.push(
          jobIds.length === 1 ? eq(quotes.jobId, jobIds[0]) : inArray(quotes.jobId, jobIds),
        );
      }
      if (orParts.length === 0) {
        return { data: [], total: 0 };
      }
      whereClause = and(whereClause, orParts.length === 1 ? orParts[0] : or(...orParts)!)!;
    } else {
      if (jobIds) {
        if (jobIds.length === 0) return { data: [], total: 0 };
        whereClause = and(
          whereClause,
          jobIds.length === 1 ? eq(quotes.jobId, jobIds[0]) : inArray(quotes.jobId, jobIds),
        );
      }
      if (assigneeIds) {
        if (assigneeIds.length === 0) return { data: [], total: 0 };
        const includeBlank = assigneeIds.includes('__blank__');
        const realIds = assigneeIds.filter((id) => id !== '__blank__');
        if (includeBlank && realIds.length > 0) {
          whereClause = and(
            whereClause,
            or(isNull(quotes.assignedToUserId), inArray(quotes.assignedToUserId, realIds))!,
          );
        } else if (includeBlank) {
          whereClause = and(whereClause, isNull(quotes.assignedToUserId));
        } else {
          whereClause = and(whereClause, inArray(quotes.assignedToUserId, realIds));
        }
      }
    }
    const statusIds = (params.status ?? params.statusId)?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const quoteTypeIds = params.quoteType?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (statusIds.length > 0) {
      whereClause = and(
        whereClause,
        inArray(quotes.statusLookupId, statusIds),
      );
    }
    if (quoteTypeIds.length > 0) {
      whereClause = and(whereClause, inArray(quotes.quoteTypeLookupId, quoteTypeIds));
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(quotes.quoteNumber, term),
          ilike(quotes.internalNumber, term),
          ilike(quotes.name, term),
          ilike(quotes.reference, term),
          ilike(quotes.note, term),
        )!,
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
          assigneeName: users.name,
        })
        .from(quotes)
        .leftJoin(statusLookup, eq(quotes.statusLookupId, statusLookup.id))
        .leftJoin(quoteTypeLookup, eq(quotes.quoteTypeLookupId, quoteTypeLookup.id))
        .leftJoin(users, assigneeJoinOn)
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

  async findFilterAssignees(params: {
    tenantId: string;
  }): Promise<{ id: string; name: string }[]> {
    const rows = await this.db
      .selectDistinct({ id: quotes.assignedToUserId, name: users.name })
      .from(quotes)
      .leftJoin(users, assigneeJoinOn)
      .where(
        and(
          eq(quotes.tenantId, params.tenantId),
          isNull(quotes.deletedAt),
          sql`${quotes.assignedToUserId} IS NOT NULL AND btrim(${quotes.assignedToUserId}) <> ''`,
        ),
      )
      .orderBy(asc(users.name));

    return rows
      .filter((r): r is { id: string; name: string | null } => !!r.id)
      .map((r) => ({ id: r.id, name: (r.name ?? '').trim() || r.id }));
  }

  async findFilterJobs(params: {
    tenantId: string;
  }): Promise<
    Array<{
      id: string;
      internalNumber: string | null;
      name: string | null;
      externalJobId: string | null;
      externalReference: string | null;
      jobTypeName: string | null;
    }>
  > {
    const jobTypeLookup = aliasedTable(lookupValues, 'job_type_lookup');
    return this.db
      .select({
        id: jobs.id,
        internalNumber: jobs.internalNumber,
        name: jobs.name,
        externalJobId: jobs.externalJobId,
        externalReference: jobs.externalReference,
        jobTypeName: jobTypeLookup.name,
      })
      .from(quotes)
      .innerJoin(jobs, eq(jobs.id, quotes.jobId))
      .leftJoin(jobTypeLookup, eq(jobs.jobTypeLookupId, jobTypeLookup.id))
      .where(
        and(
          eq(quotes.tenantId, params.tenantId),
          isNull(quotes.deletedAt),
          eq(jobs.tenantId, params.tenantId),
          isNull(jobs.deletedAt),
        ),
      )
      .groupBy(
        jobs.id,
        jobs.internalNumber,
        jobs.name,
        jobs.externalJobId,
        jobs.externalReference,
        jobTypeLookup.name,
      )
      .orderBy(
        asc(
          sql`COALESCE(${jobs.internalNumber}, ${jobs.name}, ${jobs.externalJobId}, ${jobs.externalReference}, ${jobs.id}::text)`,
        ),
      );
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<QuoteViewRow | null> {
    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const quoteTypeLookup = aliasedTable(lookupValues, 'quote_type_lookup');

    const [row] = await this.db
      .select({
        ...getTableColumns(quotes),
        statusName: statusLookup.name,
        statusExternalReference: statusLookup.externalReference,
        quoteTypeName: quoteTypeLookup.name,
        quoteTypeExternalReference: quoteTypeLookup.externalReference,
        assigneeName: users.name,
      })
      .from(quotes)
      .leftJoin(statusLookup, eq(quotes.statusLookupId, statusLookup.id))
      .leftJoin(quoteTypeLookup, eq(quotes.quoteTypeLookupId, quoteTypeLookup.id))
      .leftJoin(users, assigneeJoinOn)
      .where(
        and(eq(quotes.id, params.id), eq(quotes.tenantId, params.tenantId)),
      )
      .limit(1);
    return (row as QuoteViewRow) ?? null;
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
        assigneeName: users.name,
      })
      .from(quotes)
      .leftJoin(statusLookup, eq(quotes.statusLookupId, statusLookup.id))
      .leftJoin(quoteTypeLookup, eq(quotes.quoteTypeLookupId, quoteTypeLookup.id))
      .leftJoin(users, assigneeJoinOn)
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
