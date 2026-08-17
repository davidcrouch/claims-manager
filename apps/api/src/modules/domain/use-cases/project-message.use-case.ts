import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { MessageTransformer } from '../transformers/message.transformer';
import { ExternalObjectService } from '../../external/external-object.service';
import { ParentNotProjectedError } from '../../external/errors/parent-not-projected.error';
import { jobs } from '../../../database/schema';
import {
  MessagesRepository,
  ExternalLinksRepository,
  type MessageInsert,
} from '../../../database/repositories';

@Injectable()
export class ProjectMessageUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectMessageUseCase');

  constructor(
    private readonly transformer: MessageTransformer,
    private readonly externalObjectService: ExternalObjectService,
    private readonly messagesRepo: MessagesRepository,
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

    this.logger.log(`ProjectMessageUseCase.execute — externalObjectId=${externalObjectId}`);

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'message');

    // 2. Transform
    const result = this.transformer.transform({ payload, tenantId });

    // 3. Resolve from/to parents via ExternalObjectService
    const fieldMap: Record<string, string> = {
      fromJob: 'fromJobId', toJob: 'toJobId',
      fromClaim: 'fromClaimId', toClaim: 'toClaimId',
    };
    const entity = result.entity as Record<string, unknown>;

    for (const ref of result.parentRefs) {
      const providerEntityType = ref.entityType === 'fromJob' || ref.entityType === 'toJob' ? 'job' : 'claim';
      const internalId = await this.externalObjectService.resolveInternalEntityId({
        connectionId,
        providerEntityType,
        providerEntityId: ref.externalId,
        internalEntityType: providerEntityType,
        tx,
      });
      if (internalId) {
        entity[fieldMap[ref.entityType]] = internalId;
      }
    }

    // 4. Fallback: derive missing claim refs from resolved jobs.
    // A job should not exist without its parent claim, so we can look it up.
    if (!entity.fromClaimId && !entity.fromJobId) {
      const resolvedJobId = (entity.toJobId ?? entity.fromJobId) as string | undefined;
      if (resolvedJobId) {
        const [job] = await tx
          .select({ claimId: jobs.claimId })
          .from(jobs)
          .where(eq(jobs.id, resolvedJobId))
          .limit(1);
        if (job?.claimId) {
          entity.fromClaimId = job.claimId;
          this.logger.debug(
            `ProjectMessageUseCase.execute — derived fromClaimId=${job.claimId} from job=${resolvedJobId}`,
          );
        }
      }
    }

    // If still no "from" reference, the message can't satisfy the DB constraint
    if (!entity.fromClaimId && !entity.fromJobId) {
      const unresolvedFrom = result.parentRefs.find(
        (r) => r.entityType === 'fromClaim' || r.entityType === 'fromJob',
      );
      if (unresolvedFrom) {
        const providerEntityType = unresolvedFrom.entityType.startsWith('from') ? 
          (unresolvedFrom.entityType === 'fromJob' ? 'job' : 'claim') : 'claim';
        throw new ParentNotProjectedError(
          'message',
          externalObjectId,
          [{
            internalEntityType: providerEntityType,
            providerEntityType,
            providerEntityId: unresolvedFrom.externalId,
          }],
          `Message ${externalObjectId} requires at least one "from" parent to be projected`,
        );
      }
      return { status: 'skipped', reason: 'no_from_parent', internalEntityType: 'message' };
    }

    // 5. Upsert
    let messageId: string;
    if (existingLink) {
      await this.messagesRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<MessageInsert>,
        tx,
      });
      messageId = existingLink.internalEntityId;
    } else {
      const created = await this.messagesRepo.create({
        data: { tenantId, ...result.entity, originType: 'provider' } as MessageInsert,
        tx,
      });
      messageId = created.id;

      await this.externalLinksRepo.upsert({
        data: {
          tenantId,
          externalObjectId,
          internalEntityType: 'message',
          internalEntityId: messageId,
          linkRole: 'source',
          isPrimary: true,
          metadata: {},
        },
        tx,
      });
    }

    return { status: 'completed', internalEntityId: messageId, internalEntityType: 'message' };
  }
}
