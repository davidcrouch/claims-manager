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
  aliasedTable,
  getTableColumns,
  exists,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { addressSearchText, parseSearchTokens } from '../../common/address-search';
import {
  claimContacts,
  claimAssignees,
  claims,
  contacts,
  jobs,
  lookupValues,
} from '../schema';

const claimAddressSearchText = addressSearchText({
  address: claims.address,
  suburb: claims.addressSuburb,
  state: claims.addressState,
  postcode: claims.addressPostcode,
  country: claims.addressCountry,
});

/** Matches frontend jobDisplayName: internalNumber ?? name ?? externalJobId ?? externalReference ?? id */
const claimJobDisplayRef = sql`COALESCE(${jobs.internalNumber}, ${jobs.name}, ${jobs.externalJobId}, ${jobs.externalReference}, ${jobs.id}::text)`;

export type ClaimRow = typeof claims.$inferSelect;
export type ClaimInsert = typeof claims.$inferInsert;

export interface ClaimViewRow extends ClaimRow {
  statusName: string | null;
  statusExternalReference: string | null;
  accountName: string | null;
  accountExternalReference: string | null;
}

export type ClaimInsuredNameRow = {
  claimId: string;
  insuredName: string;
};

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
    /** Comma-separated status lookup IDs */
    status?: string;
    /** Comma-separated account lookup IDs */
    account?: string;
    /** Comma-separated job type lookup IDs (matches any job on the claim) */
    jobType?: string;
    assignedToUserId?: string;
  }): Promise<{ data: ClaimViewRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const accountLookup = aliasedTable(lookupValues, 'account_lookup');

    const statusIds = params.status
      ? params.status
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const accountIds = params.account
      ? params.account
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

    const searchTokens = parseSearchTokens(params.search);
    const searchClause =
      searchTokens.length > 0
        ? and(
            ...searchTokens.map((token) => {
              const pattern = `%${token}%`;
              const jobMatch = exists(
                this.db
                  .select({ one: sql`1` })
                  .from(jobs)
                  .where(
                    and(
                      eq(jobs.claimId, claims.id),
                      eq(jobs.tenantId, params.tenantId),
                      isNull(jobs.deletedAt),
                      or(
                        sql`${claimJobDisplayRef} ilike ${pattern}`,
                        ilike(jobs.internalNumber, pattern),
                        ilike(jobs.name, pattern),
                        ilike(jobs.externalJobId, pattern),
                        ilike(jobs.externalReference, pattern),
                      ),
                    ),
                  ),
              );
              const insuredContactMatch = exists(
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
                      eq(claimContacts.claimId, claims.id),
                      eq(claimContacts.tenantId, params.tenantId),
                      or(
                        ilike(contacts.firstName, pattern),
                        ilike(contacts.lastName, pattern),
                        sql`lower(concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})) like ${pattern.toLowerCase()}`,
                      ),
                    ),
                  ),
              );
              return or(
                ilike(claims.claimNumber, pattern),
                ilike(claims.externalReference, pattern),
                ilike(claims.policyNumber, pattern),
                sql`${claimAddressSearchText} ilike ${pattern}`,
                ilike(claims.postalAddress, pattern),
                jobMatch,
                insuredContactMatch,
              )!;
            }),
          )
        : undefined;

    const statusClause =
      statusIds.length > 0
        ? inArray(claims.statusLookupId, statusIds)
        : undefined;
    const accountClause =
      accountIds.length > 0
        ? inArray(claims.accountLookupId, accountIds)
        : undefined;
    const jobTypeClause =
      jobTypeIds.length > 0
        ? exists(
            this.db
              .select({ one: sql`1` })
              .from(jobs)
              .where(
                and(
                  eq(jobs.claimId, claims.id),
                  eq(jobs.tenantId, params.tenantId),
                  isNull(jobs.deletedAt),
                  inArray(jobs.jobTypeLookupId, jobTypeIds),
                ),
              ),
          )
        : undefined;

    const assignedToUserId = params.assignedToUserId?.trim() || null;
    const assigneeClause = assignedToUserId
      ? exists(
          this.db
            .select({ one: sql`1` })
            .from(claimAssignees)
            .where(
              and(
                eq(claimAssignees.claimId, claims.id),
                eq(claimAssignees.tenantId, params.tenantId),
                eq(claimAssignees.userId, assignedToUserId),
              ),
            ),
        )
      : undefined;

    const whereParts = [
      eq(claims.tenantId, params.tenantId),
      isNull(claims.deletedAt),
      ...(searchClause ? [searchClause] : []),
      ...(statusClause ? [statusClause] : []),
      ...(accountClause ? [accountClause] : []),
      ...(jobTypeClause ? [jobTypeClause] : []),
      ...(assigneeClause ? [assigneeClause] : []),
    ];
    const whereClause = and(...whereParts);

    const orderBy = buildOrderBy(params.sort);

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          ...getTableColumns(claims),
          statusName: statusLookup.name,
          statusExternalReference: statusLookup.externalReference,
          accountName: accountLookup.name,
          accountExternalReference: accountLookup.externalReference,
        })
        .from(claims)
        .leftJoin(statusLookup, eq(claims.statusLookupId, statusLookup.id))
        .leftJoin(accountLookup, eq(claims.accountLookupId, accountLookup.id))
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
    return { data: data as ClaimViewRow[], total };
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<ClaimViewRow | null> {
    const statusLookup = aliasedTable(lookupValues, 'status_lookup');
    const accountLookup = aliasedTable(lookupValues, 'account_lookup');

    const [row] = await this.db
      .select({
        ...getTableColumns(claims),
        statusName: statusLookup.name,
        statusExternalReference: statusLookup.externalReference,
        accountName: accountLookup.name,
        accountExternalReference: accountLookup.externalReference,
      })
      .from(claims)
      .leftJoin(statusLookup, eq(claims.statusLookupId, statusLookup.id))
      .leftJoin(accountLookup, eq(claims.accountLookupId, accountLookup.id))
      .where(
        and(eq(claims.id, params.id), eq(claims.tenantId, params.tenantId)),
      )
      .limit(1);
    return (row as ClaimViewRow) ?? null;
  }

  async findByIdAndTenant(params: {
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

  /**
   * Primary insured/client display name per claim (first Insured-typed contact by sortIndex).
   * Matches contact_type lookups named "Insured" via typeLookupId or contactPayload.typeLookupIds.
   */
  async findInsuredNamesByClaimIds(params: {
    tenantId: string;
    claimIds: string[];
  }): Promise<ClaimInsuredNameRow[]> {
    const claimIds = params.claimIds.filter(Boolean);
    if (claimIds.length === 0) return [];

    const rows = await this.db
      .select({
        claimId: claimContacts.claimId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        sortIndex: claimContacts.sortIndex,
      })
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
          eq(claimContacts.tenantId, params.tenantId),
          inArray(claimContacts.claimId, claimIds),
        ),
      )
      .orderBy(asc(claimContacts.sortIndex), asc(contacts.lastName), asc(contacts.firstName));

    const byClaim = new Map<string, string>();
    for (const row of rows) {
      if (byClaim.has(row.claimId)) continue;
      const name = [row.firstName, row.lastName]
        .map((part) => part?.trim())
        .filter((part): part is string => !!part)
        .join(' ');
      if (name) byClaim.set(row.claimId, name);
    }

    return [...byClaim.entries()].map(([claimId, insuredName]) => ({
      claimId,
      insuredName,
    }));
  }

  async countByTenant(params: { tenantId: string }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(claims)
      .where(eq(claims.tenantId, params.tenantId));
    return r?.count ?? 0;
  }
}
