import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { DocumentsRepository } from '../../database/repositories/documents.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { GcsStorageService } from '../../common/gcs/gcs-storage.service';
import { OfficeConverterService } from '../../common/office/office-converter.service';
import { CreateDocumentUploadUrlDto } from './dto/create-document-upload-url.dto';
import { BatchUploadUrlsDto } from './dto/batch-upload-urls.dto';

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
    private readonly gcsStorage: GcsStorageService,
    private readonly officeConverter: OfficeConverterService,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    uncategorised?: boolean;
    relatedRecordType?: string;
    relatedRecordId?: string;
    uploadStatus?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[DocumentsService.findAll] tenantId=${tenantId}`);
    return this.documentsRepo.findAll({
      tenantId,
      filters: {
        categoryId: params.categoryId,
        uncategorised: params.uncategorised,
        relatedRecordType: params.relatedRecordType,
        relatedRecordId: params.relatedRecordId,
        search: params.search,
        uploadStatus: params.uploadStatus,
      },
      page: params.page,
      limit: params.limit,
      sort: params.sort,
    });
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
      filesystemCategoryId: dto.categoryId ?? null,
      relatedRecordType: dto.relatedRecordType ?? null,
      relatedRecordId: dto.relatedRecordId ?? null,
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
      if (error?.code === 401 || error?.message?.includes('credentials expired')) {
        throw new ServiceUnavailableException(
          'GCP credentials expired. Run "gcloud auth application-default login" and restart.',
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

    // Client only generates thumbnails for images/PDFs. Word docs need server-side LibreOffice.
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
    return updated;
  }

  private isWordDocument(mimeType: string | null | undefined, fileName: string): boolean {
    if (mimeType && WORD_MIME_TYPES.has(mimeType)) return true;
    const lower = fileName.toLowerCase();
    return lower.endsWith('.docx') || lower.endsWith('.doc');
  }

  private async generateWordThumbnail(params: {
    tenantId: string;
    documentId: string;
    gcsObjectPath: string;
    fileName: string;
  }): Promise<string> {
    const logPrefix = 'DocumentsService.generateWordThumbnail';
    const thumbnailObjectPath = `tenants/${params.tenantId}/documents/${params.documentId}/thumbnail.png`;

    this.logger.debug(`${logPrefix} — docId=${params.documentId} path=${params.gcsObjectPath}`);

    const docxBuffer = await this.gcsStorage.downloadBuffer(params.gcsObjectPath);
    const sourceFileName = params.fileName.toLowerCase().endsWith('.doc')
      ? 'source.doc'
      : 'source.docx';
    const pngBuffer = await this.officeConverter.convertToPng({
      buffer: docxBuffer,
      sourceFileName,
    });

    await this.gcsStorage.uploadBuffer({
      objectPath: thumbnailObjectPath,
      buffer: pngBuffer,
      contentType: 'image/png',
    });

    this.logger.debug(
      `${logPrefix} — docId=${params.documentId} uploaded ${pngBuffer.length} bytes to ${thumbnailObjectPath}`,
    );
    return thumbnailObjectPath;
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

    return this.documentsRepo.update(documentId, tenantId, {
      filesystemCategoryId: categoryId,
    });
  }

  async bulkAssignCategory(documentIds: string[], categoryId: string | null) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`[DocumentsService.bulkAssignCategory] count=${documentIds.length} categoryId=${categoryId}`);

    const results = await Promise.all(
      documentIds.map((id) =>
        this.documentsRepo.update(id, tenantId, { filesystemCategoryId: categoryId }),
      ),
    );
    return { updated: results.filter(Boolean).length };
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

    const location = this.resolveThumbnailLocation(doc);
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

    const location = this.resolveThumbnailLocation(doc);
    if (!location) {
      throw new NotFoundException('Thumbnail not available');
    }

    const stream = this.gcsStorage.getReadStream(location.objectPath);
    const contentType =
      doc.thumbnailUri?.includes('/thumbnail.png') || location.objectPath.endsWith('/thumbnail.png')
        ? 'image/png'
        : doc.mimeType || 'image/png';
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

  private validateMimeType(mimeType: string): void {
    const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
    if (!allowed) {
      throw new BadRequestException(`Unsupported MIME type: ${mimeType}`);
    }
  }
}
