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
    join(process.cwd(), 'data', 'templates', 'seed'),
    join(process.cwd(), '../../data/templates/seed'),
    join(process.cwd(), '../../../data/templates/seed'),
  ];
  return (
    candidates.find(
      (dir) => existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.docx')),
    ) ?? null
  );
}
export type ScenarioOutputFormat = 'docx' | 'pdf';

export interface ScenarioConfigStored {
  outputFormat?: ScenarioOutputFormat;
  /**
   * Legacy absolute category id. Migrated to slug+kind on read when still present.
   * @deprecated Prefer completedReportsFolderSlug + completedReportsFolderKind.
   */
  completedReportsFolderCategoryId?: string | null;
  /** Template folder slug; resolved against company or job filesystem at print time. */
  completedReportsFolderSlug?: string | null;
  completedReportsFolderKind?: 'company' | 'project' | null;
}

export interface TemplatesFolderInfo {
  id: string;
  displayName: string;
  slug: string;
  path: string;
  kind?: 'company' | 'project';
  jobId?: string | null;
}

export interface TemplatesFolderSetting {
  filesystemCategoryId: string | null;
  folder: TemplatesFolderInfo | null;
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
  outputFormat: ScenarioOutputFormat;
  completedReportsFolder: TemplatesFolderSetting;
}

interface OrgConfig extends Record<string, unknown> {
  documentTemplates?: {
    folderCategoryId?: string | null;
    scenarios?: Partial<Record<string, ScenarioConfigStored>>;
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
    description: 'Generated from an estimate (scope names and descriptions, no pricing)',
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
  document: {
    label: 'Document',
    description: 'Generated when printing a single document detail PDF',
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
  assessments_list: {
    label: 'Assessments List',
    description: 'Generated when printing the assessments register PDF',
  },
  documents_list: {
    label: 'Documents List',
    description: 'Generated when printing the documents register PDF',
  },
  schedule_list: {
    label: 'Schedule',
    description: 'Generated when printing the schedule / calendar PDF',
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
    const orgConfig = await this.readOrgConfig(params.tenantId);
    const scenarioConfigs = orgConfig.documentTemplates?.scenarios ?? {};

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

    const completedFolderIds = [
      ...new Set(
        ASSIGNABLE_TEMPLATE_TYPES.map((documentType) => {
          const id = scenarioConfigs[documentType]?.completedReportsFolderCategoryId;
          return typeof id === 'string' && id.length > 0 ? id : null;
        }).filter((id): id is string => id != null),
      ),
    ];
    const folderInfoById = new Map<string, TemplatesFolderInfo | null>();
    await Promise.all(
      completedFolderIds.map(async (categoryId) => {
        folderInfoById.set(categoryId, await this.resolveFolderInfo(categoryId));
      }),
    );

    const [companyTemplateCats, projectTemplateCats] = await Promise.all([
      this.filesystemService.getDefaultTemplateCategories('company'),
      this.filesystemService.getDefaultTemplateCategories('project'),
    ]);
    const companyTemplateBySlug = new Map(
      companyTemplateCats.map((cat) => [cat.slug, cat] as const),
    );
    const projectTemplateBySlug = new Map(
      projectTemplateCats.map((cat) => [cat.slug, cat] as const),
    );

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

      const scenarioConfig = scenarioConfigs[documentType];
      const completedFolder = this.buildCompletedReportsFolderSetting({
        scenarioConfig,
        folderInfoById,
        companyTemplateBySlug,
        projectTemplateBySlug,
      });

      settings.push({
        documentType,
        label: SCENARIO_META[documentType].label,
        description: SCENARIO_META[documentType].description,
        template,
        filesystemDocument,
        outputFormat: scenarioConfig?.outputFormat === 'pdf' ? 'pdf' : 'docx',
        completedReportsFolder: completedFolder,
      });
    }

    return settings;
  }

  private buildCompletedReportsFolderSetting(params: {
    scenarioConfig: ScenarioConfigStored | undefined;
    folderInfoById: Map<string, TemplatesFolderInfo | null>;
    companyTemplateBySlug: Map<
      string,
      { id: string; displayName: string; slug: string }
    >;
    projectTemplateBySlug: Map<
      string,
      { id: string; displayName: string; slug: string }
    >;
  }): TemplatesFolderSetting {
    const {
      scenarioConfig,
      folderInfoById,
      companyTemplateBySlug,
      projectTemplateBySlug,
    } = params;

    const completedFolderId =
      typeof scenarioConfig?.completedReportsFolderCategoryId === 'string' &&
      scenarioConfig.completedReportsFolderCategoryId.length > 0
        ? scenarioConfig.completedReportsFolderCategoryId
        : null;
    const fromId =
      completedFolderId != null
        ? folderInfoById.get(completedFolderId) ?? null
        : null;

    let kind = scenarioConfig?.completedReportsFolderKind ?? null;
    let slug =
      typeof scenarioConfig?.completedReportsFolderSlug === 'string' &&
      scenarioConfig.completedReportsFolderSlug.length > 0
        ? scenarioConfig.completedReportsFolderSlug
        : null;

    // Migrate legacy absolute category ids → slug + kind.
    if (!slug && fromId?.slug) {
      slug = fromId.slug;
      kind = fromId.kind ?? kind;
    }
    if (!kind && slug) {
      if (projectTemplateBySlug.has(slug)) kind = 'project';
      else if (companyTemplateBySlug.has(slug)) kind = 'company';
      else if (fromId?.kind) kind = fromId.kind;
    }

    if (!slug || (kind !== 'company' && kind !== 'project')) {
      return { filesystemCategoryId: null, folder: null };
    }

    const templateCat =
      kind === 'project'
        ? projectTemplateBySlug.get(slug)
        : companyTemplateBySlug.get(slug);
    const displayName =
      templateCat?.displayName ?? fromId?.displayName ?? slug;

    return {
      filesystemCategoryId: null,
      folder: {
        id: templateCat?.id ?? fromId?.id ?? '',
        displayName,
        slug,
        path: displayName,
        kind,
        jobId: null,
      },
    };
  }

  async setScenarioConfig(params: {
    tenantId: string;
    documentType: AssignableTemplateType;
    outputFormat?: ScenarioOutputFormat;
    completedReportsFolderCategoryId?: string | null;
    completedReportsFolderSlug?: string | null;
    completedReportsFolderKind?: 'company' | 'project' | null;
  }): Promise<ScenarioTemplateSetting> {
    const logPrefix = 'TemplateRegistryService.setScenarioConfig';

    if (!isAssignableTemplateType(params.documentType)) {
      throw new BadRequestException(`Invalid document type "${params.documentType}"`);
    }

    const config = await this.readOrgConfig(params.tenantId);
    const existingScenario =
      config.documentTemplates?.scenarios?.[params.documentType] ?? {};

    const nextScenario: ScenarioConfigStored = {
      ...existingScenario,
    };

    if (params.outputFormat !== undefined) {
      nextScenario.outputFormat = params.outputFormat;
    }

    const explicitClear =
      (params.completedReportsFolderSlug === null &&
        params.completedReportsFolderKind === null &&
        params.completedReportsFolderCategoryId === null) ||
      (params.completedReportsFolderSlug === null &&
        params.completedReportsFolderKind === null &&
        params.completedReportsFolderCategoryId === undefined);

    if (explicitClear) {
      nextScenario.completedReportsFolderCategoryId = null;
      nextScenario.completedReportsFolderSlug = null;
      nextScenario.completedReportsFolderKind = null;
    } else if (
      params.completedReportsFolderKind === 'company' ||
      params.completedReportsFolderKind === 'project'
    ) {
      const kind = params.completedReportsFolderKind;
      let slug = params.completedReportsFolderSlug?.trim() || null;

      // Allow legacy clients to send an instance/template category id; convert to slug.
      if (!slug && params.completedReportsFolderCategoryId) {
        const fromInstance = await this.resolveFolderInfo(
          params.completedReportsFolderCategoryId,
        );
        if (fromInstance?.slug) {
          slug = fromInstance.slug;
        } else {
          const templateCats =
            await this.filesystemService.getDefaultTemplateCategories(kind);
          const match = templateCats.find(
            (cat) => cat.id === params.completedReportsFolderCategoryId,
          );
          slug = match?.slug ?? null;
        }
      }

      if (!slug) {
        throw new BadRequestException(
          'completedReportsFolderSlug is required when setting a folder',
        );
      }

      const templateCats =
        await this.filesystemService.getDefaultTemplateCategories(kind);
      const match = templateCats.find((cat) => cat.slug === slug);
      if (!match) {
        throw new BadRequestException(
          `Folder slug "${slug}" was not found on the default ${kind} filesystem template`,
        );
      }

      nextScenario.completedReportsFolderKind = kind;
      nextScenario.completedReportsFolderSlug = match.slug;
      nextScenario.completedReportsFolderCategoryId = null;
    } else if (params.completedReportsFolderCategoryId) {
      // Legacy: category id only — infer kind/slug from instance or templates.
      const fromInstance = await this.resolveFolderInfo(
        params.completedReportsFolderCategoryId,
      );
      if (fromInstance?.slug && fromInstance.kind) {
        nextScenario.completedReportsFolderKind = fromInstance.kind;
        nextScenario.completedReportsFolderSlug = fromInstance.slug;
        nextScenario.completedReportsFolderCategoryId = null;
      } else {
        const [companyCats, projectCats] = await Promise.all([
          this.filesystemService.getDefaultTemplateCategories('company'),
          this.filesystemService.getDefaultTemplateCategories('project'),
        ]);
        const companyMatch = companyCats.find(
          (cat) => cat.id === params.completedReportsFolderCategoryId,
        );
        const projectMatch = projectCats.find(
          (cat) => cat.id === params.completedReportsFolderCategoryId,
        );
        if (projectMatch) {
          nextScenario.completedReportsFolderKind = 'project';
          nextScenario.completedReportsFolderSlug = projectMatch.slug;
          nextScenario.completedReportsFolderCategoryId = null;
        } else if (companyMatch) {
          nextScenario.completedReportsFolderKind = 'company';
          nextScenario.completedReportsFolderSlug = companyMatch.slug;
          nextScenario.completedReportsFolderCategoryId = null;
        } else {
          throw new BadRequestException(
            'Folder not found in the default company or project filesystem template',
          );
        }
      }
    }

    const nextConfig: OrgConfig = {
      ...config,
      documentTemplates: {
        ...(config.documentTemplates ?? {}),
        scenarios: {
          ...(config.documentTemplates?.scenarios ?? {}),
          [params.documentType]: nextScenario,
        },
      },
    };

    await this.db
      .update(organizations)
      .set({ config: nextConfig })
      .where(eq(organizations.id, params.tenantId));

    this.logger.log(
      `${logPrefix} — tenantId=${params.tenantId} documentType=${params.documentType}` +
        ` outputFormat=${nextScenario.outputFormat ?? 'docx'}` +
        ` folderKind=${nextScenario.completedReportsFolderKind ?? 'none'}` +
        ` folderSlug=${nextScenario.completedReportsFolderSlug ?? 'none'}`,
    );

    const settings = await this.getSettings({ tenantId: params.tenantId });
    const updated = settings.find((row) => row.documentType === params.documentType);
    if (!updated) {
      throw new NotFoundException(`Document type "${params.documentType}" not found`);
    }
    return updated;
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
      folder = await this.filesystemService.resolveCompanyCategoryInfo(
        params.filesystemCategoryId,
      );
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
    documentType: AssignableTemplateType;
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
    documentType: AssignableTemplateType;
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
          `${logPrefix} — GCS download failed; using local data/templates/seed fallback ` +
            `(type=${params.documentType}): ${err instanceof Error ? err.message : err}`,
        );
        return localBuffer;
      }
      throw err;
    }
  }

  async getTemplateContent(params: {
    tenantId: string;
    documentType: AssignableTemplateType;
  }): Promise<{ base64: string; fileName: string }> {
    const logPrefix = 'TemplateRegistryService.getTemplateContent';
    const { fileBuffer, template } = await this.resolve({
      tenantId: params.tenantId,
      documentType: params.documentType,
    });
    const fileName = template?.name ?? `${params.documentType}.docx`;
    this.logger.debug(`${logPrefix} — returning ${fileBuffer.length} bytes for ${fileName}`);
    return { base64: fileBuffer.toString('base64'), fileName };
  }

  async saveTemplateContent(params: {
    tenantId: string;
    documentType: AssignableTemplateType;
    docxBuffer: Buffer;
  }): Promise<{ success: boolean }> {
    const logPrefix = 'TemplateRegistryService.saveTemplateContent';
    const template = await this.templatesRepo.findByType({
      tenantId: params.tenantId,
      documentType: params.documentType,
    });
    if (!template?.filesystemDocumentId) {
      throw new NotFoundException(
        `No template assigned for "${params.documentType}" — assign a .docx first.`,
      );
    }

    const doc = await this.documentsRepo.findOne(
      template.filesystemDocumentId,
      params.tenantId,
    );
    if (!doc) {
      throw new NotFoundException('Linked filesystem template document not found');
    }

    await this.gcsStorage.uploadBuffer({
      objectPath: doc.gcsObjectPath,
      buffer: params.docxBuffer,
      contentType: DOCX_MIME,
    });

    this.logger.log(
      `${logPrefix} — saved ${params.docxBuffer.length} bytes to ${doc.gcsObjectPath}`,
    );
    return { success: true };
  }

  async getTemplateTags(params: {
    tenantId: string;
    documentType: AssignableTemplateType;
    templateEngineService: {
      getTemplateTags: (p: { templateBuffer: Buffer }) => Promise<string[]>;
    };
  }): Promise<{ tags: string[] }> {
    const logPrefix = 'TemplateRegistryService.getTemplateTags';
    const { fileBuffer } = await this.resolve({
      tenantId: params.tenantId,
      documentType: params.documentType,
    });
    const tags = await params.templateEngineService.getTemplateTags({
      templateBuffer: fileBuffer,
    });
    this.logger.debug(`${logPrefix} — found ${tags.length} tags`);
    return { tags };
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

  private async readOrgConfig(tenantId: string): Promise<OrgConfig> {
    const [row] = await this.db
      .select({ config: organizations.config })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);
    return (row?.config ?? {}) as OrgConfig;
  }

  private async readFolderCategoryId(tenantId: string): Promise<string | null> {
    const config = await this.readOrgConfig(tenantId);
    const id = config.documentTemplates?.folderCategoryId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }

  private async resolveFolderInfo(
    categoryId: string,
  ): Promise<TemplatesFolderInfo | null> {
    return this.filesystemService.resolveCategoryInfo(categoryId);
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
   * Matches by linked document fileName against `data/templates/seed/*.docx`.
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
