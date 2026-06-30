import { Injectable, Optional, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import type { Readable } from 'stream';
import { AttachmentsRepository, ExternalLinksRepository, ExternalObjectsRepository, type AttachmentInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger('AttachmentsService');

  constructor(
    private readonly attachmentsRepo: AttachmentsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
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

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    relatedRecordType?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.attachmentsRepo.findAll({ tenantId, ...params });
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

  async getDownloadStream(params: { id: string; inline?: boolean }): Promise<{
    stream: Readable;
    contentType: string;
    contentDisposition: string;
  } | null> {
    const tenantId = this.tenantContext.getTenantId();
    const attachment = await this.attachmentsRepo.findOne({ id: params.id, tenantId });
    if (!attachment) return null;

    const links = await this.externalLinksRepo.findByInternalEntity({
      internalEntityType: 'attachment',
      internalEntityId: params.id,
    });
    const link = links[0];
    if (!link) {
      throw new NotFoundException('AttachmentsService.getDownloadStream — no external link for attachment');
    }

    const extObj = await this.externalObjectsRepo.findById({ id: link.externalObjectId });
    if (!extObj) {
      throw new NotFoundException('AttachmentsService.getDownloadStream — external object not found');
    }

    const connectionId = extObj.connectionId;
    const cwAttachmentId = extObj.providerEntityId;
    const scopePrefix = attachment.relatedRecordType ?? 'Job';
    const scopedId = `${scopePrefix}-${cwAttachmentId}`;

    this.logger.debug(
      `AttachmentsService.getDownloadStream — proxying download for attachment=${params.id} scopedId=${scopedId}`,
    );

    this.crunchworkService.setConnectionResolver(this.connectionResolver!);
    const stream = await this.crunchworkService.downloadAttachmentStream({
      connectionId,
      attachmentId: scopedId,
    });

    const contentType = attachment.mimeType ?? 'application/octet-stream';
    const filename = this.resolveFilename(attachment, contentType);
    const disposition = params.inline ? 'inline' : 'attachment';
    const contentDisposition = `${disposition}; filename="${filename}"`;

    return { stream, contentType, contentDisposition };
  }

  private resolveFilename(
    attachment: { fileName?: string | null; title?: string | null; id: string },
    mimeType: string,
  ): string {
    const MIME_TO_EXT: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'text/plain': '.txt',
      'text/csv': '.csv',
      'text/html': '.html',
      'application/json': '.json',
      'application/xml': '.xml',
      'application/zip': '.zip',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    };

    const base = attachment.fileName ?? attachment.title ?? `attachment-${attachment.id}`;
    const hasExtension = /\.\w{2,5}$/.test(base);
    if (hasExtension) return base;

    const ext = MIME_TO_EXT[mimeType] ?? '';
    return `${base}${ext}`;
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
