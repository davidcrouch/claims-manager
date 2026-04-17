import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { claimContacts } from '../schema';

export type ClaimContactRow = typeof claimContacts.$inferSelect;
export type ClaimContactInsert = typeof claimContacts.$inferInsert;

@Injectable()
export class ClaimContactsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByClaim(params: {
    claimId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimContactRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(claimContacts)
      .where(eq(claimContacts.claimId, params.claimId));
  }

  /**
   * Idempotent upsert keyed on `(claim_id, contact_id)` — matches the
   * `UQ_claim_contact` unique index. Updates `sort_index` and
   * `source_payload` on conflict so re-processing a newer CW payload keeps
   * the denormalised display data in sync.
   */
  async upsert(params: {
    data: ClaimContactInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimContactRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(claimContacts)
      .values(params.data)
      .onConflictDoUpdate({
        target: [claimContacts.claimId, claimContacts.contactId],
        set: {
          sortIndex: params.data.sortIndex ?? 0,
          sourcePayload: params.data.sourcePayload ?? {},
        },
      })
      .returning();
    return row;
  }

  async deleteByClaimAndContact(params: {
    claimId: string;
    contactId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    await db
      .delete(claimContacts)
      .where(
        and(
          eq(claimContacts.claimId, params.claimId),
          eq(claimContacts.contactId, params.contactId),
        ),
      );
  }
}
