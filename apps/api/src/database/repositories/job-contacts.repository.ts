import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, aliasedTable, desc, sql, notExists, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { contacts, jobContacts, jobs, lookupValues } from '../schema';

export type JobContactRow = typeof jobContacts.$inferSelect;
export type JobContactInsert = typeof jobContacts.$inferInsert;

export type ContactRelatedJobRow = {
  jobId: string;
  name: string | null;
  externalReference: string | null;
  addressSuburb: string | null;
  addressState: string | null;
  statusName: string | null;
  jobTypeName: string | null;
  sourcePayload: Record<string, unknown>;
  updatedAt: Date;
};

@Injectable()
export class JobContactsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByJob(params: { jobId: string; tx?: DrizzleDbOrTx }): Promise<JobContactRow[]> {
    const db = params.tx ?? this.db;
    return db.select().from(jobContacts).where(eq(jobContacts.jobId, params.jobId));
  }

  /**
   * Distinct jobs that have at least one contact link (for list column filters).
   */
  async findJobsWithContacts(params: {
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<Array<{ id: string; name: string | null; externalReference: string | null }>> {
    const db = params.tx ?? this.db;
    const rows = await db
      .select({
        id: jobs.id,
        name: jobs.name,
        externalReference: jobs.externalReference,
      })
      .from(jobContacts)
      .innerJoin(jobs, eq(jobs.id, jobContacts.jobId))
      .where(
        and(
          eq(jobContacts.tenantId, params.tenantId),
          eq(jobs.tenantId, params.tenantId),
          isNull(jobs.deletedAt),
        ),
      )
      .groupBy(jobs.id, jobs.name, jobs.externalReference)
      .orderBy(jobs.name);

    return rows;
  }

  async findJobsForContactIds(params: {
    tenantId: string;
    contactIds: string[];
    tx?: DrizzleDbOrTx;
  }): Promise<
    Record<string, Array<{ id: string; name: string | null; externalReference: string | null }>>
  > {
    if (params.contactIds.length === 0) return {};
    const db = params.tx ?? this.db;
    const rows = await db
      .select({
        contactId: jobContacts.contactId,
        id: jobs.id,
        name: jobs.name,
        externalReference: jobs.externalReference,
      })
      .from(jobContacts)
      .innerJoin(jobs, eq(jobs.id, jobContacts.jobId))
      .where(
        and(
          eq(jobContacts.tenantId, params.tenantId),
          inArray(jobContacts.contactId, params.contactIds),
          isNull(jobs.deletedAt),
        ),
      )
      .orderBy(jobs.name);

    const out: Record<
      string,
      Array<{ id: string; name: string | null; externalReference: string | null }>
    > = {};
    for (const row of rows) {
      const list = out[row.contactId] ?? (out[row.contactId] = []);
      list.push({
        id: row.id,
        name: row.name,
        externalReference: row.externalReference,
      });
    }
    return out;
  }

  async countUnlinkedContacts(params: {
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<number> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, params.tenantId),
          notExists(
            db
              .select({ one: sql`1` })
              .from(jobContacts)
              .where(
                and(
                  eq(jobContacts.contactId, contacts.id),
                  eq(jobContacts.tenantId, params.tenantId),
                ),
              ),
          ),
        ),
      );
    return row?.count ?? 0;
  }

  async findJobsByContact(params: {
    contactId: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRelatedJobRow[]> {
    const db = params.tx ?? this.db;
    const statusLookup = aliasedTable(lookupValues, 'job_status_lookup');
    const typeLookup = aliasedTable(lookupValues, 'job_type_lookup');

    const rows = await db
      .select({
        jobId: jobs.id,
        name: jobs.name,
        externalReference: jobs.externalReference,
        addressSuburb: jobs.addressSuburb,
        addressState: jobs.addressState,
        statusName: statusLookup.name,
        jobTypeName: typeLookup.name,
        sourcePayload: jobContacts.sourcePayload,
        updatedAt: jobs.updatedAt,
      })
      .from(jobContacts)
      .innerJoin(jobs, eq(jobs.id, jobContacts.jobId))
      .leftJoin(statusLookup, eq(jobs.statusLookupId, statusLookup.id))
      .leftJoin(typeLookup, eq(jobs.jobTypeLookupId, typeLookup.id))
      .where(
        and(
          eq(jobContacts.contactId, params.contactId),
          eq(jobContacts.tenantId, params.tenantId),
          isNull(jobs.deletedAt),
        ),
      )
      .orderBy(desc(jobs.updatedAt));

    return rows.map((row) => ({
      ...row,
      sourcePayload:
        row.sourcePayload && typeof row.sourcePayload === 'object' && !Array.isArray(row.sourcePayload)
          ? (row.sourcePayload as Record<string, unknown>)
          : {},
    }));
  }

  async upsert(params: { data: JobContactInsert; tx?: DrizzleDbOrTx }): Promise<JobContactRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(jobContacts)
      .values(params.data)
      .onConflictDoUpdate({
        target: [jobContacts.jobId, jobContacts.contactId],
        set: {
          sortIndex: params.data.sortIndex ?? 0,
          sourcePayload: params.data.sourcePayload ?? {},
        },
      })
      .returning();
    return row;
  }

  async deleteByJobAndContact(params: {
    jobId: string;
    contactId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    await db
      .delete(jobContacts)
      .where(
        and(eq(jobContacts.jobId, params.jobId), eq(jobContacts.contactId, params.contactId)),
      );
  }
}
