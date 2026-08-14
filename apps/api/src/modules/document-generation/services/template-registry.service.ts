import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { GcsStorageService } from '../../../common/gcs/gcs-storage.service';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { organizations } from '../../../database/schema';
import {
  DocumentTemplatesRepository,
  type DocumentTemplateRow,
} from '../../../database/repositories';
import { DocumentsRepository } from '../../../database/repositories/documents.repository';
import { FilesystemService } from '../../filesystem/filesystem.service';
import {
  ASSIGNABLE_TEMPLATE_TYPES,
  DEFAULT_DOCUMENT_TYPE,
  DOCUMENT_TYPE_TO_ENTITY_TYPE,
  isAssignableTemplateType,
  type AssignableTemplateType,
  type DocumentType,
} from '../types/document-types';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function normalizeTemplateKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function resolveLocalTemplatesDir(): string | null {
  const candidates = [
    join(process.cwd(), 'data', 'templates'),
    join(process.cwd(), '../../data/templates'),
    join(process.cwd(), '../../../data/templates'),
  ];
  return (
    candidates.find(
      (dir) => existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.docx')),
    ) ?? null
  );
}
export interface ScenarioTemplateSetting {
  documentType: AssignableTemplateType;
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

export interface TemplatesFolderInfo {
  id: string;
  displayName: string;
  slug: string;
  path: string;
}

export interface TemplatesFolderSetting {
  filesystemCategoryId: string | null;
  folder: TemplatesFolderInfo | null;
}

interface OrgConfig extends Record<string, unknown> {
  documentTemplates?: {
    folderCategoryId?: string | null;
  };
}

const SCENARIO_META: Record<AssignableTemplateType, { label: string; description: string }> = {
  default: {
    label: 'Default',
    description:
      'Used when a scenario has no dedicated template assigned',
  },
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
  job_details: {
    label: 'Job Details',
    description: 'Generated from the job print wizard (job summary PDF)',
  },
  scope_of_work: {
    label: 'Scope of Work',
    description: 'Generated from the job print wizard (scope of work PDF)',
  },
  claim: {
    label: 'Claim',
    description: 'Generated when printing a single claim detail PDF',
  },
  contact: {
    label: 'Contact',
    description: 'Generated when printing a single contact detail PDF',
  },
  task: {
    label: 'Task',
    description: 'Generated when printing a single task detail PDF',
  },
  appointment: {
    label: 'Appointment',
    description: 'Generated when printing a single appointment detail PDF',
  },
  message: {
    label: 'Message',
    description: 'Generated when printing a single message detail PDF',
  },
  journal: {
    label: 'Journal',
    description: 'Generated when printing a single journal detail PDF',
  },
  vendor: {
    label: 'Vendor',
    description: 'Generated when printing a single vendor detail PDF',
  },
  assessment: {
    label: 'Assessment',
    description: 'Generated when printing a single assessment detail PDF',
  },
  jobs_list: {
    label: 'Jobs List',
    description: 'Generated when printing the jobs register PDF',
  },
  quotes_list: {
    label: 'Quotes List',
    description: 'Generated when printing the quotes/estimates register PDF',
  },
  invoices_list: {
    label: 'Invoices List',
    description: 'Generated when printing the invoices register PDF',
  },
  bills_list: {
    label: 'Bills List',
    description: 'Generated when printing the bills register PDF',
  },
  work_orders_list: {
    label: 'Work Orders List',
    description: 'Generated when printing the work orders register PDF',
  },
  purchase_orders_list: {
    label: 'Purchase Orders List',
    description: 'Generated when printing the purchase orders register PDF',
  },
  proposals_list: {
    label: 'Proposals List',
    description: 'Generated when printing the proposals register PDF',
  },
  rfqs_list: {
    label: 'RFQs List',
    description: 'Generated when printing the RFQs register PDF',
  },
  reports_list: {
    label: 'Reports List',
    description: 'Generated when printing the reports register PDF',
  },
  claims_list: {
    label: 'Claims List',
    description: 'Generated when printing the claims register PDF',
  },
  contacts_list: {
    label: 'Contacts List',
    description: 'Generated when printing the contacts register PDF',
  },
  tasks_list: {
    label: 'Tasks List',
    description: 'Generated when printing the tasks register PDF',
  },
  appointments_list: {
    label: 'Appointments List',
    description: 'Generated when printing the appointments register PDF',
  },
  messages_list: {
    label: 'Messages List',
    description: 'Generated when printing the messages register PDF',
  },
  journals_list: {
    label: 'Journals List',
    description: 'Generated when printing the journals register PDF',
  },
  vendors_list: {
    label: 'Vendors List',
    description: 'Generated when printing the vendors register PDF',
  },
};

@Injectable()
export class TemplateRegistryService {
  private readonly logger = new Logger('TemplateRegistryService');

  constructor(
    private readonly templatesRepo: DocumentTemplatesRepository,
    private readonly documentsRepo: DocumentsRepository,
    private readonly gcsStorage: GcsStorageService,
    private readonly filesystemService: FilesystemService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async getSettings(params: { tenantId: string }): Promise<ScenarioTemplateSetting[]> {
    const templates = await this.templatesRepo.findByTenant({ tenantId: params.tenantId });
    const byType = new Map(templates.map((t) => [t.documentType, t]));

    const documentIds = [
      ...new Set(
        ASSIGNABLE_TEMPLATE_TYPES.map((documentType) => byType.get(documentType)?.filesystemDocumentId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const docs =
      documentIds.length > 0
        ? await this.documentsRepo.findByIds(documentIds, params.tenantId)
        : [];
    const docsById = new Map(docs.map((doc) => [doc.id, doc]));

    const settings: ScenarioTemplateSetting[] = [];
    for (const documentType of ASSIGNABLE_TEMPLATE_TYPES) {
      const template = byType.get(documentType) ?? null;
      let filesystemDocument: ScenarioTemplateSetting['filesystemDocument'] = null;

      if (template?.filesystemDocumentId) {
        const doc = docsById.get(template.filesystemDocumentId);
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

  async getFolderSetting(params: { tenantId: string }): Promise<TemplatesFolderSetting> {
    const logPrefix = 'TemplateRegistryService.getFolderSetting';
    const folderCategoryId = await this.readFolderCategoryId(params.tenantId);
    this.logger.debug(`${logPrefix} — tenantId=${params.tenantId} folderCategoryId=${folderCategoryId ?? 'none'}`);

    if (!folderCategoryId) {
      return { filesystemCategoryId: null, folder: null };
    }

    const folder = await this.resolveFolderInfo(folderCategoryId);
    return { filesystemCategoryId: folderCategoryId, folder };
  }

  async setFolderSetting(params: {
    tenantId: string;
    filesystemCategoryId: string | null;
  }): Promise<TemplatesFolderSetting> {
    const logPrefix = 'TemplateRegistryService.setFolderSetting';
    let folder: TemplatesFolderInfo | null = null;

    if (params.filesystemCategoryId) {
      folder = await this.resolveFolderInfo(params.filesystemCategoryId);
      if (!folder) {
        throw new BadRequestException(
          'Folder not found in the company filesystem',
        );
      }
    }

    const [row] = await this.db
      .select({ config: organizations.config })
      .from(organizations)
      .where(eq(organizations.id, params.tenantId))
      .limit(1);

    const config = ((row?.config ?? {}) as OrgConfig);
    const nextConfig: OrgConfig = {
      ...config,
      documentTemplates: {
        ...(config.documentTemplates ?? {}),
        folderCategoryId: params.filesystemCategoryId,
      },
    };

    await this.db
      .update(organizations)
      .set({ config: nextConfig })
      .where(eq(organizations.id, params.tenantId));

    this.logger.log(
      `${logPrefix} — tenantId=${params.tenantId} folderCategoryId=${params.filesystemCategoryId ?? 'cleared'}`,
    );

    return {
      filesystemCategoryId: params.filesystemCategoryId,
      folder,
    };
  }

  async assignFilesystemDocument(params: {
    tenantId: string;
    documentType: AssignableTemplateType;
    filesystemDocumentId: string;
  }): Promise<DocumentTemplateRow> {
    const logPrefix = 'TemplateRegistryService.assignFilesystemDocument';

    if (!isAssignableTemplateType(params.documentType)) {
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
    documentType: AssignableTemplateType;
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
    filesystemDocumentId?: string;
  }): Promise<{ template: DocumentTemplateRow | null; fileBuffer: Buffer }> {
    const logPrefix = 'TemplateRegistryService.resolve';

    if (params.filesystemDocumentId) {
      this.logger.debug(
        `${logPrefix} — loading override filesystem document id=${params.filesystemDocumentId}`,
      );
      const fileBuffer = await this.loadFilesystemDocumentBuffer({
        tenantId: params.tenantId,
        documentId: params.filesystemDocumentId,
        documentType: params.documentType,
      });
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
        if (template?.filesystemDocumentId !== params.filesystemDocumentId) {
          template = undefined;
        }
      }
      return { template: template ?? null, fileBuffer };
    }

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
      if (!template?.filesystemDocumentId) {
        const fallback = await this.templatesRepo.findByType({
          tenantId: params.tenantId,
          documentType: DEFAULT_DOCUMENT_TYPE,
        });
        if (fallback?.filesystemDocumentId) {
          this.logger.log(
            `${logPrefix} — no template for type=${params.documentType}; using default id=${fallback.id}`,
          );
          template = fallback;
        }
      }
    }

    if (!template) {
      throw new NotFoundException(
        `No template assigned for ${params.documentType} and no Default template is configured — configure it under Admin → Document Templates.`,
      );
    }

    if (!template.filesystemDocumentId) {
      throw new NotFoundException(
        `No filesystem .docx linked for ${params.documentType} — configure it under Admin → Document Templates.`,
      );
    }

    this.logger.debug(
      `${logPrefix} — loading from GCS via filesystem document id=${template.filesystemDocumentId}`,
    );
    const fileBuffer = await this.loadFilesystemDocumentBuffer({
      tenantId: params.tenantId,
      documentId: template.filesystemDocumentId,
      documentType: params.documentType,
    });
    return { template, fileBuffer };
  }

  private async loadFilesystemDocumentBuffer(params: {
    tenantId: string;
    documentId: string;
    documentType: DocumentType;
  }): Promise<Buffer> {
    const logPrefix = 'TemplateRegistryService.loadFilesystemDocumentBuffer';
    try {
      return await this.downloadFilesystemDocument({
        tenantId: params.tenantId,
        documentId: params.documentId,
      });
    } catch (err) {
      const localBuffer = await this.tryLoadLocalTemplateFallback({
        tenantId: params.tenantId,
        documentId: params.documentId,
      });
      if (localBuffer) {
        this.logger.warn(
          `${logPrefix} — GCS download failed; using local data/templates fallback ` +
            `(type=${params.documentType}): ${err instanceof Error ? err.message : err}`,
        );
        return localBuffer;
      }
      throw err;
    }
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

  private async readFolderCategoryId(tenantId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ config: organizations.config })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);
    const config = (row?.config ?? {}) as OrgConfig;
    const id = config.documentTemplates?.folderCategoryId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }

  private async resolveFolderInfo(
    categoryId: string,
  ): Promise<TemplatesFolderInfo | null> {
    return this.filesystemService.resolveCompanyCategoryInfo(categoryId);
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

  /**
   * Dev fallback when ADC lacks GCS read access to provisioned template objects.
   * Matches by linked document fileName against `data/templates/*.docx`.
   */
  private async tryLoadLocalTemplateFallback(params: {
    tenantId: string;
    documentId: string;
  }): Promise<Buffer | null> {
    const logPrefix = 'TemplateRegistryService.tryLoadLocalTemplateFallback';
    const localDir = resolveLocalTemplatesDir();
    if (!localDir) return null;

    const doc = await this.documentsRepo.findOne(params.documentId, params.tenantId);
    const fileName = doc?.fileName;
    if (!fileName) return null;

    const targetKey = normalizeTemplateKey(fileName);
    const match = readdirSync(localDir)
      .filter((f) => f.endsWith('.docx'))
      .find(
        (f) =>
          f.toLowerCase() === fileName.toLowerCase() ||
          normalizeTemplateKey(f) === targetKey,
      );

    if (!match) {
      this.logger.debug(
        `${logPrefix} — no local match for fileName=${fileName} in ${localDir}`,
      );
      return null;
    }

    const buffer = readFileSync(join(localDir, match));
    this.logger.log(
      `${logPrefix} — loaded ${match} from ${localDir} (${buffer.length} bytes)`,
    );
    return buffer;
  }
}

export { SCENARIO_META, DOCUMENT_TYPE_TO_ENTITY_TYPE };
