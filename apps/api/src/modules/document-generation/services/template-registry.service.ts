import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { S3Service } from '../../../common/s3/s3.service';
import { GcsStorageService } from '../../../common/gcs/gcs-storage.service';
import {
  DocumentTemplatesRepository,
  type DocumentTemplateRow,
} from '../../../database/repositories';
import { DocumentsRepository } from '../../../database/repositories/documents.repository';
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_TO_ENTITY_TYPE,
  type DocumentType,
} from '../types/document-types';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface ScenarioTemplateSetting {
  documentType: DocumentType;
  label: string;
  description: string;
  template: DocumentTemplateRow | null;
  filesystemDocument: {
    id: string;
    fileName: string;
    mimeType: string;
    uploadStatus: string;
  } | null;
}

const SCENARIO_META: Record<DocumentType, { label: string; description: string }> = {
  quote: {
    label: 'Quote',
    description: 'Generated when producing a quote PDF',
  },
  invoice: {
    label: 'Invoice',
    description: 'Generated when producing an invoice PDF',
  },
  purchase_order: {
    label: 'Purchase Order',
    description: 'Generated when producing a purchase order PDF',
  },
  work_order: {
    label: 'Work Order',
    description: 'Generated when producing a work order PDF',
  },
  proposal: {
    label: 'Proposal',
    description: 'Generated when producing a proposal PDF',
  },
  report: {
    label: 'Report',
    description: 'Generated when producing an assessment/report PDF',
  },
  bill: {
    label: 'Bill',
    description: 'Generated when producing a bill PDF',
  },
  rfq: {
    label: 'RFQ',
    description: 'Generated when producing an RFQ PDF',
  },
};

@Injectable()
export class TemplateRegistryService {
  private readonly logger = new Logger('TemplateRegistryService');

  constructor(
    private readonly templatesRepo: DocumentTemplatesRepository,
    private readonly documentsRepo: DocumentsRepository,
    private readonly gcsStorage: GcsStorageService,
    private readonly s3Service: S3Service,
  ) {}

  async getSettings(params: { tenantId: string }): Promise<ScenarioTemplateSetting[]> {
    const templates = await this.templatesRepo.findByTenant({ tenantId: params.tenantId });
    const byType = new Map(templates.map((t) => [t.documentType, t]));

    const settings: ScenarioTemplateSetting[] = [];
    for (const documentType of DOCUMENT_TYPES) {
      const template = byType.get(documentType) ?? null;
      let filesystemDocument: ScenarioTemplateSetting['filesystemDocument'] = null;

      if (template?.filesystemDocumentId) {
        const doc = await this.documentsRepo.findOne(
          template.filesystemDocumentId,
          params.tenantId,
        );
        if (doc) {
          filesystemDocument = {
            id: doc.id,
            fileName: doc.fileName,
            mimeType: doc.mimeType,
            uploadStatus: doc.uploadStatus,
          };
        }
      }

      settings.push({
        documentType,
        label: SCENARIO_META[documentType].label,
        description: SCENARIO_META[documentType].description,
        template,
        filesystemDocument,
      });
    }

    return settings;
  }

  async assignFilesystemDocument(params: {
    tenantId: string;
    documentType: DocumentType;
    filesystemDocumentId: string;
  }): Promise<DocumentTemplateRow> {
    const logPrefix = 'TemplateRegistryService.assignFilesystemDocument';

    if (!DOCUMENT_TYPES.includes(params.documentType)) {
      throw new BadRequestException(`Invalid document type "${params.documentType}"`);
    }

    const doc = await this.documentsRepo.findOne(
      params.filesystemDocumentId,
      params.tenantId,
    );
    if (!doc) {
      throw new NotFoundException('Filesystem document not found');
    }
    if (doc.uploadStatus !== 'complete') {
      throw new BadRequestException('Filesystem document upload is not complete');
    }
    if (
      doc.mimeType !== DOCX_MIME &&
      !doc.fileName.toLowerCase().endsWith('.docx')
    ) {
      throw new BadRequestException('Template must be a .docx Word document');
    }

    const template = await this.templatesRepo.upsertByType({
      tenantId: params.tenantId,
      documentType: params.documentType,
      data: {
        name: doc.fileName,
        filesystemDocumentId: doc.id,
        s3Key: null,
        isDefault: true,
      },
    });

    this.logger.log(
      `${logPrefix} — type=${params.documentType} filesystemDocumentId=${doc.id} templateId=${template.id}`,
    );
    return template;
  }

  async clearAssignment(params: {
    tenantId: string;
    documentType: DocumentType;
  }): Promise<{ cleared: boolean }> {
    const logPrefix = 'TemplateRegistryService.clearAssignment';
    const cleared = await this.templatesRepo.deleteByType({
      tenantId: params.tenantId,
      documentType: params.documentType,
    });
    this.logger.log(`${logPrefix} — type=${params.documentType} cleared=${cleared}`);
    return { cleared };
  }

  async resolve(params: {
    tenantId: string;
    documentType: DocumentType;
    templateId?: string;
  }): Promise<{ template: DocumentTemplateRow; fileBuffer: Buffer }> {
    const logPrefix = 'TemplateRegistryService.resolve';

    let template: DocumentTemplateRow | undefined;
    if (params.templateId) {
      template = await this.templatesRepo.findById({
        id: params.templateId,
        tenantId: params.tenantId,
      });
    } else {
      template = await this.templatesRepo.findByType({
        tenantId: params.tenantId,
        documentType: params.documentType,
      });
    }

    if (!template) {
      throw new NotFoundException(
        `No template assigned for ${params.documentType} — configure it under Admin → Document Templates.`,
      );
    }

    if (template.filesystemDocumentId) {
      this.logger.debug(
        `${logPrefix} — loading from filesystem document id=${template.filesystemDocumentId}`,
      );
      const fileBuffer = await this.downloadFilesystemDocument({
        tenantId: params.tenantId,
        documentId: template.filesystemDocumentId,
      });
      return { template, fileBuffer };
    }

    if (template.s3Key) {
      this.logger.debug(`${logPrefix} — loading from legacy s3Key=${template.s3Key}`);
      const url = await this.s3Service.getSignedDownloadUrl({ key: template.s3Key });
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download template from S3: ${response.statusText}`);
      }
      const fileBuffer = Buffer.from(await response.arrayBuffer());
      return { template, fileBuffer };
    }

    throw new NotFoundException(
      `No template file linked for ${params.documentType} — configure it under Admin → Document Templates.`,
    );
  }

  async findAll(params: {
    tenantId: string;
    documentType?: string;
  }): Promise<DocumentTemplateRow[]> {
    return this.templatesRepo.findByTenant(params);
  }

  async findById(params: {
    tenantId: string;
    id: string;
  }): Promise<DocumentTemplateRow | undefined> {
    return this.templatesRepo.findById({ id: params.id, tenantId: params.tenantId });
  }

  /** @deprecated Prefer assignFilesystemDocument — kept for legacy multipart uploads */
  async upload(params: {
    tenantId: string;
    documentType: DocumentType;
    name: string;
    fileBuffer: Buffer;
    isDefault?: boolean;
  }): Promise<DocumentTemplateRow> {
    const logPrefix = 'TemplateRegistryService.upload';
    const s3Key = this.buildS3Key({
      tenantId: params.tenantId,
      documentType: params.documentType,
      name: params.name,
    });

    this.logger.log(`${logPrefix} — uploading template s3Key=${s3Key}`);

    await this.s3Service.putJson({
      key: s3Key,
      body: params.fileBuffer,
      contentType: DOCX_MIME,
    });

    return this.templatesRepo.upsertByType({
      tenantId: params.tenantId,
      documentType: params.documentType,
      data: {
        name: params.name,
        filesystemDocumentId: null,
        s3Key,
        isDefault: params.isDefault ?? true,
      },
    });
  }

  private async downloadFilesystemDocument(params: {
    tenantId: string;
    documentId: string;
  }): Promise<Buffer> {
    const doc = await this.documentsRepo.findOne(params.documentId, params.tenantId);
    if (!doc) {
      throw new NotFoundException('Linked filesystem template document not found');
    }
    if (doc.uploadStatus !== 'complete') {
      throw new BadRequestException('Linked filesystem template document is not complete');
    }
    return this.gcsStorage.downloadBuffer(doc.gcsObjectPath);
  }

  private buildS3Key(params: {
    tenantId: string;
    documentType: string;
    name: string;
  }): string {
    const safeName = params.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
    return `templates/${params.tenantId}/${params.documentType}/${safeName}.docx`;
  }
}

export { SCENARIO_META, DOCUMENT_TYPE_TO_ENTITY_TYPE };


