import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
  Optional,
} from '@nestjs/common';
import { DocumentsRepository } from '../../database/repositories/documents.repository';
import { FilesystemsRepository } from '../../database/repositories/filesystems.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import { OfficeConverterService } from '../../common/office/office-converter.service';
import { renderDocxPreviewSvg } from '../../common/office/docx-preview-svg';
import { CreateDocumentUploadUrlDto } from './dto/create-document-upload-url.dto';
import { BatchUploadUrlsDto } from './dto/batch-upload-urls.dto';
import { PipelineService } from '../pipelines/pipeline.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';

const ADC_REAUTH_REQUIRED_RE = /invalid_grant|invalid_rapt|reauth related error|credentials expired/i;

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain',
  'text/csv',
];

const WORD_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function parseGcsPath(uri: string): { bucket: string; objectPath: string } | null {
  if (uri.startsWith('gs://')) {
    const raw = uri.slice('gs://'.length);
    const slashIndex = raw.indexOf('/');
    if (slashIndex === -1) return null;
    return { bucket: raw.slice(0, slashIndex), objectPath: raw.slice(slashIndex + 1) };
  }
  const storagePrefix = 'https://storage.googleapis.com/';
  if (uri.startsWith(storagePrefix)) {
    const raw = uri.slice(storagePrefix.length);
    const slashIndex = raw.indexOf('/');
    if (slashIndex === -1) return null;
    return {
      bucket: raw.slice(0, slashIndex),
      objectPath: decodeURIComponent(raw.slice(slashIndex + 1)),
    };
  }
  return null;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly documentsRepo: DocumentsRepository,
    private readonly filesystemsRepo: FilesystemsRepository,
    private readonly gcsStorage: GcsStorageService,
    private readonly officeConverter: OfficeConverterService,
    private readonly tenantContext: TenantContext,
    @Optional() private readonly pipelineService?: PipelineService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    uncategorised?: boolean;
    relatedRecordType?: string;
    relatedRecordId?: string;
    filesystemId?: string;
    jobId?: string;
    uploadStatus?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[DocumentsService.findAll] tenantId=${tenantId}`);

    let filesystemId = params.filesystemId;
    let orRelatedRecordId: string | undefined;
    if (!filesystemId && params.jobId) {
      const projectFs = await this.filesystemsRepo.findByJob(tenantId, params.jobId);
      filesystemId = projectFs?.id;
      orRelatedRecordId = params.jobId;
    }

    return this.documentsRepo.findAll({
      tenantId,
      filters: {
        categoryId: params.categoryId,
        uncategorised: params.uncategorised,
        relatedRecordType: params.relatedRecordType,
        relatedRecordId: params.relatedRecordId,
        filesystemId,
        orRelatedRecordId,
        search: params.search,
        uploadStatus: params.uploadStatus,
      },
      page: params.page,
      limit: params.limit,
      sort: params.sort,
    });
  }

  async countByCategory(filesystemId?: string) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `[DocumentsService.countByCategory] tenantId=${tenantId} filesystemId=${filesystemId ?? 'all'}`,
    );
    return this.documentsRepo.countByCategory(tenantId, filesystemId);
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(id, tenantId);
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async generateUploadUrl(dto: CreateDocumentUploadUrlDto, userId?: string) {
    const tenantId = this.tenantContext.getTenantId();
    this.validateMimeType(dto.mimeType);

    const resolved = await this.resolveUploadScope(dto);

    const documentId = crypto.randomUUID();
    const safeFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsObjectPath = `tenants/${tenantId}/documents/${documentId}/${safeFileName}`;
    const thumbnailObjectPath = `tenants/${tenantId}/documents/${documentId}/thumbnail.png`;
    const bucket = this.gcsStorage.getBucketName();

    if (!bucket) {
      throw new ServiceUnavailableException(
        'Document uploads not configured. Set GCP_PROJECT_ID and GCS_DOCUMENTS_BUCKET.',
      );
    }

    await this.documentsRepo.create({
      id: documentId,
      tenantId,
      filesystemId: resolved.filesystemId,
      filesystemCategoryId: resolved.categoryId,
      relatedRecordType: resolved.relatedRecordType,
      relatedRecordId: resolved.relatedRecordId,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      fileSizeBytes: dto.fileSizeBytes ?? null,
      gcsBucket: bucket,
      gcsObjectPath,
      uploadStatus: 'pending',
      uploadedByUserId: userId ?? null,
    });

    try {
      const { uploadUrl, uri } = await this.gcsStorage.createResumableUploadUrl({
        objectPath: gcsObjectPath,
        contentType: dto.mimeType,
        metadata: { tenantId, documentId, uploadedBy: userId ?? 'unknown' },
      });

      const { uploadUrl: thumbnailUploadUrl } = await this.gcsStorage.createResumableUploadUrl({
        objectPath: thumbnailObjectPath,
        contentType: 'image/png',
        metadata: {
          tenantId,
          documentId,
          uploadedBy: userId ?? 'unknown',
          role: 'thumbnail',
        },
      });

      await this.documentsRepo.update(documentId, tenantId, { uri });

      this.logger.debug(
        `[DocumentsService.generateUploadUrl] docId=${documentId} path=${gcsObjectPath}`,
      );
      return {
        documentId,
        uploadUrl,
        storageKey: gcsObjectPath,
        thumbnailUploadUrl,
        thumbnailObjectPath,
      };
    } catch (error: any) {
      await this.documentsRepo.update(documentId, tenantId, { uploadStatus: 'failed' });
      const message = error?.message ?? String(error);
      if (error?.code === 401 || ADC_REAUTH_REQUIRED_RE.test(message)) {
        this.logger.error(
          '[DocumentsService.generateUploadUrl] Google ADC requires re-authentication before creating upload URLs',
        );
        throw new ServiceUnavailableException(
          'Google Cloud ADC requires re-authentication. Run "gcloud auth application-default login" and restart.',
        );
      }
      throw error;
    }
  }

  async generateBatchUploadUrls(dto: BatchUploadUrlsDto, userId?: string) {
    const results = await Promise.all(
      dto.files.map((file) => this.generateUploadUrl(file, userId)),
    );
    return { uploads: results };
  }

  async markUploadComplete(documentId: string, thumbnailObjectPath?: string) {
    const logPrefix = 'DocumentsService.markUploadComplete';
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    const metadata = await this.gcsStorage.getMetadata(doc.gcsObjectPath);

    let resolvedThumbnailPath = thumbnailObjectPath ?? null;

    // Client only generates thumbnails for images/PDFs. Word: LibreOffice, or .docx text preview.
    if (!resolvedThumbnailPath && this.isWordDocument(doc.mimeType, doc.fileName)) {
      try {
        resolvedThumbnailPath = await this.generateWordThumbnail({
          tenantId,
          documentId,
          gcsObjectPath: doc.gcsObjectPath,
          fileName: doc.fileName,
        });
      } catch (error) {
        const err = error as Error;
        this.logger.warn(
          `${logPrefix} — word thumbnail failed docId=${documentId}: ${err.message}`,
        );
      }
    }

    const thumbnailUri = resolvedThumbnailPath
      ? `https://storage.googleapis.com/${doc.gcsBucket}/${resolvedThumbnailPath}`
      : doc.mimeType?.startsWith('image/')
        ? `https://storage.googleapis.com/${doc.gcsBucket}/${doc.gcsObjectPath}`
        : null;

    const updateData: Record<string, unknown> = {
      uploadStatus: 'complete',
      ...(thumbnailUri ? { thumbnailUri } : {}),
    };
    if (metadata) {
      updateData.fileSizeBytes = metadata.size;
    }

    const updated = await this.documentsRepo.update(documentId, tenantId, updateData);
    this.logger.debug(
      `${logPrefix} — docId=${documentId} verified=${!!metadata} thumbnail=${!!thumbnailUri}`,
    );

    // Enqueue matching pipelines (executeRun stays background). Await enqueue so
    // the response includes pipelineStatus pending | skipped.
    try {
      await this.pipelineService?.triggerUploadPipelines(documentId, tenantId);
    } catch (err) {
      this.logger.warn(
        `${logPrefix} — pipeline trigger failed: ${err instanceof Error ? err.message : err}`,
      );
    }

    await this.emitDocumentUploadedIfRelevant({
      documentId,
      tenantId,
      relatedRecordType: doc.relatedRecordType,
      relatedRecordId: doc.relatedRecordId,
      categoryId: doc.filesystemCategoryId,
    });

    const withPipeline = await this.documentsRepo.findOne(documentId, tenantId);
    return withPipeline ?? updated;
  }

  private isWordDocument(mimeType: string | null | undefined, fileName: string): boolean {
    if (mimeType && WORD_MIME_TYPES.has(mimeType)) return true;
    const lower = fileName.toLowerCase();
    return lower.endsWith('.docx') || lower.endsWith('.doc');
  }

  private isPdfDocument(mimeType: string | null | undefined, fileName: string): boolean {
    if (mimeType === 'application/pdf') return true;
    return fileName.toLowerCase().endsWith('.pdf');
  }

  private officeThumbnailSourceName(
    fileName: string,
    mimeType?: string | null,
  ): string {
    if (this.isPdfDocument(mimeType, fileName)) return 'source.pdf';
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.doc') && !lower.endsWith('.docx')) return 'source.doc';
    return 'source.docx';
  }

  private async generateOfficeThumbnailFromBuffer(params: {
    tenantId: string;
    documentId: string;
    buffer: Buffer;
    fileName: string;
    mimeType?: string | null;
  }): Promise<string> {
    const logPrefix = 'DocumentsService.generateOfficeThumbnailFromBuffer';
    const isPdf = this.isPdfDocument(params.mimeType, params.fileName);
    const isDocx =
      !isPdf &&
      (params.fileName.toLowerCase().endsWith('.docx') ||
        (params.buffer.length >= 2 && params.buffer[0] === 0x50 && params.buffer[1] === 0x4b));

    try {
      const pngBuffer = await this.officeConverter.convertToPng({
        buffer: params.buffer,
        sourceFileName: this.officeThumbnailSourceName(params.fileName, params.mimeType),
      });
      const thumbnailObjectPath = `tenants/${params.tenantId}/documents/${params.documentId}/thumbnail.png`;
      await this.gcsStorage.uploadBuffer({
        objectPath: thumbnailObjectPath,
        buffer: pngBuffer,
        contentType: 'image/png',
      });
      this.logger.debug(
        `${logPrefix} — docId=${params.documentId} uploaded png ${pngBuffer.length} bytes to ${thumbnailObjectPath}`,
      );
      return thumbnailObjectPath;
    } catch (error) {
      if (isPdf || !isDocx) throw error;
      this.logger.warn(
        `${logPrefix} — LibreOffice unavailable, using docx text preview docId=${params.documentId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      const svgBuffer = renderDocxPreviewSvg(params.buffer, params.fileName);
      const thumbnailObjectPath = `tenants/${params.tenantId}/documents/${params.documentId}/thumbnail.svg`;
      await this.gcsStorage.uploadBuffer({
        objectPath: thumbnailObjectPath,
        buffer: svgBuffer,
        contentType: 'image/svg+xml',
      });
      this.logger.debug(
        `${logPrefix} — docId=${params.documentId} uploaded svg ${svgBuffer.length} bytes to ${thumbnailObjectPath}`,
      );
      return thumbnailObjectPath;
    }
  }

  private async generateWordThumbnail(params: {
    tenantId: string;
    documentId: string;
    gcsObjectPath: string;
    fileName: string;
    mimeType?: string | null;
  }): Promise<string> {
    const logPrefix = 'DocumentsService.generateWordThumbnail';
    this.logger.debug(`${logPrefix} — docId=${params.documentId} path=${params.gcsObjectPath}`);
    const sourceBuffer = await this.gcsStorage.downloadBuffer(params.gcsObjectPath);
    return this.generateOfficeThumbnailFromBuffer({
      tenantId: params.tenantId,
      documentId: params.documentId,
      buffer: sourceBuffer,
      fileName: params.fileName,
      mimeType: params.mimeType,
    });
  }

  private async ensureGeneratedThumbnail(doc: {
    id: string;
    tenantId: string;
    mimeType: string;
    fileName: string;
    gcsBucket: string;
    gcsObjectPath: string;
    thumbnailUri: string | null;
  }): Promise<string | null> {
    if (doc.thumbnailUri) {
      return parseGcsPath(doc.thumbnailUri)?.objectPath ?? null;
    }
    if (
      !this.isWordDocument(doc.mimeType, doc.fileName) &&
      !this.isPdfDocument(doc.mimeType, doc.fileName)
    ) {
      return null;
    }
    try {
      const objectPath = await this.generateWordThumbnail({
        tenantId: doc.tenantId,
        documentId: doc.id,
        gcsObjectPath: doc.gcsObjectPath,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
      });
      const thumbnailUri = `https://storage.googleapis.com/${doc.gcsBucket}/${objectPath}`;
      await this.documentsRepo.update(doc.id, doc.tenantId, { thumbnailUri });
      return objectPath;
    } catch (error) {
      this.logger.warn(
        `[DocumentsService.ensureGeneratedThumbnail] docId=${doc.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return null;
    }
  }

  async createFromBuffer(params: {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
    categoryId: string;
    relatedRecordType?: string | null;
    relatedRecordId?: string | null;
    userId?: string;
    tenantId?: string;
  }) {
    const logPrefix = 'DocumentsService.createFromBuffer';
    const tenantId = params.tenantId ?? this.tenantContext.getTenantId();
    this.validateMimeType(params.mimeType);

    const resolved = await this.resolveUploadScope(
      {
        fileName: params.fileName,
        mimeType: params.mimeType,
        categoryId: params.categoryId,
        relatedRecordType: params.relatedRecordType ?? undefined,
        relatedRecordId: params.relatedRecordId ?? undefined,
      },
      tenantId,
    );

    const documentId = crypto.randomUUID();
    const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const gcsObjectPath = `tenants/${tenantId}/documents/${documentId}/${safeFileName}`;
    const bucket = this.gcsStorage.getBucketName();

    if (!bucket) {
      throw new ServiceUnavailableException(
        'Document uploads not configured. Set GCP_PROJECT_ID and GCS_DOCUMENTS_BUCKET.',
      );
    }

    await this.gcsStorage.uploadBuffer({
      objectPath: gcsObjectPath,
      buffer: params.buffer,
      contentType: params.mimeType,
    });

    let thumbnailUri: string | null = null;
    if (
      this.isPdfDocument(params.mimeType, params.fileName) ||
      this.isWordDocument(params.mimeType, params.fileName)
    ) {
      try {
        const thumbnailPath = await this.generateOfficeThumbnailFromBuffer({
          tenantId,
          documentId,
          buffer: params.buffer,
          fileName: params.fileName,
          mimeType: params.mimeType,
        });
        thumbnailUri = `https://storage.googleapis.com/${bucket}/${thumbnailPath}`;
      } catch (err) {
        this.logger.warn(
          `${logPrefix} — thumbnail failed docId=${documentId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    const uri = `https://storage.googleapis.com/${bucket}/${gcsObjectPath}`;
    await this.documentsRepo.create({
      id: documentId,
      tenantId,
      filesystemId: resolved.filesystemId,
      filesystemCategoryId: resolved.categoryId,
      relatedRecordType: resolved.relatedRecordType,
      relatedRecordId: resolved.relatedRecordId,
      fileName: params.fileName,
      mimeType: params.mimeType,
      fileSizeBytes: params.buffer.length,
      gcsBucket: bucket,
      gcsObjectPath,
      uri,
      uploadStatus: 'complete',
      sourceSystem: 'document-generation',
      uploadedByUserId: params.userId ?? null,
      thumbnailUri,
    });

    this.logger.log(
      `${logPrefix} — docId=${documentId} categoryId=${resolved.categoryId} bytes=${params.buffer.length}`,
    );

    try {
      await this.pipelineService?.triggerUploadPipelines(documentId, tenantId);
    } catch (err) {
      this.logger.warn(
        `${logPrefix} — pipeline trigger failed: ${err instanceof Error ? err.message : err}`,
      );
    }

    const created = await this.documentsRepo.findOne(documentId, tenantId);
    if (!created) {
      throw new NotFoundException('Created document not found');
    }
    return created;
  }

  async markUploadFailed(documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    const updated = await this.documentsRepo.update(documentId, tenantId, { uploadStatus: 'failed' });
    this.logger.debug(`[DocumentsService.markUploadFailed] docId=${documentId}`);
    return updated;
  }

  async assignCategory(documentId: string, categoryId: string | null) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    if (categoryId) {
      const cat = await this.filesystemsRepo.findCategoryById(categoryId);
      if (!cat || cat.archivedAt) throw new BadRequestException('Category not found');
      if (doc.filesystemId && cat.filesystemId !== doc.filesystemId) {
        throw new BadRequestException('Cannot move a document to a category on another filesystem');
      }
      const updated = await this.documentsRepo.update(documentId, tenantId, {
        filesystemCategoryId: categoryId,
        filesystemId: cat.filesystemId,
      });
      void this.pipelineService
        ?.triggerCategoryPipelines(documentId, categoryId, tenantId)
        .catch((err) => {
          this.logger.warn(
            `[DocumentsService.assignCategory] pipeline trigger failed: ${err instanceof Error ? err.message : err}`,
          );
        });

      await this.emitDocumentUploadedIfRelevant({
        documentId,
        tenantId,
        relatedRecordType: doc.relatedRecordType,
        relatedRecordId: doc.relatedRecordId,
        categoryId,
      });

      return updated;
    }

    return this.documentsRepo.update(documentId, tenantId, {
      filesystemCategoryId: null,
    });
  }

  async bulkAssignCategory(documentIds: string[], categoryId: string | null) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[DocumentsService.bulkAssignCategory] count=${documentIds.length} categoryId=${categoryId}`);

    const results = await Promise.all(
      documentIds.map((id) => this.assignCategory(id, categoryId)),
    );

    return { updated: results.filter(Boolean).length };
  }

  private async resolveUploadScope(
    dto: CreateDocumentUploadUrlDto,
    tenantId = this.tenantContext.getTenantId(),
  ): Promise<{
    filesystemId: string | null;
    categoryId: string | null;
    relatedRecordType: string | null;
    relatedRecordId: string | null;
  }> {
    let filesystemId = dto.filesystemId ?? null;
    let categoryId = dto.categoryId ?? null;
    let relatedRecordType = dto.relatedRecordType ?? null;
    let relatedRecordId = dto.relatedRecordId ?? null;

    if (dto.jobId) {
      const projectFs = await this.filesystemsRepo.findByJob(tenantId, dto.jobId);
      if (!projectFs) {
        throw new BadRequestException('Project filesystem not found for job');
      }
      if (filesystemId && filesystemId !== projectFs.id) {
        throw new BadRequestException('filesystemId does not match job project filesystem');
      }
      filesystemId = projectFs.id;
      relatedRecordType = relatedRecordType ?? 'Job';
      relatedRecordId = relatedRecordId ?? dto.jobId;
    }

    if (categoryId) {
      const cat = await this.filesystemsRepo.findCategoryById(categoryId);
      if (!cat || cat.archivedAt) throw new BadRequestException('Category not found');
      const catFs = await this.filesystemsRepo.findById(tenantId, cat.filesystemId);
      if (!catFs) throw new BadRequestException('Category filesystem not found');
      if (filesystemId && filesystemId !== cat.filesystemId) {
        throw new BadRequestException('categoryId does not belong to the target filesystem');
      }
      filesystemId = cat.filesystemId;
    }

    if (!filesystemId) {
      const company = await this.filesystemsRepo.findCompanyByTenant(tenantId);
      filesystemId = company?.id ?? null;
    } else {
      const fs = await this.filesystemsRepo.findById(tenantId, filesystemId);
      if (!fs) throw new BadRequestException('Filesystem not found');
    }

    return { filesystemId, categoryId, relatedRecordType, relatedRecordId };
  }

  async getDownloadUrl(documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    const downloadUrl = await this.gcsStorage.getSignedDownloadUrl({
      objectPath: doc.gcsObjectPath,
    });

    if (!downloadUrl) {
      return { downloadUrl: '', streamFallback: true, fileName: doc.fileName, mimeType: doc.mimeType };
    }

    return { downloadUrl, streamFallback: false, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  async getDownloadStream(documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    const stream = this.gcsStorage.getReadStream(doc.gcsObjectPath);
    return { stream, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  async getThumbnailUrl(documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    let location = this.resolveThumbnailLocation(doc);
    if (!location) {
      const objectPath = await this.ensureGeneratedThumbnail(doc);
      if (objectPath) {
        location = { bucket: doc.gcsBucket, objectPath };
      }
    }
    if (!location) {
      throw new NotFoundException('Thumbnail not available');
    }

    const url = await this.gcsStorage.getSignedDownloadUrl({
      objectPath: location.objectPath,
    });

    if (!url) {
      this.logger.debug(
        `[DocumentsService.getThumbnailUrl] docId=${documentId} streamFallback=true`,
      );
      return { url: '', streamFallback: true, expiresAt: null };
    }

    const expiresAt = new Date(Date.now() + 900 * 1000).toISOString();
    this.logger.debug(`[DocumentsService.getThumbnailUrl] docId=${documentId}`);
    return { url, streamFallback: false, expiresAt };
  }

  async getThumbnailStream(documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    let location = this.resolveThumbnailLocation(doc);
    if (!location) {
      const objectPath = await this.ensureGeneratedThumbnail(doc);
      if (objectPath) {
        location = { bucket: doc.gcsBucket, objectPath };
      }
    }
    if (!location) {
      throw new NotFoundException('Thumbnail not available');
    }

    const stream = this.gcsStorage.getReadStream(location.objectPath);
    const contentType = this.thumbnailContentType(doc.thumbnailUri, location.objectPath);
    this.logger.debug(`[DocumentsService.getThumbnailStream] docId=${documentId}`);
    return { stream, contentType };
  }

  async archive(documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    await this.documentsRepo.archive(documentId, tenantId);
    this.logger.debug(`[DocumentsService.archive] docId=${documentId}`);
    return { archived: true };
  }

  async hardDelete(documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    try {
      const prefix = `tenants/${tenantId}/documents/${documentId}/`;
      await this.gcsStorage.deletePrefix(prefix);
    } catch (err) {
      this.logger.warn(`[DocumentsService.hardDelete] failed to delete GCS objects: ${(err as Error).message}`);
    }

    await this.documentsRepo.hardDelete(documentId, tenantId);
    this.logger.debug(`[DocumentsService.hardDelete] docId=${documentId}`);
    return { deleted: true };
  }

  private resolveThumbnailLocation(doc: {
    thumbnailUri: string | null;
    mimeType: string;
    gcsBucket: string;
    gcsObjectPath: string;
  }): { bucket: string; objectPath: string } | null {
    if (doc.thumbnailUri) {
      const parsed = parseGcsPath(doc.thumbnailUri);
      if (parsed) return parsed;
    }

    if (doc.mimeType?.startsWith('image/') && doc.gcsBucket && doc.gcsObjectPath) {
      return { bucket: doc.gcsBucket, objectPath: doc.gcsObjectPath };
    }

    return null;
  }

  private thumbnailContentType(thumbnailUri: string | null, objectPath: string): string {
    if (objectPath.endsWith('.svg') || thumbnailUri?.includes('.svg')) {
      return 'image/svg+xml';
    }
    if (objectPath.endsWith('.png') || thumbnailUri?.includes('/thumbnail.png')) {
      return 'image/png';
    }
    return 'image/png';
  }

  private validateMimeType(mimeType: string): void {
    const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
    if (!allowed) {
      throw new BadRequestException(`Unsupported MIME type: ${mimeType}`);
    }
  }

  private async resolveCategoryName(categoryId: string | null | undefined): Promise<string | null> {
    if (!categoryId) return null;
    try {
      const cat = await this.filesystemsRepo.findCategoryById(categoryId);
      return cat?.displayName ?? null;
    } catch {
      return null;
    }
  }

  private async emitDocumentUploadedIfRelevant(params: {
    documentId: string;
    tenantId: string;
    relatedRecordType: string | null;
    relatedRecordId: string | null;
    categoryId: string | null | undefined;
  }): Promise<void> {
    if (!this.outboundEvents) return;
    if (params.relatedRecordType !== 'Job' || !params.relatedRecordId) return;

    const documentType = await this.resolveCategoryName(params.categoryId);
    if (!documentType) return;

    this.logger.debug(
      `DocumentsService.emitDocumentUploadedIfRelevant — docId=${params.documentId} jobId=${params.relatedRecordId} type="${documentType}"`,
    );

    this.outboundEvents.emitDocumentUploaded({
      documentId: params.documentId,
      jobId: params.relatedRecordId,
      tenantId: params.tenantId,
      documentType,
      uploadedAt: new Date().toISOString(),
    }).catch(() => {});
  }
}
