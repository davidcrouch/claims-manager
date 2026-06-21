import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  JournalsRepository,
  JournalPagesRepository,
  JournalPageAttachmentsRepository,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { S3Service } from '../../common/s3/s3.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { UpdateJournalDto } from './dto/update-journal.dto';
import { CreateJournalPageDto } from './dto/create-journal-page.dto';
import { UpdateJournalPageDto } from './dto/update-journal-page.dto';
import { CreatePageAttachmentDto } from './dto/create-page-attachment.dto';

const VALID_ENTITY_TYPES = ['Job', 'Quote', 'Invoice'];

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats'];

@Injectable()
export class JournalsService {
  private readonly logger = new Logger(JournalsService.name);

  constructor(
    private readonly journalsRepo: JournalsRepository,
    private readonly pagesRepo: JournalPagesRepository,
    private readonly attachmentsRepo: JournalPageAttachmentsRepository,
    private readonly tenantContext: TenantContext,
    private readonly s3Service: S3Service,
  ) {}

  // -- Journals --

  async findAll(params: { page?: number; limit?: number; status?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[JournalsService.findAll] tenantId=${tenantId}`);
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

  async findByEntity(params: { entityType: string; entityId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    if (!VALID_ENTITY_TYPES.includes(params.entityType)) {
      throw new BadRequestException(`entityType must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
    }
    this.logger.debug(`[JournalsService.findByEntity] ${params.entityType}=${params.entityId}`);
    return this.journalsRepo.findByEntity({ tenantId, ...params });
  }

  async create(params: { dto: CreateJournalDto; userId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { dto, userId } = params;

    this.logger.debug(`[JournalsService.create] creating journal "${dto.name}" for tenant=${tenantId}`);

    return this.journalsRepo.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        address: dto.address ?? {},
        latitude: dto.latitude != null ? String(dto.latitude) : null,
        longitude: dto.longitude != null ? String(dto.longitude) : null,
        createdByUserId: userId,
      },
    });
  }

  async update(params: { id: string; dto: UpdateJournalDto }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.journalsRepo.findOne({ id: params.id, tenantId });
    if (!existing) throw new NotFoundException('Journal not found');

    const { dto } = params;

    return this.journalsRepo.update({
      id: params.id,
      tenantId,
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.latitude !== undefined && { latitude: String(dto.latitude) }),
        ...(dto.longitude !== undefined && { longitude: String(dto.longitude) }),
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

    const pagesWithAttachments = result.data.map((page) => ({
      ...page,
      attachments: attachmentsByPage.get(page.id) ?? [],
    }));

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
    return { ...page, attachments };
  }

  async createPage(params: { journalId: string; dto: CreateJournalPageDto; userId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const journal = await this.journalsRepo.findOne({ id: params.journalId, tenantId });
    if (!journal) throw new NotFoundException('Journal not found');

    const { dto, userId } = params;
    const sortIndex = await this.pagesRepo.getNextSortIndex({ journalId: params.journalId, tenantId });

    this.logger.debug(`[JournalsService.createPage] journal=${params.journalId} sortIndex=${sortIndex}`);

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

    return this.pagesRepo.update({
      id: params.pageId,
      tenantId,
      data: {
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.bodyFormat !== undefined && { bodyFormat: dto.bodyFormat }),
        ...(dto.latitude !== undefined && { latitude: String(dto.latitude) }),
        ...(dto.longitude !== undefined && { longitude: String(dto.longitude) }),
        ...(dto.locationAccuracy !== undefined && { locationAccuracy: String(dto.locationAccuracy) }),
        ...(dto.locationLabel !== undefined && { locationLabel: dto.locationLabel }),
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

    const sortIndex = await this.attachmentsRepo.getNextSortIndex({ journalPageId: params.pageId, tenantId });

    return this.attachmentsRepo.create({
      data: {
        tenantId,
        journalPageId: params.pageId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize ?? null,
        storageKey: dto.storageKey,
        fileUrl: dto.fileUrl ?? null,
        caption: dto.caption ?? null,
        sortIndex,
        width: dto.width ?? null,
        height: dto.height ?? null,
        durationSeconds: dto.durationSeconds != null ? String(dto.durationSeconds) : null,
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
    return { deleted: true };
  }

  // -- File upload/download (presigned URLs via S3) --

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

    const fileId = randomUUID();
    const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `journals/${tenantId}/${params.journalId}/pages/${params.pageId}/${fileId}-${safeFileName}`;

    const uploadUrl = await this.s3Service.getSignedUploadUrl({
      key: storageKey,
      contentType: params.mimeType,
      expiresIn: 600,
    });

    return { uploadUrl, storageKey, fileId };
  }

  async getDownloadUrl(params: { journalId: string; pageId: string; attachmentId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const attachment = await this.attachmentsRepo.findOne({ id: params.attachmentId, tenantId });
    if (!attachment || attachment.journalPageId !== params.pageId) {
      throw new NotFoundException('Attachment not found');
    }

    const downloadUrl = await this.s3Service.getSignedDownloadUrl({
      key: attachment.storageKey,
      expiresIn: 900,
    });

    return { downloadUrl, fileName: attachment.fileName, mimeType: attachment.mimeType };
  }
}
