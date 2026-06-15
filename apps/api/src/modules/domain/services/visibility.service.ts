import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, sql, type SQL } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import { claimContacts, jobContacts } from '../../../database/schema';

export type VisibilityLevel = 'private' | 'org' | 'parties';

@Injectable()
export class VisibilityService {
  private readonly logger = new Logger('VisibilityService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Build a WHERE clause fragment for visibility filtering.
   * Used by repositories when reading associations.
   */
  buildVisibilityFilter(params: {
    tenantId: string;
    userId: string;
    includeParties?: boolean;
  }): SQL {
    if (params.includeParties) {
      return sql`(
        (visibility = 'org' AND tenant_id = ${params.tenantId})
        OR (visibility = 'private' AND created_by_user_id = ${params.userId})
        OR visibility = 'parties'
      )`;
    }

    return sql`(
      (visibility = 'org' AND tenant_id = ${params.tenantId})
      OR (visibility = 'private' AND created_by_user_id = ${params.userId})
    )`;
  }

  /**
   * Copy 'parties'-visible associations from a source entity to a recipient entity.
   * Copied associations become 'org' visibility in the recipient's context.
   */
  async copyPartiesAssociations(params: {
    sourceEntityType: string;
    sourceEntityId: string;
    targetEntityType: string;
    targetEntityId: string;
    targetTenantId: string;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx;

    // Copy claim_contacts where visibility = 'parties'
    if (params.sourceEntityType === 'claim' || params.targetEntityType === 'claim') {
      await this.copyClaimContacts(db, params);
    }

    // Copy job_contacts where visibility = 'parties'
    if (params.sourceEntityType === 'job' || params.targetEntityType === 'job') {
      await this.copyJobContacts(db, params);
    }

    this.logger.debug(
      `VisibilityService.copyPartiesAssociations — copied parties from ${params.sourceEntityType}:${params.sourceEntityId} → ${params.targetEntityType}:${params.targetEntityId}`,
    );
  }

  private async copyClaimContacts(
    db: DrizzleDbOrTx,
    params: {
      sourceEntityId: string;
      targetEntityId: string;
      targetTenantId: string;
    },
  ): Promise<void> {
    const sourceRows = await db
      .select()
      .from(claimContacts)
      .where(
        and(
          eq(claimContacts.claimId, params.sourceEntityId),
          eq(claimContacts.visibility, 'parties'),
        ),
      );

    for (const row of sourceRows) {
      await db
        .insert(claimContacts)
        .values({
          tenantId: params.targetTenantId,
          claimId: params.targetEntityId,
          contactId: row.contactId,
          sortIndex: row.sortIndex,
          visibility: 'org',
          sourcePayload: row.sourcePayload ?? {},
        })
        .onConflictDoNothing();
    }
  }

  private async copyJobContacts(
    db: DrizzleDbOrTx,
    params: {
      sourceEntityId: string;
      targetEntityId: string;
      targetTenantId: string;
    },
  ): Promise<void> {
    const sourceRows = await db
      .select()
      .from(jobContacts)
      .where(
        and(
          eq(jobContacts.jobId, params.sourceEntityId),
          eq(jobContacts.visibility, 'parties'),
        ),
      );

    for (const row of sourceRows) {
      await db
        .insert(jobContacts)
        .values({
          tenantId: params.targetTenantId,
          jobId: params.targetEntityId,
          contactId: row.contactId,
          sortIndex: row.sortIndex,
          visibility: 'org',
          sourcePayload: row.sourcePayload ?? {},
        })
        .onConflictDoNothing();
    }
  }
}
