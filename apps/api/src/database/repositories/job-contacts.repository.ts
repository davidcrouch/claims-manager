import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, aliasedTable, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { jobContacts, jobs, lookupValues } from '../schema';

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
