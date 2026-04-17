import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { AttachmentsRepository, type AttachmentInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly attachmentsRepo: AttachmentsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.attachmentsRepo.findOne({ id: params.id, tenantId });
  }

  async findByRelatedRecord(params: {
    relatedRecordType: string;
    relatedRecordId: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.attachmentsRepo.findByRelatedRecord({
      tenantId,
      relatedRecordType: params.relatedRecordType,
      relatedRecordId: params.relatedRecordId,
    });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiAttachment = await this.crunchworkService.createAttachment({
      connectionId,
      body: params.body,
    });

    const apiObj = apiAttachment as Record<string, unknown>;
    const insertData: AttachmentInsert = {
      tenantId,
      relatedRecordType: (apiObj.relatedRecordType ?? params.body?.relatedRecordType) as string,
      relatedRecordId: (apiObj.relatedRecordId ?? params.body?.relatedRecordId) as string,
      title: apiObj.title as string,
      description: apiObj.description as string,
      fileName: apiObj.fileName as string,
      mimeType: apiObj.mimeType as string,
      fileUrl: apiObj.fileUrl as string,
      apiPayload: apiAttachment as Record<string, unknown>,
    };
    return this.attachmentsRepo.create({ data: insertData });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiAttachment = await this.crunchworkService.updateAttachment({
      connectionId,
      attachmentId: params.id,
      body: params.body,
    });

    const apiObj = apiAttachment as Record<string, unknown>;
    return this.attachmentsRepo.update({
      id: params.id,
      data: {
        apiPayload: apiAttachment as Record<string, unknown>,
        title: (apiObj.title as string) ?? existing.title,
        description: (apiObj.description as string) ?? existing.description,
      },
    });
  }
}
