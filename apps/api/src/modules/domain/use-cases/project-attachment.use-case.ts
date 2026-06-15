import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { AttachmentTransformer } from '../transformers/attachment.transformer';
import { ExternalObjectService } from '../../external/external-object.service';
import {
  AttachmentsRepository,
  ExternalLinksRepository,
  type AttachmentInsert,
} from '../../../database/repositories';

@Injectable()
export class ProjectAttachmentUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectAttachmentUseCase');

  constructor(
    private readonly transformer: AttachmentTransformer,
    private readonly externalObjectService: ExternalObjectService,
    private readonly attachmentsRepo: AttachmentsRepository,
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

    this.logger.log(`ProjectAttachmentUseCase.execute — externalObjectId=${externalObjectId}`);

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'attachment');

    // 2. Transform
    const result = this.transformer.transform({ payload, tenantId });

    // 3. Resolve scoped parent via ExternalObjectService
    for (const ref of result.parentRefs) {
      const internalId = await this.externalObjectService.resolveInternalEntityId({
        connectionId,
        providerEntityType: ref.entityType,
        providerEntityId: ref.externalId,
        internalEntityType: ref.entityType,
        tx,
      });
      if (internalId) {
        (result.entity as Record<string, unknown>).relatedRecordId = internalId;
      }
    }

    // Default relatedRecordId if unresolved
    if (!(result.entity as Record<string, unknown>).relatedRecordId) {
      (result.entity as Record<string, unknown>).relatedRecordId = '00000000-0000-0000-0000-000000000000';
    }

    // 4. Upsert
    let attachmentId: string;
    if (existingLink) {
      await this.attachmentsRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<AttachmentInsert>,
        tx,
      });
      attachmentId = existingLink.internalEntityId;
    } else {
      const created = await this.attachmentsRepo.create({
        data: { tenantId, ...result.entity } as AttachmentInsert,
        tx,
      });
      attachmentId = created.id;

      await this.externalLinksRepo.upsert({
        data: {
          tenantId,
          externalObjectId,
          internalEntityType: 'attachment',
          internalEntityId: attachmentId,
          linkRole: 'source',
          isPrimary: true,
          metadata: {},
        },
        tx,
      });
    }

    return { status: 'completed', internalEntityId: attachmentId, internalEntityType: 'attachment' };
  }
}
