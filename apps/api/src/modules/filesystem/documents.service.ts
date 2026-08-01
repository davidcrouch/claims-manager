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

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly documentsRepo: DocumentsRepository,
    private readonly gcsStorage: GcsStorageService,
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
    const bucket = this.gcsStorage.getBucketName();

    if (!bucket) {
      throw new ServiceUnavailableException(
        'Document uploads not configured. Set GCP_PROJECT_ID and GCS_DOCUMENTS_BUCKET.',
      );
    }

    const doc = await this.documentsRepo.create({
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

      await this.documentsRepo.update(documentId, tenantId, { uri });

      this.logger.debug(`[DocumentsService.generateUploadUrl] docId=${doc.id} path=${gcsObjectPath}`);
      return { document: doc, uploadUrl };
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

  async markUploadComplete(documentId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const doc = await this.documentsRepo.findOne(documentId, tenantId);
    if (!doc) throw new NotFoundException('Document not found');

    const metadata = await this.gcsStorage.getMetadata(doc.gcsObjectPath);

    const updateData: Record<string, unknown> = { uploadStatus: 'complete' };
    if (metadata) {
      updateData.fileSizeBytes = metadata.size;
    }

    const updated = await this.documentsRepo.update(documentId, tenantId, updateData);
    this.logger.debug(`[DocumentsService.markUploadComplete] docId=${documentId} verified=${!!metadata}`);
    return updated;
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

  private validateMimeType(mimeType: string): void {
    const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
    if (!allowed) {
      throw new BadRequestException(`Unsupported MIME type: ${mimeType}`);
    }
  }
}
