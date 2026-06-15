import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { MessageTransformer } from '../transformers/message.transformer';
import { ExternalObjectService } from '../../external/external-object.service';
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
        const fieldMap: Record<string, string> = {
          fromJob: 'fromJobId', toJob: 'toJobId',
          fromClaim: 'fromClaimId', toClaim: 'toClaimId',
        };
        (result.entity as Record<string, unknown>)[fieldMap[ref.entityType]] = internalId;
      }
    }

    // 4. Upsert
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
        data: { tenantId, ...result.entity } as MessageInsert,
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
