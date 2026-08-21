import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  JournalsRepository,
  JournalPagesRepository,
  JournalPageAttachmentsRepository,
} from '../../database/repositories';
import { DocumentsRepository } from '../../database/repositories/documents.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { CreateJournalPageDto } from './dto/create-journal-page.dto';
import { UpdateJournalPageDto } from './dto/update-journal-page.dto';
import { CreatePageAttachmentDto } from './dto/create-page-attachment.dto';

const VALID_ENTITY_TYPES = ['Job', 'Quote', 'Invoice'];

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/msword',
  'application/vnd.',
  'text/',
];

const ADC_REAUTH_REQUIRED_RE = /invalid_grant|invalid_rapt|reauth related error|credentials expired/i;

@Injectable()
export class JournalsService {
  private readonly logger = new Logger(JournalsService.name);

  constructor(
    private readonly journalsRepo: JournalsRepository,
    private readonly pagesRepo: JournalPagesRepository,
    private readonly attachmentsRepo: JournalPageAttachmentsRepository,
    private readonly documentsRepo: DocumentsRepository,
    private readonly tenantContext: TenantContext,
    private readonly gcsStorage: GcsStorageService,
  ) {}

  // -- Journals --

  async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    jobId?: string;
    jobIds?: string[];
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `[JournalsService.findAll] tenantId=${tenantId} jobId=${params.jobId ?? 'none'} jobIds=${params.jobIds?.length ?? 0}`,
    );
    return this.journalsRepo.findAll({ tenantId, ...params });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const journal = await this.journalsRepo.findOne({ id: params.id, tenantId });
    if (!journal) throw new NotFoundException('Journal not found');
    const pageCount = await this.journalsRepo.getPageCount({ journalId: journal.id, tenantId });
    const links = await this.journalsRepo.getEntityLinks({ tenantId, journalId: journal.id });
    return { ...journal, pageCount, entityLinks: links };
  }

  async findByEntity(params: {
    entityType: string;
    entityId: string;
    search?: string;
    status?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    if (!VALID_ENTITY_TYPES.includes(params.entityType)) {
      throw new BadRequestException(`entityType must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
    }
    this.logger.debug(`[JournalsService.findByEntity] ${params.entityType}=${params.entityId}`);
    return this.journalsRepo.findByEntity({ tenantId, ...params });
  }

  private addressColumnsFromPayload(address?: Record<string, unknown>) {
    const payload =
      address && typeof address === 'object' && !Array.isArray(address) ? address : {};
    const asText = (value: unknown): string | null =>
      typeof value === 'string' && value.trim() ? value.trim() : null;

    return {
      address: payload,
      addressSuburb: asText(payload.suburb),
      addressPostcode: asText(payload.postcode),
      addressState: asText(payload.state),
      addressCountry: asText(payload.country),
    };
  }

  async create(params: { dto: CreateJournalDto; userId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { dto, userId } = params;

    this.logger.debug(`[JournalsService.create] creating journal "${dto.name}" for tenant=${tenantId}`);

    const addressCols = this.addressColumnsFromPayload(dto.address);

    return this.journalsRepo.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        ...addressCols,
        latitude: dto.latitude != null ? String(dto.latitude) : null,
        longitude: dto.longitude != null ? String(dto.longitude) : null,
        metadata: dto.metadata ?? {},
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
  }

  async update(params: { id: string; dto: UpdateJournalDto; userId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.journalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) throw new NotFoundException('Journal not found');

    const { dto, userId } = params;
    const addressCols =
      dto.address !== undefined ? this.addressColumnsFromPayload(dto.address) : null;

    return this.journalsRepo.update({
      id: params.id,
      tenantId,
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(addressCols ?? {}),
        ...(dto.latitude !== undefined && {
          latitude: dto.latitude != null ? String(dto.latitude) : null,
        }),
        ...(dto.longitude !== undefined && {
          longitude: dto.longitude != null ? String(dto.longitude) : null,
        }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
        updatedByUserId: userId,
      },
    });
  }

  async softDelete(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.journalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) throw new NotFoundException('Journal not found');
    await this.journalsRepo.softDelete({ id: params.id, tenantId });
    return { deleted: true };
  }

  // -- Entity linking --

  async linkToEntity(params: { journalId: string; entityType: string; entityId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const journal = await this.journalsRepo.findOne({ id: params.journalId, tenantId });
    if (!journal) throw new NotFoundException('Journal not found');

    if (!VALID_ENTITY_TYPES.includes(params.entityType)) {
      throw new BadRequestException(`entityType must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
    }

    this.logger.debug(
      `[JournalsService.linkToEntity] journal=${params.journalId} → ${params.entityType}/${params.entityId}`,
    );

    const link = await this.journalsRepo.linkToEntity({
      data: {
        tenantId,
        journalId: params.journalId,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    });

    if (!link) {
      throw new ConflictException('Journal is already linked to this entity');
    }

    return link;
  }

  async unlinkFromEntity(params: { journalId: string; entityType: string; entityId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const journal = await this.journalsRepo.findOne({ id: params.journalId, tenantId });
    if (!journal) throw new NotFoundException('Journal not found');

    await this.journalsRepo.unlinkFromEntity({
      tenantId,
      journalId: params.journalId,
      entityType: params.entityType,
      entityId: params.entityId,
    });
    return { unlinked: true };
  }

  // -- Pages --

  async getPages(params: { journalId: string; limit?: number; offset?: number }) {
    const tenantId = this.tenantContext.getTenantId();
    const journal = await this.journalsRepo.findOne({ id: params.journalId, tenantId });
    if (!journal) throw new NotFoundException('Journal not found');

    const result = await this.pagesRepo.findByJournal({
      tenantId,
      journalId: params.journalId,
      limit: params.limit,
      offset: params.offset,
    });

    const pageIds = result.data.map((p) => p.id);
    const allAttachments = pageIds.length > 0
      ? await this.attachmentsRepo.findByPageIds({ tenantId, journalPageIds: pageIds })
      : [];

    const attachmentsByPage = new Map<string, typeof allAttachments>();
    for (const att of allAttachments) {
      const list = attachmentsByPage.get(att.journalPageId) ?? [];
      list.push(att);
      attachmentsByPage.set(att.journalPageId, list);
    }

    const pagesWithAttachments = await Promise.all(
      result.data.map(async (page) => ({
        ...page,
        attachments: await this.withDownloadUrls(attachmentsByPage.get(page.id) ?? [], {
          journalId: params.journalId,
          pageId: page.id,
        }),
      })),
    );

    return { data: pagesWithAttachments, total: result.total };
  }

  async getPage(params: { journalId: string; pageId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const page = await this.pagesRepo.findOne({ id: params.pageId, tenantId });
    if (!page || page.journalId !== params.journalId) {
      throw new NotFoundException('Journal page not found');
    }
    const attachments = await this.attachmentsRepo.findByPage({
      tenantId,
      journalPageId: page.id,
    });
    return {
      ...page,
      attachments: await this.withDownloadUrls(attachments, {
        journalId: params.journalId,
        pageId: page.id,
      }),
    };
  }

  /** Same-origin BFF path — browser `<img>` loads via `/api/v1/...` proxy with session auth. */
  private streamProxyUrl(params: { journalId: string; pageId: string; attachmentId: string }) {
    return `/api/v1/journals/${params.journalId}/pages/${params.pageId}/attachments/${params.attachmentId}/stream`;
  }

  private resolveDocumentId(att: { storageKey: string; metadata?: unknown }): string | null {
    const meta =
      att.metadata && typeof att.metadata === 'object' && !Array.isArray(att.metadata)
        ? (att.metadata as Record<string, unknown>)
        : {};
    if (typeof meta.documentId === 'string' && meta.documentId) return meta.documentId;
    const match = att.storageKey.match(
      /\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i,
    );
    return match?.[1] ?? null;
  }

  private async withDownloadUrls<
    T extends {
      id: string;
      storageKey: string;
      fileUrl: string | null;
      storageProvider: string;
      metadata?: unknown;
    },
  >(
    attachments: T[],
    ctx: { journalId: string; pageId: string },
  ): Promise<Array<T & { documentId: string | null }>> {
    return Promise.all(
      attachments.map(async (att) => {
        const documentId = this.resolveDocumentId(att);
        if (att.fileUrl) return { ...att, documentId };
        if (att.storageProvider !== 'gcs' && !att.storageKey.startsWith('tenants/')) {
          return { ...att, documentId };
        }
        const proxyUrl = this.streamProxyUrl({
          journalId: ctx.journalId,
          pageId: ctx.pageId,
          attachmentId: att.id,
        });
        try {
          const downloadUrl = await this.gcsStorage.getSignedDownloadUrl({
            objectPath: att.storageKey,
            expiresIn: 900,
          });
          // Local ADC often cannot sign; fall back to authenticated stream proxy (same as documents).
          if (!downloadUrl) {
            this.logger.debug(
              `[JournalsService.withDownloadUrls] signed URL empty — using stream proxy for attachment=${att.id}`,
            );
            return { ...att, fileUrl: proxyUrl, documentId };
          }
          return { ...att, fileUrl: downloadUrl, documentId };
        } catch (err) {
          this.logger.warn(
            `[JournalsService.withDownloadUrls] failed for key=${att.storageKey}: ${
              err instanceof Error ? err.message : err
            } — using stream proxy`,
          );
          return { ...att, fileUrl: proxyUrl, documentId };
        }
      }),
    );
  }

  async createPage(params: { journalId: string; dto: CreateJournalPageDto; userId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const journal = await this.journalsRepo.findOne({ id: params.journalId, tenantId });
    if (!journal) throw new NotFoundException('Journal not found');

    const { dto, userId } = params;
    const sortIndex = await this.pagesRepo.getNextSortIndex({ journalId: params.journalId, tenantId });

    this.logger.debug(`[JournalsService.createPage] journal=${params.journalId} sortIndex=${sortIndex}`);

    const metadata: Record<string, unknown> = {
      ...(dto.metadata && typeof dto.metadata === 'object' ? dto.metadata : {}),
    };
    if (dto.name?.trim()) {
      metadata.name = dto.name.trim();
    }
    if (dto.blocks) {
      metadata.blocks = dto.blocks;
    }

    return this.pagesRepo.create({
      data: {
        tenantId,
        journalId: params.journalId,
        body: dto.body ?? null,
        bodyFormat: dto.bodyFormat ?? 'plaintext',
        latitude: dto.latitude != null ? String(dto.latitude) : null,
        longitude: dto.longitude != null ? String(dto.longitude) : null,
        locationAccuracy: dto.locationAccuracy != null ? String(dto.locationAccuracy) : null,
        locationLabel: dto.locationLabel ?? null,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : new Date(),
        sortIndex,
        metadata,
        createdByUserId: userId,
      },
    });
  }

  async updatePage(params: { journalId: string; pageId: string; dto: UpdateJournalPageDto }) {
    const tenantId = this.tenantContext.getTenantId();
    const page = await this.pagesRepo.findOne({ id: params.pageId, tenantId });
    if (!page || page.journalId !== params.journalId) {
      throw new NotFoundException('Journal page not found');
    }

    const { dto } = params;
    const existingMeta = (page.metadata as Record<string, unknown>) ?? {};
    let nextMetadata: Record<string, unknown> | undefined;

    if (dto.metadata !== undefined || dto.blocks !== undefined || dto.name !== undefined) {
      nextMetadata = {
        ...existingMeta,
        ...(dto.metadata && typeof dto.metadata === 'object' ? dto.metadata : {}),
      };
      if (dto.name !== undefined) {
        const trimmed = dto.name.trim();
        if (trimmed) nextMetadata.name = trimmed;
        else delete nextMetadata.name;
      }
      if (dto.blocks !== undefined) {
        nextMetadata.blocks = dto.blocks;
      }
    }

    return this.pagesRepo.update({
      id: params.pageId,
      tenantId,
      data: {
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.bodyFormat !== undefined && { bodyFormat: dto.bodyFormat }),
        ...(dto.latitude !== undefined && { latitude: String(dto.latitude) }),
        ...(dto.longitude !== undefined && { longitude: String(dto.longitude) }),
        ...(dto.locationAccuracy !== undefined && { locationAccuracy: String(dto.locationAccuracy) }),
        ...(dto.locationLabel !== undefined && { locationLabel: dto.locationLabel }),
        ...(nextMetadata !== undefined && { metadata: nextMetadata }),
      },
    });
  }

  async deletePage(params: { journalId: string; pageId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const page = await this.pagesRepo.findOne({ id: params.pageId, tenantId });
    if (!page || page.journalId !== params.journalId) {
      throw new NotFoundException('Journal page not found');
    }
    await this.pagesRepo.softDelete({ id: params.pageId, tenantId });
    return { deleted: true };
  }

  async reorderPages(params: { journalId: string; pageIds: string[] }) {
    const tenantId = this.tenantContext.getTenantId();
    const journal = await this.journalsRepo.findOne({ id: params.journalId, tenantId });
    if (!journal) throw new NotFoundException('Journal not found');
    await this.pagesRepo.reorder({ journalId: params.journalId, tenantId, pageIds: params.pageIds });
    return { reordered: true };
  }

  // -- Attachments --

  async createAttachment(params: {
    journalId: string;
    pageId: string;
    dto: CreatePageAttachmentDto;
    userId: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const page = await this.pagesRepo.findOne({ id: params.pageId, tenantId });
    if (!page || page.journalId !== params.journalId) {
      throw new NotFoundException('Journal page not found');
    }

    const { dto, userId } = params;

    if (!ALLOWED_MIME_PREFIXES.some((prefix) => dto.mimeType.startsWith(prefix))) {
      throw new BadRequestException(`Unsupported MIME type: ${dto.mimeType}`);
    }

    const sortIndex =
      dto.sortIndex != null
        ? dto.sortIndex
        : await this.attachmentsRepo.getNextSortIndex({ journalPageId: params.pageId, tenantId });

    const documentId =
      dto.documentId ?? this.resolveDocumentId({ storageKey: dto.storageKey });

    return this.attachmentsRepo.create({
      data: {
        tenantId,
        journalPageId: params.pageId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize ?? null,
        storageProvider: 'gcs',
        storageKey: dto.storageKey,
        fileUrl: dto.fileUrl ?? null,
        caption: dto.caption ?? null,
        sortIndex,
        width: dto.width ?? null,
        height: dto.height ?? null,
        durationSeconds: dto.durationSeconds != null ? String(dto.durationSeconds) : null,
        thumbnailStorageKey: dto.thumbnailStorageKey ?? null,
        metadata: documentId ? { documentId } : {},
        createdByUserId: userId,
      },
    });
  }

  async deleteAttachment(params: { journalId: string; pageId: string; attachmentId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const attachment = await this.attachmentsRepo.findOne({ id: params.attachmentId, tenantId });
    if (!attachment || attachment.journalPageId !== params.pageId) {
      throw new NotFoundException('Attachment not found');
    }
    await this.attachmentsRepo.delete({ id: params.attachmentId, tenantId });
    const documentId = this.resolveDocumentId(attachment);
    if (documentId) {
      this.documentsRepo.hardDelete(documentId, tenantId).catch(() => {});
    }
    return { deleted: true };
  }

  // -- File upload/download (GCS resumable / signed URLs) --

  async getUploadUrl(params: { journalId: string; pageId: string; fileName: string; mimeType: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const journal = await this.journalsRepo.findOne({ id: params.journalId, tenantId });
    if (!journal) throw new NotFoundException('Journal not found');

    const page = await this.pagesRepo.findOne({ id: params.pageId, tenantId });
    if (!page || page.journalId !== params.journalId) {
      throw new NotFoundException('Journal page not found');
    }

    if (!ALLOWED_MIME_PREFIXES.some((prefix) => params.mimeType.startsWith(prefix))) {
      throw new BadRequestException(`Unsupported MIME type: ${params.mimeType}`);
    }

    if (!this.gcsStorage.getBucketName()) {
      throw new ServiceUnavailableException(
        'Journal uploads not configured. Set GCP_PROJECT_ID and GCS_DOCUMENTS_BUCKET.',
      );
    }

    const fileId = randomUUID();
    const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `tenants/${tenantId}/journals/${params.journalId}/pages/${params.pageId}/${fileId}-${safeFileName}`;

    try {
      const { uploadUrl } = await this.gcsStorage.createResumableUploadUrl({
        objectPath: storageKey,
        contentType: params.mimeType,
        metadata: {
          tenantId,
          journalId: params.journalId,
          pageId: params.pageId,
          fileId,
        },
      });

      this.logger.debug(
        `[JournalsService.getUploadUrl] journal=${params.journalId} page=${params.pageId} path=${storageKey}`,
      );

      return { uploadUrl, storageKey, fileId };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: number })?.code;
      if (code === 401 || ADC_REAUTH_REQUIRED_RE.test(message)) {
        this.logger.error(
          '[JournalsService.getUploadUrl] Google ADC requires re-authentication before creating upload URLs',
        );
        throw new ServiceUnavailableException(
          'Google Cloud ADC requires re-authentication. Run "gcloud auth application-default login" and restart.',
        );
      }
      throw error;
    }
  }

  async getDownloadUrl(params: { journalId: string; pageId: string; attachmentId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const attachment = await this.attachmentsRepo.findOne({ id: params.attachmentId, tenantId });
    if (!attachment || attachment.journalPageId !== params.pageId) {
      throw new NotFoundException('Attachment not found');
    }

    const downloadUrl = await this.gcsStorage.getSignedDownloadUrl({
      objectPath: attachment.storageKey,
      expiresIn: 900,
    });

    if (!downloadUrl) {
      return {
        downloadUrl: '',
        streamFallback: true,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
      };
    }

    return {
      downloadUrl,
      streamFallback: false,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  async getDownloadStream(params: { journalId: string; pageId: string; attachmentId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const page = await this.pagesRepo.findOne({ id: params.pageId, tenantId });
    if (!page || page.journalId !== params.journalId) {
      throw new NotFoundException('Journal page not found');
    }
    const attachment = await this.attachmentsRepo.findOne({ id: params.attachmentId, tenantId });
    if (!attachment || attachment.journalPageId !== params.pageId) {
      throw new NotFoundException('Attachment not found');
    }
    if (!attachment.storageKey) {
      throw new NotFoundException('Attachment has no storage key');
    }

    this.logger.debug(
      `[JournalsService.getDownloadStream] attachment=${params.attachmentId} key=${attachment.storageKey}`,
    );

    const stream = this.gcsStorage.getReadStream(attachment.storageKey);
    return { stream, fileName: attachment.fileName, mimeType: attachment.mimeType };
  }
}
