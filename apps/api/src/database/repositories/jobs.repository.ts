import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql, gte, ilike, or, inArray, notInArray, ne, aliasedTable, getTableColumns, exists } from 'drizzle-orm';
import { normalizeListUserIds, parseCsvFilterValues } from '../../common/list-job-filter';
import { addressSearchText, parseSearchTokens } from '../../common/address-search';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import {
  claimContacts,
  jobs,
  lookupValues,
  vendors,
  integrationConnections,
  users,
  quotes,
  invoices,
  workOrders,
  rfqs,
  proposals,
  purchaseOrders,
  bills,
  tasks,
  appointments,
  messages,
  assessments,
  journals,
  journalEntityLinks,
  jobContacts,
  contacts,
  documents,
} from '../schema';
import {
  jobRelatedCountValue,
  type JobRelatedCounts,
} from '../../common/job-related-counts';

export type { JobRelatedCounts };

const assigneeJoinOn = sql`${jobs.assignedToUserId} = ${users.id}::text`;

/** Matches frontend jobListRef: internalNumber ?? name ?? externalJobId ?? externalReference ?? id */
const jobDisplayRef = sql`COALESCE(${jobs.internalNumber}, ${jobs.name}, ${jobs.externalJobId}, ${jobs.externalReference}, ${jobs.id}::text)`;

/** Matches job overview "Insurer reference". */
const jobInsurerRef = sql`COALESCE(
  NULLIF(${jobs.customData}->>'insurerExternalReference', ''),
  NULLIF(${jobs.apiPayload}->>'externalReference', '')
)`;

const jobAddressSearchText = addressSearchText({
  address: jobs.address,
  suburb: jobs.addressSuburb,
  state: jobs.addressState,
  postcode: jobs.addressPostcode,
  country: jobs.addressCountry,
});

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
    case 'external_job_id_asc':
      return [asc(jobInsurerRef)];
    case 'external_job_id_desc':
      return [desc(jobInsurerRef)];
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

export type ClaimJobSummary = {
  id: string;
  claimId: string | null;
  internalNumber: string | null;
  name: string | null;
  externalJobId: string | null;
  externalReference: string | null;
  jobTypeLookupId: string;
  jobTypeName: string | null;
};

export type JobInsuredNameRow = {
  jobId: string;
  insuredName: string;
};

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

    if (params.search?.trim()) {
      const tokens = parseSearchTokens(params.search);
      if (tokens.length > 0) {
        whereParts.push(
          and(
            ...tokens.map((token) => {
              const pattern = `%${token}%`;
              const jobInsuredMatch = or(
                exists(
                  this.db
                    .select({ one: sql`1` })
                    .from(jobContacts)
                    .innerJoin(contacts, eq(jobContacts.contactId, contacts.id))
                    .innerJoin(
                      lookupValues,
                      and(
                        eq(lookupValues.tenantId, params.tenantId),
                        eq(lookupValues.domain, 'contact_type'),
                        sql`lower(coalesce(${lookupValues.name}, '')) = 'insured'`,
                        or(
                          eq(contacts.typeLookupId, lookupValues.id),
                          sql`${contacts.contactPayload}->'typeLookupIds' ? ${lookupValues.id}::text`,
                        ),
                      ),
                    )
                    .where(
                      and(
                        eq(jobContacts.jobId, jobs.id),
                        eq(jobContacts.tenantId, params.tenantId),
                        or(
                          ilike(contacts.firstName, pattern),
                          ilike(contacts.lastName, pattern),
                          sql`lower(concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})) like ${pattern.toLowerCase()}`,
                        ),
                      ),
                    ),
                ),
                exists(
                  this.db
                    .select({ one: sql`1` })
                    .from(claimContacts)
                    .innerJoin(contacts, eq(claimContacts.contactId, contacts.id))
                    .innerJoin(
                      lookupValues,
                      and(
                        eq(lookupValues.tenantId, params.tenantId),
                        eq(lookupValues.domain, 'contact_type'),
                        sql`lower(coalesce(${lookupValues.name}, '')) = 'insured'`,
                        or(
                          eq(contacts.typeLookupId, lookupValues.id),
                          sql`${contacts.contactPayload}->'typeLookupIds' ? ${lookupValues.id}::text`,
                        ),
                      ),
                    )
                    .where(
                      and(
                        eq(claimContacts.claimId, jobs.claimId),
                        eq(claimContacts.tenantId, params.tenantId),
                        or(
                          ilike(contacts.firstName, pattern),
                          ilike(contacts.lastName, pattern),
                          sql`lower(concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})) like ${pattern.toLowerCase()}`,
                        ),
                      ),
                    ),
                ),
              );
              return or(
                sql`${jobDisplayRef} ilike ${pattern}`,
                ilike(jobs.internalNumber, pattern),
                ilike(jobs.name, pattern),
                ilike(jobs.externalJobId, pattern),
                ilike(jobs.externalReference, pattern),
                sql`${jobInsurerRef} ilike ${pattern}`,
                sql`${jobAddressSearchText} ilike ${pattern}`,
                jobInsuredMatch,
              )!;
            }),
          )!,
        );
      }
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
    /** Match CW job assignees snapshotted in custom_data.assignees[].email */
    assigneeEmail?: string;
    limit?: number;
  }): Promise<{ data: JobViewRow[]; total: number }> {
    const limit = Math.min(params.limit ?? 12, 50);
    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const jobTypeLookup = aliasedTable(lookupValues, 'job_type_lookup');
    const excludeStatusIds = params.excludeStatusIds?.filter(Boolean) ?? [];
    const claimIds = params.claimIds?.filter(Boolean) ?? [];
    const assignedToUserId = params.assignedToUserId?.trim() || null;
    const assigneeEmail = params.assigneeEmail?.trim().toLowerCase() || null;

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
    if (assigneeEmail) {
      // CW job assignees live in custom_data.assignees (no job_assignees table yet).
      mineParts.push(
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(${jobs.customData}->'assignees', '[]'::jsonb)) AS assignee
          WHERE lower(btrim(assignee->>'email')) = ${assigneeEmail}
        )`,
      );
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
  }): Promise<
    Array<
      Pick<JobRow, 'id' | 'internalNumber' | 'name' | 'externalJobId' | 'externalReference'> & {
        jobTypeName: string | null;
      }
    >
  > {
    const ids = [...new Set(params.ids.filter(Boolean))];
    if (ids.length === 0) return [];
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
      .from(jobs)
      .leftJoin(jobTypeLookup, eq(jobs.jobTypeLookupId, jobTypeLookup.id))
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

  /**
   * Returns an existing internal number for any job sharing the same insurer
   * reference (`external_job_id`), e.g. when CW creates Make Safe + Works jobs
   * under one insurer ref.
   */
  async findInternalNumberByExternalJobId(params: {
    tenantId: string;
    externalJobId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    const trimmed = params.externalJobId.trim();
    if (!trimmed) return null;

    const db = params.tx ?? this.db;
    const [row] = await db
      .select({ internalNumber: jobs.internalNumber })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, params.tenantId),
          eq(jobs.externalJobId, trimmed),
          isNull(jobs.deletedAt),
          sql`${jobs.internalNumber} IS NOT NULL`,
        ),
      )
      .orderBy(asc(jobs.createdAt))
      .limit(1);
    const internalNumber = row?.internalNumber?.trim();
    return internalNumber || null;
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

  async findSummariesByClaimIds(params: {
    tenantId: string;
    claimIds: string[];
  }): Promise<ClaimJobSummary[]> {
    const claimIds = params.claimIds.filter(Boolean);
    if (claimIds.length === 0) return [];

    const jobTypeLookup = aliasedTable(lookupValues, 'job_type_lookup');
    const rows = await this.db
      .select({
        id: jobs.id,
        claimId: jobs.claimId,
        internalNumber: jobs.internalNumber,
        name: jobs.name,
        externalJobId: jobs.externalJobId,
        externalReference: jobs.externalReference,
        jobTypeLookupId: jobs.jobTypeLookupId,
        jobTypeName: jobTypeLookup.name,
      })
      .from(jobs)
      .leftJoin(jobTypeLookup, eq(jobs.jobTypeLookupId, jobTypeLookup.id))
      .where(
        and(
          eq(jobs.tenantId, params.tenantId),
          isNull(jobs.deletedAt),
          inArray(jobs.claimId, claimIds),
        ),
      )
      .orderBy(desc(jobs.createdAt), asc(jobTypeLookup.name));

    return rows;
  }

  /**
   * Primary insured/client display name per job (first Insured-typed job contact by sortIndex).
   */
  async findInsuredNamesByJobIds(params: {
    tenantId: string;
    jobIds: string[];
  }): Promise<JobInsuredNameRow[]> {
    const jobIds = params.jobIds.filter(Boolean);
    if (jobIds.length === 0) return [];

    const rows = await this.db
      .select({
        jobId: jobContacts.jobId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        sortIndex: jobContacts.sortIndex,
      })
      .from(jobContacts)
      .innerJoin(contacts, eq(jobContacts.contactId, contacts.id))
      .innerJoin(
        lookupValues,
        and(
          eq(lookupValues.tenantId, params.tenantId),
          eq(lookupValues.domain, 'contact_type'),
          sql`lower(coalesce(${lookupValues.name}, '')) = 'insured'`,
          or(
            eq(contacts.typeLookupId, lookupValues.id),
            sql`${contacts.contactPayload}->'typeLookupIds' ? ${lookupValues.id}::text`,
          ),
        ),
      )
      .where(
        and(
          eq(jobContacts.tenantId, params.tenantId),
          inArray(jobContacts.jobId, jobIds),
        ),
      )
      .orderBy(asc(jobContacts.sortIndex), asc(contacts.lastName), asc(contacts.firstName));

    const byJob = new Map<string, string>();
    for (const row of rows) {
      if (byJob.has(row.jobId)) continue;
      const name = [row.firstName, row.lastName]
        .map((part) => part?.trim())
        .filter((part): part is string => !!part)
        .join(' ');
      if (name) byJob.set(row.jobId, name);
    }

    return [...byJob.entries()].map(([jobId, insuredName]) => ({
      jobId,
      insuredName,
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

  async countRelatedByJob(params: {
    tenantId: string;
    jobId: string;
  }): Promise<JobRelatedCounts> {
    const { tenantId, jobId } = params;

    const [
      journalsRow,
      assessmentsRow,
      quotesRow,
      workOrdersRow,
      invoicesRow,
      rfqsRow,
      proposalsRow,
      purchaseOrdersRow,
      billsRow,
      tasksRow,
      scheduleResult,
      messagesRow,
      appointmentsRow,
      contactsRow,
      documentsRow,
    ] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(distinct ${journals.id})::int` })
        .from(journals)
        .innerJoin(journalEntityLinks, eq(journalEntityLinks.journalId, journals.id))
        .where(
          and(
            eq(journals.tenantId, tenantId),
            isNull(journals.deletedAt),
            ne(journals.status, 'deleted'),
            eq(journalEntityLinks.tenantId, tenantId),
            eq(journalEntityLinks.entityType, 'Job'),
            eq(journalEntityLinks.entityId, jobId),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(assessments)
        .where(
          and(
            eq(assessments.tenantId, tenantId),
            eq(assessments.jobId, jobId),
            isNull(assessments.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotes)
        .where(
          and(
            eq(quotes.tenantId, tenantId),
            eq(quotes.jobId, jobId),
            isNull(quotes.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.tenantId, tenantId),
            eq(workOrders.jobId, jobId),
            isNull(workOrders.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.jobId, jobId),
            eq(invoices.isDeleted, false),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(rfqs)
        .where(
          and(
            eq(rfqs.tenantId, tenantId),
            eq(rfqs.jobId, jobId),
            isNull(rfqs.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(proposals)
        .where(
          and(
            eq(proposals.tenantId, tenantId),
            eq(proposals.jobId, jobId),
            isNull(proposals.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.tenantId, tenantId),
            eq(purchaseOrders.jobId, jobId),
            isNull(purchaseOrders.deletedAt),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(bills)
        .where(
          and(
            eq(bills.tenantId, tenantId),
            eq(bills.jobId, jobId),
            eq(bills.isDeleted, false),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(eq(tasks.tenantId, tenantId), eq(tasks.jobId, jobId)))
        .then((rows) => rows[0]),
      this.db.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count
        FROM schedule_events
        WHERE tenant_id = ${tenantId}::uuid
          AND job_id = ${jobId}::uuid
      `),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            eq(messages.tenantId, tenantId),
            or(eq(messages.fromJobId, jobId), eq(messages.toJobId, jobId)),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(eq(appointments.tenantId, tenantId), eq(appointments.jobId, jobId)),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(distinct ${contacts.id})::int` })
        .from(contacts)
        .innerJoin(jobContacts, eq(jobContacts.contactId, contacts.id))
        .where(
          and(
            eq(contacts.tenantId, tenantId),
            eq(jobContacts.tenantId, tenantId),
            eq(jobContacts.jobId, jobId),
          ),
        )
        .then((rows) => rows[0]),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(
          and(
            eq(documents.tenantId, tenantId),
            isNull(documents.archivedAt),
            sql`(
              ${documents.relatedRecordId} = ${jobId}
              OR ${documents.filesystemId} IN (
                SELECT id FROM filesystem
                WHERE tenant_id = ${tenantId}::uuid
                  AND kind = 'project'
                  AND job_id = ${jobId}::uuid
                  AND archived_at IS NULL
              )
            )`,
          ),
        )
        .then((rows) => rows[0]),
    ]);

    const scheduleRows =
      (scheduleResult as unknown as { rows?: Array<{ count: number }> }).rows ?? [];

    return {
      journals: jobRelatedCountValue(journalsRow),
      assessments: jobRelatedCountValue(assessmentsRow),
      quotes: jobRelatedCountValue(quotesRow),
      workOrders: jobRelatedCountValue(workOrdersRow),
      invoices: jobRelatedCountValue(invoicesRow),
      rfqs: jobRelatedCountValue(rfqsRow),
      proposals: jobRelatedCountValue(proposalsRow),
      purchaseOrders: jobRelatedCountValue(purchaseOrdersRow),
      bills: jobRelatedCountValue(billsRow),
      tasks: jobRelatedCountValue(tasksRow),
      schedule: jobRelatedCountValue(scheduleRows[0]),
      messages: jobRelatedCountValue(messagesRow),
      appointments: jobRelatedCountValue(appointmentsRow),
      contacts: jobRelatedCountValue(contactsRow),
      documents: jobRelatedCountValue(documentsRow),
    };
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
