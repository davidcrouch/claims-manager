import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { jobContacts } from '../schema';

export type JobContactRow = typeof jobContacts.$inferSelect;
export type JobContactInsert = typeof jobContacts.$inferInsert;

@Injectable()
export class JobContactsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByJob(params: { jobId: string; tx?: DrizzleDbOrTx }): Promise<JobContactRow[]> {
    const db = params.tx ?? this.db;
    return db.select().from(jobContacts).where(eq(jobContacts.jobId, params.jobId));
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
