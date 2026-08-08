import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, notInArray, isNull, or, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { claimAssignees } from '../schema';

export type ClaimAssigneeRow = typeof claimAssignees.$inferSelect;
export type ClaimAssigneeInsert = typeof claimAssignees.$inferInsert;

/**
 * `claim_assignees` has no unique index on `(claim_id, external_reference)`
 * in the current schema (see `apps/api/src/database/schema/index.ts`), so we
 * implement the upsert as a read-then-insert/update inside the caller's
 * transaction. That is safe because the webhook orchestrator always runs
 * mapper work inside a single SERIALIZABLE-compatible transaction.
 */
@Injectable()
export class ClaimAssigneesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findClaimIdsByAssignee(params: {
    tenantId: string;
    userId?: string | null;
    email?: string | null;
  }): Promise<string[]> {
    const userId = params.userId?.trim() || null;
    const email = params.email?.trim().toLowerCase() || null;
    if (!userId && !email) return [];

    const identityParts = [];
    if (userId) identityParts.push(eq(claimAssignees.userId, userId));
    if (email) identityParts.push(ilike(claimAssignees.email, email));
    const identityClause = identityParts.length === 1 ? identityParts[0] : or(...identityParts);

    const rows = await this.db
      .selectDistinct({ claimId: claimAssignees.claimId })
      .from(claimAssignees)
      .where(and(eq(claimAssignees.tenantId, params.tenantId), identityClause));
    return rows.map((r) => r.claimId);
  }

  async findByClaim(params: {
    claimId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimAssigneeRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(claimAssignees)
      .where(eq(claimAssignees.claimId, params.claimId));
  }

  async findByClaimAndExternalRef(params: {
    claimId: string;
    externalReference: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimAssigneeRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(claimAssignees)
      .where(
        and(
          eq(claimAssignees.claimId, params.claimId),
          eq(claimAssignees.externalReference, params.externalReference),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsertByExternalRef(params: {
    data: ClaimAssigneeInsert & { externalReference: string };
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimAssigneeRow> {
    const db = params.tx ?? this.db;
    const existing = await this.findByClaimAndExternalRef({
      claimId: params.data.claimId,
      externalReference: params.data.externalReference,
      tx: params.tx,
    });

    if (existing) {
      const [updated] = await db
        .update(claimAssignees)
        .set({
          assigneeTypeLookupId: params.data.assigneeTypeLookupId,
          userId: params.data.userId,
          displayName: params.data.displayName,
          email: params.data.email,
          assigneePayload: params.data.assigneePayload ?? {},
          updatedAt: new Date(),
        })
        .where(eq(claimAssignees.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(claimAssignees)
      .values(params.data)
      .returning();
    return inserted;
  }

  /**
   * Authoritative sync: delete claim_assignees for `claimId` whose
   * `external_reference` is NOT in `keepExternalRefs` (and rows with a null
   * external_reference, which are stale artefacts). Used to prune assignees
   * that have dropped off the latest CW payload — per docs/mapping/claims.md
   * §7.2 the CW payload is the source of truth for assignment state.
   */
  async pruneNotInExternalRefs(params: {
    claimId: string;
    keepExternalRefs: string[];
    tx?: DrizzleDbOrTx;
  }): Promise<number> {
    const db = params.tx ?? this.db;
    const predicate =
      params.keepExternalRefs.length > 0
        ? and(
            eq(claimAssignees.claimId, params.claimId),
            or(
              isNull(claimAssignees.externalReference),
              notInArray(
                claimAssignees.externalReference,
                params.keepExternalRefs,
              ),
            ),
          )
        : eq(claimAssignees.claimId, params.claimId);

    const deleted = await db
      .delete(claimAssignees)
      .where(predicate)
      .returning({ id: claimAssignees.id });
    return deleted.length;
  }

  async findInExternalRefs(params: {
    claimId: string;
    externalRefs: string[];
    tx?: DrizzleDbOrTx;
  }): Promise<ClaimAssigneeRow[]> {
    if (params.externalRefs.length === 0) return [];
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(claimAssignees)
      .where(
        and(
          eq(claimAssignees.claimId, params.claimId),
          inArray(claimAssignees.externalReference, params.externalRefs),
        ),
      );
  }
}
