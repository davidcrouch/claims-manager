import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { JobTransformer } from '../transformers/job.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import { ContactSyncService } from '../services/contact-sync.service';
import {
  JobsRepository,
  ExternalLinksRepository,
  type JobInsert,
} from '../../../database/repositories';

@Injectable()
export class ProjectJobUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectJobUseCase');

  constructor(
    private readonly transformer: JobTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly lookupResolution: LookupResolutionService,
    private readonly contactSync: ContactSyncService,
    private readonly jobsRepo: JobsRepository,
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
      `ProjectJobUseCase.execute — externalObjectId=${externalObjectId}`,
    );

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx,
    });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'job');
    const existingEntity = existingLink
      ? await this.jobsRepo.findByIdAndTenant({ id: existingLink.internalEntityId, tenantId })
      : null;

    // 2. Transform
    const result = this.transformer.transform({
      payload,
      tenantId,
      existingEntity: (existingEntity as JobInsert) ?? undefined,
    });

    if (result.skip) {
      this.logger.warn(`ProjectJobUseCase.execute — skipped: ${result.skip}`);
      return { status: 'skipped', internalEntityId: '', internalEntityType: 'job', reason: result.skip };
    }

    // 3. Resolve parents
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    if (resolvedParents.claim) result.entity.claimId = resolvedParents.claim;
    if (resolvedParents.vendor) result.entity.vendorId = resolvedParents.vendor;

    // Record which provider connection created this job
    result.entity.connectionId = connectionId;

    // Claim is required for job creation
    if (!existingEntity && !result.entity.claimId) {
      throw new Error(
        `ProjectJobUseCase.execute — cannot create job ${externalObjectId}: no claimId resolved`,
      );
    }

    // 4. Resolve lookups
    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'job',
      sourceEntityId: existingEntity?.id,
      tx,
    });
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    // jobTypeLookupId is NOT NULL — block creation if unresolved
    if (!existingEntity && !resolvedLookups['jobTypeLookupId'] && !existingEntity) {
      throw new Error(
        `ProjectJobUseCase.execute — cannot create job ${externalObjectId}: jobType unresolved and column is NOT NULL`,
      );
    }

    // 5. Upsert job
    let jobId: string;
    if (existingEntity) {
      await this.jobsRepo.update({ id: existingEntity.id, data: result.entity, tx });
      jobId = existingEntity.id;
    } else {
      const created = await this.jobsRepo.createIfNotExists({
        data: result.entity as JobInsert,
        tx,
      });
      if (created) {
        jobId = created.id;
      } else {
        const raced = await this.jobsRepo.findByExternalReference({
          tenantId,
          externalReference: result.entity.externalReference!,
          tx,
        });
        if (!raced) {
          throw new Error(
            `ProjectJobUseCase.execute — insert skipped but no existing row found`,
          );
        }
        this.logger.warn(
          `ProjectJobUseCase.execute — lost race on job insert; updating winner id=${raced.id}`,
        );
        await this.jobsRepo.update({ id: raced.id, data: result.entity, tx });
        jobId = raced.id;
      }
    }

    // 6. Upsert external link
    await this.externalLinksRepo.upsert({
      data: {
        tenantId,
        externalObjectId,
        internalEntityType: 'job',
        internalEntityId: jobId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    // 7. Sync contacts
    if (result.contacts && result.contacts.length > 0) {
      await this.contactSync.syncForEntity({
        entityType: 'job',
        entityId: jobId,
        tenantId,
        contacts: result.contacts,
        strategy: 'additive',
        tx,
      });
    }

    return { status: 'completed', internalEntityId: jobId, internalEntityType: 'job' };
  }
}
