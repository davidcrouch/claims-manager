import { Injectable, Logger } from '@nestjs/common';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import type { RawAssignee } from '../transformers/transformer.interface';
import {
  ClaimAssigneesRepository,
  type ClaimAssigneeInsert,
} from '../../../database/repositories';
import { LookupResolutionService } from './lookup-resolution.service';
import { nameFromLookup } from '../transformers/transform-utils';

/**
 * Manages assignee sync for entities. Currently only claims have assignees,
 * but the service is generic for future use on jobs and tasks.
 */
@Injectable()
export class AssigneeSyncService {
  private readonly logger = new Logger('AssigneeSyncService');

  constructor(
    private readonly claimAssigneesRepo: ClaimAssigneesRepository,
    private readonly lookupResolution: LookupResolutionService,
  ) {}

  async syncForEntity(params: {
    entityType: string;
    entityId: string;
    tenantId: string;
    assignees: RawAssignee[];
    strategy: 'additive' | 'replace';
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    if (params.entityType !== 'claim') {
      this.logger.warn(
        `AssigneeSyncService.syncForEntity — unsupported entityType=${params.entityType}`,
      );
      return;
    }

    const keepExternalRefs: string[] = [];

    for (const raw of params.assignees) {
      if (!raw.externalReference) continue;

      let typeLookupId: string | undefined;
      if (raw.assigneeTypeField) {
        const resolved = await this.lookupResolution.resolveField({
          tenantId: params.tenantId,
          domain: raw.assigneeTypeDomain ?? 'assignee_type',
          field: raw.assigneeTypeField,
          tx: params.tx,
        });
        typeLookupId = resolved ?? undefined;
      }

      const data: ClaimAssigneeInsert & { externalReference: string } = {
        tenantId: params.tenantId,
        claimId: params.entityId,
        externalReference: raw.externalReference,
        displayName: raw.displayName,
        email: raw.email,
        assigneeTypeLookupId: typeLookupId,
        assigneePayload: {
          typeName: nameFromLookup(raw.assigneeTypeField),
          raw: raw.sourcePayload,
        },
      };

      await this.claimAssigneesRepo.upsertByExternalRef({ data, tx: params.tx });
      keepExternalRefs.push(raw.externalReference);
    }

    // Prune stale assignees when using replace strategy
    if (params.strategy === 'replace') {
      const pruned = await this.claimAssigneesRepo.pruneNotInExternalRefs({
        claimId: params.entityId,
        keepExternalRefs,
        tx: params.tx,
      });
      if (pruned > 0) {
        this.logger.log(
          `AssigneeSyncService.syncForEntity — pruned ${pruned} stale assignee rows from ${params.entityType}Id=${params.entityId}`,
        );
      }
    }
  }
}
