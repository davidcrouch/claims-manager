import {
  Injectable,
  Optional,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Readable } from 'stream';
import {
  AttachmentsRepository,
  DocumentsRepository,
  ExternalLinksRepository,
  ExternalObjectsRepository,
  JobsRepository,
  QuotesRepository,
  InvoicesRepository,
  type AttachmentInsert,
  type AttachmentRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';

const SUPPORTED_PARENT_TYPES = new Set(['Job', 'Quote', 'Invoice']);

type AttachmentMeta = Record<string, unknown> & {
  pendingCrunchworkSync?: boolean;
  documentTypeExternalReference?: string;
};

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger('AttachmentsService');

  constructor(
    private readonly attachmentsRepo: AttachmentsRepository,
    private readonly documentsRepo: DocumentsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly quotesRepo: QuotesRepository,
    private readonly invoicesRepo: InvoicesRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly gcsStorage: GcsStorageService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) {
      throw new BadRequestException(
        'AttachmentsService.resolveConnectionId — ConnectionResolverService not available',
      );
    }
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

    const contentType = attachment.mimeType ?? 'application/octet-stream';
    const filename = this.resolveFilename(attachment, contentType);
    const disposition = params.inline ? 'inline' : 'attachment';
    const contentDisposition = `${disposition}; filename="${filename}"`;

    const links = await this.externalLinksRepo.findByInternalEntity({
      internalEntityType: 'attachment',
      internalEntityId: params.id,
    });
    const link = links[0];

    // Local-only (not yet pushed to CW): stream from the source document in GCS.
    if (!link) {
      if (!attachment.sourceDocumentId) {
        throw new NotFoundException(
          'AttachmentsService.getDownloadStream — no external link or source document for attachment',
        );
      }
      const doc = await this.documentsRepo.findOne(attachment.sourceDocumentId, tenantId);
      if (!doc?.gcsObjectPath) {
        throw new NotFoundException(
          'AttachmentsService.getDownloadStream — source document not found',
        );
      }
      this.logger.debug(
        `AttachmentsService.getDownloadStream — local GCS stream for attachment=${params.id} document=${doc.id}`,
      );
      return {
        stream: this.gcsStorage.getReadStream(doc.gcsObjectPath),
        contentType: doc.mimeType || contentType,
        contentDisposition,
      };
    }

    const extObj = await this.externalObjectsRepo.findById({ id: link.externalObjectId });
    if (!extObj) {
      throw new NotFoundException(
        'AttachmentsService.getDownloadStream — external object not found',
      );
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

  private asMeta(value: unknown): AttachmentMeta {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as AttachmentMeta;
    }
    return {};
  }

  private async tryResolveCwParentId(params: {
    tenantId: string;
    relatedRecordType: string;
    relatedRecordId: string;
  }): Promise<string | null> {
    const logPrefix = 'AttachmentsService.tryResolveCwParentId';
    const { tenantId, relatedRecordType, relatedRecordId } = params;

    if (relatedRecordType === 'Job') {
      const job = await this.jobsRepo.findByIdAndTenant({ id: relatedRecordId, tenantId });
      if (!job) throw new NotFoundException(`${logPrefix} — job not found`);
      const cwId = (job.externalReference ?? job.externalJobId ?? '').trim();
      return cwId || null;
    }

    if (relatedRecordType === 'Quote') {
      const quote = await this.quotesRepo.findOne({ id: relatedRecordId, tenantId });
      if (!quote) throw new NotFoundException(`${logPrefix} — quote not found`);
      const cwId = (quote.externalReference ?? '').trim();
      return cwId || null;
    }

    if (relatedRecordType === 'Invoice') {
      const invoice = await this.invoicesRepo.findOne({ id: relatedRecordId, tenantId });
      if (!invoice) throw new NotFoundException(`${logPrefix} — invoice not found`);
      const cwId = (invoice.sourceExternalReference ?? '').trim();
      return cwId || null;
    }

    throw new BadRequestException(
      `${logPrefix} — unsupported relatedRecordType=${relatedRecordType}`,
    );
  }

  private async linkExternalAttachment(params: {
    tenantId: string;
    connectionId: string;
    attachmentId: string;
    cwAttachmentId: string;
    apiAttachment: Record<string, unknown>;
  }): Promise<void> {
    const { row: extObj } = await this.externalObjectsRepo.upsert({
      data: {
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        providerCode: 'crunchwork',
        providerEntityType: 'attachment',
        providerEntityId: params.cwAttachmentId,
        normalizedEntityType: 'attachment',
        latestPayload: params.apiAttachment,
        payloadHash: `create-${params.cwAttachmentId}`,
        fetchStatus: 'fetched',
        lastFetchedAt: new Date(),
        metadata: {},
      },
    });
    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId: extObj.id,
        internalEntityType: 'attachment',
        internalEntityId: params.attachmentId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
    });
  }

  private async pushAttachmentToCrunchwork(params: {
    tenantId: string;
    connectionId: string;
    attachment: AttachmentRow;
    cwRelatedRecordId: string;
  }): Promise<void> {
    const logPrefix = 'AttachmentsService.pushAttachmentToCrunchwork';
    const { tenantId, connectionId, attachment, cwRelatedRecordId } = params;
    const meta = this.asMeta(attachment.attachmentMeta);

    if (!attachment.sourceDocumentId) {
      throw new BadRequestException(
        `${logPrefix} — attachment ${attachment.id} has no sourceDocumentId`,
      );
    }
    const doc = await this.documentsRepo.findOne(attachment.sourceDocumentId, tenantId);
    if (!doc?.gcsObjectPath) {
      throw new NotFoundException(
        `${logPrefix} — source document missing for attachment=${attachment.id}`,
      );
    }

    const fileBuffer = await this.gcsStorage.downloadBuffer(doc.gcsObjectPath);
    const title = attachment.title?.trim() || doc.fileName;
    const documentTypeExternalReference =
      typeof meta.documentTypeExternalReference === 'string'
        ? meta.documentTypeExternalReference
        : undefined;

    this.logger.log(
      `${logPrefix} — attachment=${attachment.id} document=${doc.id} → CW ${attachment.relatedRecordType}/${cwRelatedRecordId}`,
    );

    this.crunchworkService.setConnectionResolver(this.connectionResolver!);
    const apiAttachment = await this.crunchworkService.createAttachment({
      connectionId,
      file: fileBuffer,
      fileName: attachment.fileName || doc.fileName,
      mimeType: attachment.mimeType || doc.mimeType || 'application/octet-stream',
      relatedRecordType: attachment.relatedRecordType,
      relatedRecordId: cwRelatedRecordId,
      title,
      description: attachment.description ?? undefined,
      documentTypeExternalReference,
    });

    const apiObj = apiAttachment as Record<string, unknown>;
    const cwAttachmentId = typeof apiObj.id === 'string' ? apiObj.id : undefined;
    const nextMeta: AttachmentMeta = { ...meta };
    delete nextMeta.pendingCrunchworkSync;

    await this.attachmentsRepo.update({
      id: attachment.id,
      data: {
        title: (typeof apiObj.title === 'string' ? apiObj.title : undefined) ?? title,
        description:
          (typeof apiObj.description === 'string' ? apiObj.description : undefined) ??
          attachment.description,
        fileName:
          (typeof apiObj.fileName === 'string'
            ? apiObj.fileName
            : typeof apiObj.filename === 'string'
              ? apiObj.filename
              : undefined) ?? attachment.fileName,
        mimeType:
          (typeof apiObj.mimeType === 'string' ? apiObj.mimeType : undefined) ??
          attachment.mimeType,
        fileSize:
          typeof apiObj.size === 'number'
            ? apiObj.size
            : typeof apiObj.fileSize === 'number'
              ? apiObj.fileSize
              : attachment.fileSize,
        fileUrl:
          (typeof apiObj.url === 'string'
            ? apiObj.url
            : typeof apiObj.fileUrl === 'string'
              ? apiObj.fileUrl
              : undefined) ?? attachment.fileUrl,
        apiPayload: apiAttachment as Record<string, unknown>,
        attachmentMeta: nextMeta,
      },
    });

    if (cwAttachmentId) {
      await this.linkExternalAttachment({
        tenantId,
        connectionId,
        attachmentId: attachment.id,
        cwAttachmentId,
        apiAttachment: apiAttachment as Record<string, unknown>,
      });
    }
  }

  /**
   * Push local-only attachments to Crunchwork once the parent entity has a CW id.
   * Safe to call repeatedly; only rows with pendingCrunchworkSync=true are processed.
   */
  async pushPendingForRelatedRecord(params: {
    tenantId: string;
    relatedRecordType: string;
    relatedRecordId: string;
  }): Promise<{ pushed: number; failed: number }> {
    const logPrefix = 'AttachmentsService.pushPendingForRelatedRecord';
    const relatedRecordType = params.relatedRecordType.trim();
    if (!SUPPORTED_PARENT_TYPES.has(relatedRecordType)) {
      return { pushed: 0, failed: 0 };
    }

    const cwRelatedRecordId = await this.tryResolveCwParentId({
      tenantId: params.tenantId,
      relatedRecordType,
      relatedRecordId: params.relatedRecordId,
    });
    if (!cwRelatedRecordId) {
      this.logger.debug(
        `${logPrefix} — skip ${relatedRecordType}/${params.relatedRecordId}: still no CW id`,
      );
      return { pushed: 0, failed: 0 };
    }

    const pending = await this.attachmentsRepo.findPendingCrunchworkSync({
      tenantId: params.tenantId,
      relatedRecordType,
      relatedRecordId: params.relatedRecordId,
    });
    if (pending.length === 0) return { pushed: 0, failed: 0 };

    const connectionId = await this.resolveConnectionId(params.tenantId);
    let pushed = 0;
    let failed = 0;

    for (const attachment of pending) {
      try {
        await this.pushAttachmentToCrunchwork({
          tenantId: params.tenantId,
          connectionId,
          attachment,
          cwRelatedRecordId,
        });
        pushed += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `${logPrefix} — failed attachment=${attachment.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(
      `${logPrefix} — ${relatedRecordType}/${params.relatedRecordId} pushed=${pushed} failed=${failed}`,
    );
    return { pushed, failed };
  }

  /**
   * Attach a project-repository document to Job/Quote/Invoice.
   * If the parent is already synced to CW, upload immediately.
   * Otherwise store locally with pendingCrunchworkSync and push after parent sync.
   */
  async createFromDocument(params: {
    documentId: string;
    relatedRecordType: string;
    relatedRecordId: string;
    title?: string;
    description?: string;
    documentTypeExternalReference?: string;
    userId?: string;
  }) {
    const logPrefix = 'AttachmentsService.createFromDocument';
    const tenantId = this.tenantContext.getTenantId();
    const relatedRecordType = params.relatedRecordType.trim();

    if (!SUPPORTED_PARENT_TYPES.has(relatedRecordType)) {
      throw new BadRequestException(
        `${logPrefix} — relatedRecordType must be Job, Quote, or Invoice`,
      );
    }

    const doc = await this.documentsRepo.findOne(params.documentId, tenantId);
    if (!doc) {
      throw new NotFoundException(`${logPrefix} — document not found`);
    }
    if (!doc.gcsObjectPath) {
      throw new BadRequestException(`${logPrefix} — document has no storage path`);
    }

    const title = params.title?.trim() || doc.fileName;
    const cwRelatedRecordId = await this.tryResolveCwParentId({
      tenantId,
      relatedRecordType,
      relatedRecordId: params.relatedRecordId,
    });

    if (!cwRelatedRecordId) {
      this.logger.log(
        `${logPrefix} — parent ${relatedRecordType}/${params.relatedRecordId} not synced; storing local-only pending push document=${doc.id}`,
      );
      const meta: AttachmentMeta = {
        pendingCrunchworkSync: true,
        ...(params.documentTypeExternalReference
          ? { documentTypeExternalReference: params.documentTypeExternalReference }
          : {}),
      };
      return this.attachmentsRepo.create({
        data: {
          tenantId,
          relatedRecordType,
          relatedRecordId: params.relatedRecordId,
          sourceDocumentId: doc.id,
          title,
          description: params.description ?? null,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileSize: doc.fileSizeBytes ?? null,
          fileUrl: null,
          attachmentMeta: meta,
          apiPayload: {},
          originType: 'user',
          createdByUserId: params.userId ?? null,
          updatedByUserId: params.userId ?? null,
        },
      });
    }

    const connectionId = await this.resolveConnectionId(tenantId);
    this.crunchworkService.setConnectionResolver(this.connectionResolver!);

    this.logger.log(
      `${logPrefix} — document=${doc.id} → CW ${relatedRecordType}/${cwRelatedRecordId} file=${doc.fileName}`,
    );

    const fileBuffer = await this.gcsStorage.downloadBuffer(doc.gcsObjectPath);
    const apiAttachment = await this.crunchworkService.createAttachment({
      connectionId,
      file: fileBuffer,
      fileName: doc.fileName,
      mimeType: doc.mimeType || 'application/octet-stream',
      relatedRecordType,
      relatedRecordId: cwRelatedRecordId,
      title,
      description: params.description,
      documentTypeExternalReference: params.documentTypeExternalReference,
    });

    const apiObj = apiAttachment as Record<string, unknown>;
    const cwAttachmentId = typeof apiObj.id === 'string' ? apiObj.id : undefined;
    const created = await this.attachmentsRepo.create({
      data: {
        tenantId,
        relatedRecordType,
        relatedRecordId: params.relatedRecordId,
        sourceDocumentId: doc.id,
        title: (typeof apiObj.title === 'string' ? apiObj.title : undefined) ?? title,
        description:
          (typeof apiObj.description === 'string' ? apiObj.description : undefined) ??
          params.description ??
          null,
        fileName:
          (typeof apiObj.fileName === 'string'
            ? apiObj.fileName
            : typeof apiObj.filename === 'string'
              ? apiObj.filename
              : undefined) ?? doc.fileName,
        mimeType:
          (typeof apiObj.mimeType === 'string' ? apiObj.mimeType : undefined) ?? doc.mimeType,
        fileSize:
          typeof apiObj.size === 'number'
            ? apiObj.size
            : typeof apiObj.fileSize === 'number'
              ? apiObj.fileSize
              : (doc.fileSizeBytes ?? null),
        fileUrl:
          (typeof apiObj.url === 'string'
            ? apiObj.url
            : typeof apiObj.fileUrl === 'string'
              ? apiObj.fileUrl
              : undefined) ?? null,
        apiPayload: apiAttachment as Record<string, unknown>,
        originType: 'user',
        createdByUserId: params.userId ?? null,
        updatedByUserId: params.userId ?? null,
      },
    });

    if (cwAttachmentId) {
      try {
        await this.linkExternalAttachment({
          tenantId,
          connectionId,
          attachmentId: created.id,
          cwAttachmentId,
          apiAttachment: apiAttachment as Record<string, unknown>,
        });
      } catch (err) {
        this.logger.warn(
          `${logPrefix} — failed to link external object for attachment=${created.id}: ${(err as Error).message}`,
        );
      }
    }

    return created;
  }

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    throw new BadRequestException(
      'AttachmentsService.create — use POST /attachments/from-document to attach a project document',
    );
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    this.crunchworkService.setConnectionResolver(this.connectionResolver!);

    const links = await this.externalLinksRepo.findByInternalEntity({
      internalEntityType: 'attachment',
      internalEntityId: params.id,
    });
    const link = links[0];
    if (!link) {
      throw new NotFoundException(
        'AttachmentsService.update — no external link for attachment (still pending Crunchwork sync)',
      );
    }
    const extObj = await this.externalObjectsRepo.findById({ id: link.externalObjectId });
    if (!extObj) {
      throw new NotFoundException(
        'AttachmentsService.update — external object not found',
      );
    }

    const scopePrefix = existing.relatedRecordType ?? 'Job';
    const scopedId = `${scopePrefix}-${extObj.providerEntityId}`;

    const apiAttachment = await this.crunchworkService.updateAttachment({
      connectionId,
      attachmentId: scopedId,
      body: params.body,
    });

    const apiObj = apiAttachment as Record<string, unknown>;
    return this.attachmentsRepo.update({
      id: params.id,
      data: {
        apiPayload: apiAttachment as Record<string, unknown>,
        title: (apiObj.title as string) ?? existing.title,
        description: (apiObj.description as string) ?? existing.description,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      },
    });
  }
}
