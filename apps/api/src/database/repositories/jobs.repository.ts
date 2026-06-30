import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql, gte, ilike, or, aliasedTable, getTableColumns } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { jobs, lookupValues, vendors, integrationConnections } from '../schema';

function buildJobOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(jobs.updatedAt)];
    case 'created_at_desc':
      return [desc(jobs.createdAt)];
    case 'created_at_asc':
      return [asc(jobs.createdAt)];
    case 'external_reference_asc':
      return [asc(jobs.externalReference)];
    case 'external_reference_desc':
      return [desc(jobs.externalReference)];
    case 'request_date_asc':
      return [asc(jobs.requestDate)];
    case 'request_date_desc':
      return [desc(jobs.requestDate)];
    case 'address_asc':
      return [asc(jobs.addressSuburb)];
    case 'address_desc':
      return [desc(jobs.addressSuburb)];
    case 'updated_at_desc':
    default:
      return [desc(jobs.updatedAt)];
  }
}

export type JobRow = typeof jobs.$inferSelect;
export type JobInsert = typeof jobs.$inferInsert;

export interface JobViewRow extends JobRow {
  statusName: string | null;
  statusExternalReference: string | null;
  jobTypeName: string | null;
  jobTypeExternalReference: string | null;
  vendorName: string | null;
  vendorExternalReference: string | null;
  connectionProviderCode: string | null;
}

@Injectable()
export class JobsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    claimId?: string;
    sort?: string;
    search?: string;
  }): Promise<{ data: JobViewRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const jobTypeLookup = aliasedTable(lookupValues, 'job_type_lookup');

    const whereParts = [
      eq(jobs.tenantId, params.tenantId),
      isNull(jobs.deletedAt),
    ];

    if (params.claimId) {
      whereParts.push(eq(jobs.claimId, params.claimId));
    }

    if (params.search) {
      const term = `%${params.search}%`;
      whereParts.push(
        or(
          ilike(jobs.externalReference, term),
          ilike(jobs.addressSuburb, term),
        )!,
      );
    }

    const whereClause = and(...whereParts);

    let orderBy;
    switch (params.sort) {
      case 'status_asc':
        orderBy = [asc(statusLookup.name)];
        break;
      case 'status_desc':
        orderBy = [desc(statusLookup.name)];
        break;
      case 'job_type_asc':
        orderBy = [asc(jobTypeLookup.name)];
        break;
      case 'job_type_desc':
        orderBy = [desc(jobTypeLookup.name)];
        break;
      default:
        orderBy = buildJobOrderBy(params.sort);
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          ...this.jobColumns(),
          statusName: statusLookup.name,
          statusExternalReference: statusLookup.externalReference,
          jobTypeName: jobTypeLookup.name,
          jobTypeExternalReference: jobTypeLookup.externalReference,
          vendorName: vendors.name,
          vendorExternalReference: vendors.externalReference,
          connectionProviderCode: integrationConnections.providerCode,
        })
        .from(jobs)
        .leftJoin(statusLookup, eq(jobs.statusLookupId, statusLookup.id))
        .leftJoin(jobTypeLookup, eq(jobs.jobTypeLookupId, jobTypeLookup.id))
        .leftJoin(vendors, eq(jobs.vendorId, vendors.id))
        .leftJoin(integrationConnections, eq(jobs.connectionId, integrationConnections.id))
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data: data as JobViewRow[], total };
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<JobViewRow | null> {
    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const jobTypeLookup = aliasedTable(lookupValues, 'job_type_lookup');

    const [row] = await this.db
      .select({
        ...this.jobColumns(),
        statusName: statusLookup.name,
        statusExternalReference: statusLookup.externalReference,
        jobTypeName: jobTypeLookup.name,
        jobTypeExternalReference: jobTypeLookup.externalReference,
        vendorName: vendors.name,
        vendorExternalReference: vendors.externalReference,
        connectionProviderCode: integrationConnections.providerCode,
      })
      .from(jobs)
      .leftJoin(statusLookup, eq(jobs.statusLookupId, statusLookup.id))
      .leftJoin(jobTypeLookup, eq(jobs.jobTypeLookupId, jobTypeLookup.id))
      .leftJoin(vendors, eq(jobs.vendorId, vendors.id))
      .leftJoin(integrationConnections, eq(jobs.connectionId, integrationConnections.id))
      .where(and(eq(jobs.id, params.id), eq(jobs.tenantId, params.tenantId)))
      .limit(1);
    return (row as JobViewRow) ?? null;
  }

  async findByIdAndTenant(params: {
    id: string;
    tenantId: string;
  }): Promise<JobRow | null> {
    const [row] = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    data: JobInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<JobRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(jobs).values(params.data).returning();
    return inserted;
  }

  /**
   * Race-safe insert. Returns the inserted row, or `null` if the unique
   * constraint on `(tenant_id, external_reference)` already held a row
   * (concurrent writer won the race). Callers should re-read by
   * `findByExternalReference` when `null` is returned and switch to update.
   */
  async createIfNotExists(params: {
    data: JobInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<JobRow | null> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(jobs)
      .values(params.data)
      .onConflictDoNothing()
      .returning();
    return inserted ?? null;
  }

  async findByExternalReference(params: {
    tenantId: string;
    externalReference: string;
    tx?: DrizzleDbOrTx;
  }): Promise<JobRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, params.tenantId),
          eq(jobs.externalReference, params.externalReference),
          isNull(jobs.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async update(params: {
    id: string;
    data: Partial<JobInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<JobRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(jobs)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(jobs.id, params.id))
      .returning();
    return updated ?? null;
  }

  async countByTenant(params: { tenantId: string }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.tenantId, params.tenantId));
    return r?.count ?? 0;
  }

  async countByTenantSince(params: {
    tenantId: string;
    since: Date;
  }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, params.tenantId),
          gte(jobs.createdAt, params.since),
        ),
      );
    return r?.count ?? 0;
  }

  async countByStatusGrouped(params: {
    tenantId: string;
  }): Promise<{ status: string; count: string }[]> {
    const result = await this.db
      .select({
        status: sql<string>`COALESCE(${lookupValues.name}, 'Unknown')`.as(
          'status',
        ),
        count: sql<string>`COUNT(*)::text`.as('count'),
      })
      .from(jobs)
      .leftJoin(lookupValues, eq(jobs.statusLookupId, lookupValues.id))
      .where(and(eq(jobs.tenantId, params.tenantId), isNull(jobs.deletedAt)))
      .groupBy(sql`COALESCE(${lookupValues.name}, 'Unknown')`);
    return result as { status: string; count: string }[];
  }

  private jobColumns() {
    return getTableColumns(jobs);
  }
}
