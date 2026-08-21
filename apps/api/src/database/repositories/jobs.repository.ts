import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql, gte, ilike, or, inArray, notInArray, aliasedTable, getTableColumns } from 'drizzle-orm';
import { normalizeListUserIds, parseCsvFilterValues } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { jobs, lookupValues, vendors, integrationConnections, users } from '../schema';

const assigneeJoinOn = sql`${jobs.assignedToUserId} = ${users.id}::text`;

/** Matches frontend jobListRef: name ?? externalJobId ?? externalReference ?? id */
const jobDisplayRef = sql`COALESCE(${jobs.name}, ${jobs.externalJobId}, ${jobs.externalReference}, ${jobs.id}::text)`;

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
    case 'assignee_asc':
      return [asc(users.name)];
    case 'assignee_desc':
      return [desc(users.name)];
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
  assigneeName: string | null;
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
    /** Comma-separated status lookup IDs */
    status?: string;
    /** Comma-separated job type lookup IDs */
    jobType?: string;
    assignedToUserId?: string;
    assignedToUserIds?: string;
    /** Comma-separated display refs (name / externalJobId / externalReference / id) */
    refs?: string;
  }): Promise<{ data: JobViewRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const jobTypeLookup = aliasedTable(lookupValues, 'job_type_lookup');

    const statusIds = params.status
      ? params.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const jobTypeIds = params.jobType
      ? params.jobType
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

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
          ilike(jobs.name, term),
          ilike(jobs.externalReference, term),
          ilike(jobs.addressSuburb, term),
        )!,
      );
    }

    if (statusIds.length > 0) {
      whereParts.push(inArray(jobs.statusLookupId, statusIds));
    }

    if (jobTypeIds.length > 0) {
      whereParts.push(inArray(jobs.jobTypeLookupId, jobTypeIds));
    }

    const refs = parseCsvFilterValues(params.refs);
    if (refs) {
      if (refs.length === 0) {
        return { data: [], total: 0 };
      }
      whereParts.push(
        sql`${jobDisplayRef} IN (${sql.join(
          refs.map((ref) => sql`${ref}`),
          sql`, `,
        )})`,
      );
    }

    const assigneeIds = normalizeListUserIds({
      userId: params.assignedToUserId,
      userIds: params.assignedToUserIds,
    });
    if (assigneeIds) {
      if (assigneeIds.length === 0) {
        return { data: [], total: 0 };
      }
      const includeBlank = assigneeIds.includes('__blank__');
      const realIds = assigneeIds.filter((id) => id !== '__blank__');
      if (includeBlank && realIds.length > 0) {
        whereParts.push(
          or(isNull(jobs.assignedToUserId), inArray(jobs.assignedToUserId, realIds))!,
        );
      } else if (includeBlank) {
        whereParts.push(isNull(jobs.assignedToUserId));
      } else {
        whereParts.push(inArray(jobs.assignedToUserId, realIds));
      }
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
          assigneeName: users.name,
        })
        .from(jobs)
        .leftJoin(statusLookup, eq(jobs.statusLookupId, statusLookup.id))
        .leftJoin(jobTypeLookup, eq(jobs.jobTypeLookupId, jobTypeLookup.id))
        .leftJoin(vendors, eq(jobs.vendorId, vendors.id))
        .leftJoin(integrationConnections, eq(jobs.connectionId, integrationConnections.id))
        .leftJoin(users, assigneeJoinOn)
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

  async findFilterOptions(params: { tenantId: string }): Promise<{
    refs: string[];
    assignees: { id: string; name: string }[];
  }> {
    const tenantWhere = and(eq(jobs.tenantId, params.tenantId), isNull(jobs.deletedAt));

    const [refRows, assigneeRows] = await Promise.all([
      this.db
        .selectDistinct({ ref: jobDisplayRef })
        .from(jobs)
        .where(tenantWhere)
        .orderBy(asc(jobDisplayRef)),
      this.db
        .selectDistinct({ id: jobs.assignedToUserId, name: users.name })
        .from(jobs)
        .leftJoin(users, assigneeJoinOn)
        .where(
          and(
            tenantWhere,
            sql`${jobs.assignedToUserId} IS NOT NULL AND btrim(${jobs.assignedToUserId}) <> ''`,
          ),
        )
        .orderBy(asc(users.name)),
    ]);

    return {
      refs: refRows
        .map((r) => String(r.ref ?? '').trim())
        .filter(Boolean),
      assignees: assigneeRows
        .filter((r): r is { id: string; name: string | null } => !!r.id)
        .map((r) => ({ id: r.id, name: (r.name ?? '').trim() || r.id })),
    };
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
        assigneeName: users.name,
      })
      .from(jobs)
      .leftJoin(statusLookup, eq(jobs.statusLookupId, statusLookup.id))
      .leftJoin(jobTypeLookup, eq(jobs.jobTypeLookupId, jobTypeLookup.id))
      .leftJoin(vendors, eq(jobs.vendorId, vendors.id))
      .leftJoin(integrationConnections, eq(jobs.connectionId, integrationConnections.id))
      .leftJoin(users, assigneeJoinOn)
      .where(and(eq(jobs.id, params.id), eq(jobs.tenantId, params.tenantId)))
      .limit(1);
    return (row as JobViewRow) ?? null;
  }

  async findActiveForInbox(params: {
    tenantId: string;
    excludeStatusIds?: string[];
    claimIds?: string[];
    assignedToUserId?: string;
    limit?: number;
  }): Promise<{ data: JobViewRow[]; total: number }> {
    const limit = Math.min(params.limit ?? 12, 50);
    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const jobTypeLookup = aliasedTable(lookupValues, 'job_type_lookup');
    const excludeStatusIds = params.excludeStatusIds?.filter(Boolean) ?? [];
    const claimIds = params.claimIds?.filter(Boolean) ?? [];
    const assignedToUserId = params.assignedToUserId?.trim() || null;

    const whereParts = [
      eq(jobs.tenantId, params.tenantId),
      isNull(jobs.deletedAt),
    ];
    if (excludeStatusIds.length > 0) {
      whereParts.push(
        or(isNull(jobs.statusLookupId), notInArray(jobs.statusLookupId, excludeStatusIds))!,
      );
    }
    const mineParts = [];
    if (claimIds.length > 0) {
      mineParts.push(inArray(jobs.claimId, claimIds));
    }
    if (assignedToUserId) {
      mineParts.push(eq(jobs.assignedToUserId, assignedToUserId));
    }
    if (mineParts.length === 1) {
      whereParts.push(mineParts[0]);
    } else if (mineParts.length > 1) {
      whereParts.push(or(...mineParts)!);
    }
    const whereClause = and(...whereParts);

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
          assigneeName: users.name,
        })
        .from(jobs)
        .leftJoin(statusLookup, eq(jobs.statusLookupId, statusLookup.id))
        .leftJoin(jobTypeLookup, eq(jobs.jobTypeLookupId, jobTypeLookup.id))
        .leftJoin(vendors, eq(jobs.vendorId, vendors.id))
        .leftJoin(integrationConnections, eq(jobs.connectionId, integrationConnections.id))
        .leftJoin(users, assigneeJoinOn)
        .where(whereClause)
        .orderBy(desc(jobs.updatedAt))
        .limit(limit),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(whereClause),
    ]);

    return { data: data as JobViewRow[], total: countResult[0]?.count ?? 0 };
  }

  async findByIds(params: {
    tenantId: string;
    ids: string[];
  }): Promise<Array<Pick<JobRow, 'id' | 'name' | 'externalReference'>>> {
    const ids = [...new Set(params.ids.filter(Boolean))];
    if (ids.length === 0) return [];
    return this.db
      .select({
        id: jobs.id,
        name: jobs.name,
        externalReference: jobs.externalReference,
      })
      .from(jobs)
      .where(and(eq(jobs.tenantId, params.tenantId), inArray(jobs.id, ids)));
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

  async findJobsWithPassedAttendanceDate(params: {
    now: Date;
  }): Promise<Array<{
    id: string;
    tenantId: string;
    attendanceDate: string;
    customData: Record<string, unknown>;
  }>> {
    const rows = await this.db
      .select({
        id: jobs.id,
        tenantId: jobs.tenantId,
        customData: jobs.customData,
      })
      .from(jobs)
      .where(
        and(
          isNull(jobs.deletedAt),
          sql`${jobs.customData}->>'workflowPhase' = 'scheduled'`,
          sql`${jobs.customData}->>'attendanceDate' IS NOT NULL`,
          sql`(${jobs.customData}->>'attendanceDate')::timestamptz <= ${params.now}`,
          sql`(${jobs.customData}->>'attendanceDateEventEmitted') IS NULL`,
        ),
      );

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      attendanceDate: ((r.customData as Record<string, unknown>)?.attendanceDate ?? '') as string,
      customData: (r.customData ?? {}) as Record<string, unknown>,
    }));
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
