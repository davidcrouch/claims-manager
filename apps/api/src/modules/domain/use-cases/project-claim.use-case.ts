import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { ClaimTransformer } from '../transformers/claim.transformer';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import { ContactSyncService } from '../services/contact-sync.service';
import { AssigneeSyncService } from '../services/assignee-sync.service';
import {
  ClaimsRepository,
  ExternalLinksRepository,
  type ClaimInsert,
} from '../../../database/repositories';
import { asString, isPlainObject } from '../transformers/transform-utils';

@Injectable()
export class ProjectClaimUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectClaimUseCase');

  constructor(
    private readonly transformer: ClaimTransformer,
    private readonly lookupResolution: LookupResolutionService,
    private readonly contactSync: ContactSyncService,
    private readonly assigneeSync: AssigneeSyncService,
    private readonly claimsRepo: ClaimsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
  ) {}

  async execute(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<ProjectionResult> {
    const { tenantId, connectionId, tx } = params;
    const payload = (params.externalObject.latestPayload ?? {}) as Record<string, unknown>;
    const externalObjectId = params.externalObject.id as string;

    this.logger.log(
      `ProjectClaimUseCase.execute — externalObjectId=${externalObjectId}`,
    );

    // 1. Check for existing entity
    const existingClaimId = await this.resolveExistingClaimId({
      tenantId,
      externalObjectId,
      payload,
      tx,
    });
    const existingEntity = existingClaimId
      ? await this.claimsRepo.findByIdAndTenant({ id: existingClaimId, tenantId })
      : null;

    // 2. Transform
    const result = this.transformer.transform({
      payload,
      tenantId,
      existingEntity: (existingEntity as ClaimInsert) ?? undefined,
    });

    if (result.skip) {
      this.logger.warn(`ProjectClaimUseCase.execute — skipped: ${result.skip}`);
      return { status: 'skipped', internalEntityId: '', internalEntityType: 'claim', reason: result.skip };
    }

    // 3. Resolve lookups
    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'claim',
      sourceEntityId: existingClaimId ?? undefined,
      tx,
    });
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    // 4. Upsert claim
    let claimId: string;
    if (existingClaimId) {
      await this.claimsRepo.update({ id: existingClaimId, data: result.entity, tx });
      claimId = existingClaimId;
    } else {
      const created = await this.claimsRepo.createIfNotExists({
        data: { tenantId, ...result.entity } as ClaimInsert,
        tx,
      });
      if (created) {
        claimId = created.id;
      } else {
        const racedId = await this.resolveExistingClaimId({ tenantId, externalObjectId, payload, tx });
        if (!racedId) {
          throw new Error(
            `ProjectClaimUseCase.execute — insert skipped by onConflictDoNothing but no existing row found`,
          );
        }
        this.logger.warn(
          `ProjectClaimUseCase.execute — lost race on claim insert; updating winner id=${racedId}`,
        );
        await this.claimsRepo.update({ id: racedId, data: result.entity, tx });
        claimId = racedId;
      }
    }

    // 5. Upsert external link
    await this.externalLinksRepo.upsert({
      data: {
        tenantId,
        externalObjectId,
        internalEntityType: 'claim',
        internalEntityId: claimId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    // 6. Sync contacts
    if (result.contacts && result.contacts.length > 0) {
      await this.contactSync.syncForEntity({
        entityType: 'claim',
        entityId: claimId,
        tenantId,
        contacts: result.contacts,
        strategy: 'additive',
        tx,
      });
    }

    // 7. Sync assignees
    if (result.assignees && result.assignees.length > 0) {
      await this.assigneeSync.syncForEntity({
        entityType: 'claim',
        entityId: claimId,
        tenantId,
        assignees: result.assignees,
        strategy: 'replace',
        tx,
      });
    }

    return { status: 'completed', internalEntityId: claimId, internalEntityType: 'claim' };
  }

  private async resolveExistingClaimId(params: {
    tenantId: string;
    externalObjectId: string;
    payload: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    // Check via external link
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId: params.externalObjectId,
      tx: params.tx,
    });
    const link = existingLinks.find((l) => l.internalEntityType === 'claim');
    if (link) return link.internalEntityId;

    // Check by externalReference
    const cwClaimId = asString(params.payload.id);
    if (cwClaimId) {
      const byExtRef = await this.claimsRepo.findByExternalReference({
        tenantId: params.tenantId,
        externalReference: cwClaimId,
        tx: params.tx,
      });
      if (byExtRef) return byExtRef.id;
    }

    // Check by claim number
    const claimNumber = asString(params.payload.claimNumber);
    if (claimNumber) {
      const byNumber = await this.claimsRepo.findByClaimNumber({
        tenantId: params.tenantId,
        claimNumber,
        tx: params.tx,
      });
      if (byNumber) return byNumber.id;
    }

    return null;
  }
}
