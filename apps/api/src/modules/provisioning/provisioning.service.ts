import {
  Injectable,
  Logger,
  Inject,
} from '@nestjs/common';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { lookupValues, mcpIntegration, organizations } from '../../database/schema';
import { TenantContext } from '../../tenant/tenant-context';
import { FilesystemService } from '../filesystem/filesystem.service';
import { DocumentsService } from '../filesystem/documents.service';
import { TemplateRegistryService } from '../document-generation/services/template-registry.service';
import { seedCatalogDevForTenant } from '../../database/seeds/entries/catalog-dev.seed';
import { seedLookupsForTenant } from '../../database/seeds/entries/lookups.seed';
import { seedMcpForTenant } from '../../database/seeds/entries/mcp.seed';
import { seedAssessmentSkillsForTenant } from '../../database/seeds/entries/assessment-skills.seed';
import filesystemDefaultSeed from '../../database/seeds/entries/filesystem-default.seed';
import {
  ASSIGNABLE_TEMPLATE_TYPES,
  type AssignableTemplateType,
} from '../document-generation/types/document-types';
import {
  PROVISIONING_STEPS,
  PLATFORM_TEMPLATES_PREFIX,
  STEP_LABELS,
  type ProvisioningStatus,
  type ProvisioningStep,
  type ProvisioningStepStatus,
  type ProvisioningStatusResponse,
} from './provisioning.types';

const LOG = 'ProvisioningService';

/** Process-wide lock. ProvisioningService is request-scoped (TenantContext), so an instance Set is empty on every GET. */
const activeProvisioningTenants = new Set<string>();

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Canonical filenames under data/templates/seed/ (spaces, as stored in document.file_name). */
const SOW = 'Scope of Work Template.docx';
const INVOICE = 'Invoice Template.docx';
const RFQ = 'Request for Quotation Template.docx';
const PO = 'Purchase Order Template.docx';
const ASSESSMENT = 'Assessment Template.docx';

const DOCUMENT_TYPE_TO_FILE: Record<AssignableTemplateType, string> = {
  default: SOW,
  invoice: INVOICE,
  bill: INVOICE,
  rfq: RFQ,
  quote: RFQ,
  purchase_order: PO,
  work_order: SOW,
  proposal: SOW,
  report: SOW,
  job_details: SOW,
  scope_of_work: SOW,
  claim: SOW,
  contact: SOW,
  task: SOW,
  appointment: SOW,
  message: SOW,
  journal: SOW,
  vendor: SOW,
  assessment: ASSESSMENT,
  document: SOW,
  jobs_list: SOW,
  quotes_list: SOW,
  invoices_list: SOW,
  bills_list: SOW,
  work_orders_list: SOW,
  purchase_orders_list: SOW,
  proposals_list: SOW,
  rfqs_list: SOW,
  reports_list: SOW,
  claims_list: SOW,
  contacts_list: SOW,
  tasks_list: SOW,
  appointments_list: SOW,
  messages_list: SOW,
  journals_list: SOW,
  vendors_list: SOW,
  assessments_list: SOW,
  documents_list: SOW,
  schedule_list: SOW,
};

function normalizeTemplateKey(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(LOG);
  private readonly storage: Storage | null;
  private readonly bucket: string;
  /** Template choices for the in-flight provisioning run (request-scoped on this instance). */
  private pendingFilesystemOptions: {
    companyFilesystemTemplateId?: string;
    defaultProjectFilesystemTemplateId?: string;
  } | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tenantContext: TenantContext,
    private readonly filesystemService: FilesystemService,
    private readonly documentsService: DocumentsService,
    private readonly templateRegistry: TemplateRegistryService,
    private readonly configService: ConfigService,
  ) {
    const projectId = this.configService.get<string>('gcs.projectId');
    this.bucket = this.configService.get<string>('gcs.documentsBucket') ?? '';
    this.storage =
      projectId && this.bucket ? new Storage({ projectId }) : null;
  }

  async getStatus(): Promise<ProvisioningStatusResponse> {
    const tenantId = this.tenantContext.getTenantId();
    const [org] = await this.db
      .select({
        provisioningStatus: organizations.provisioningStatus,
        provisioningStartedAt: organizations.provisioningStartedAt,
        provisioningCompletedAt: organizations.provisioningCompletedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (!org) {
      return {
        provisioningStatus: 'pending',
        steps: this.buildStepStatuses('pending'),
        startedAt: null,
        completedAt: null,
      };
    }

    const status = org.provisioningStatus as ProvisioningStatus;
    return {
      provisioningStatus: status,
      steps: await this.computeStepStatuses(tenantId, status),
      startedAt: org.provisioningStartedAt?.toISOString() ?? null,
      completedAt: org.provisioningCompletedAt?.toISOString() ?? null,
    };
  }

  async startProvisioning(options?: {
    companyFilesystemTemplateId?: string;
    defaultProjectFilesystemTemplateId?: string;
  }): Promise<ProvisioningStatusResponse> {
    const tenantId = this.tenantContext.getTenantId();
    const fn = 'startProvisioning';

    const [org] = await this.db
      .select({ provisioningStatus: organizations.provisioningStatus })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (!org) {
      throw new Error(`${LOG}.${fn} — organization not found tenantId=${tenantId}`);
    }

    if (org.provisioningStatus === 'provisioning' && activeProvisioningTenants.has(tenantId)) {
      this.logger.log(`[${LOG}.${fn}] already running in-process tenantId=${tenantId}`);
      return this.getStatus();
    }

    // Stale lock after process restart: DB says provisioning but no in-process run.
    if (org.provisioningStatus === 'provisioning' && !activeProvisioningTenants.has(tenantId)) {
      this.logger.warn(
        `[${LOG}.${fn}] stale provisioning lock — resuming tenantId=${tenantId}`,
      );
      void this.runProvisioning(tenantId);
      return this.getStatus();
    }

    // Complete orgs still re-run template upload/assign (idempotent). Covers
    // cases where GCS was unset on first provision and docx were skipped.
    if (org.provisioningStatus === 'complete') {
      this.logger.log(
        `[${LOG}.${fn}] repair path — re-running template + mcp + lookups steps tenantId=${tenantId}`,
      );
      void this.runRepairSteps(tenantId);
      return this.getStatus();
    }

    this.pendingFilesystemOptions = {
      companyFilesystemTemplateId: options?.companyFilesystemTemplateId,
      defaultProjectFilesystemTemplateId: options?.defaultProjectFilesystemTemplateId,
    };

    void this.runProvisioning(tenantId);
    return this.getStatus();
  }

  /**
   * Runs remaining first-login steps. Safe to call after a process restart
   * left organizations.provisioning_status stuck at 'provisioning'.
   */
  private async runProvisioning(tenantId: string): Promise<void> {
    const fn = 'runProvisioning';
    if (activeProvisioningTenants.has(tenantId)) {
      this.logger.log(`[${LOG}.${fn}] already running tenantId=${tenantId} — skipping`);
      return;
    }
    activeProvisioningTenants.add(tenantId);

    try {
      await this.db
        .update(organizations)
        .set({
          provisioningStatus: 'provisioning',
          provisioningStartedAt: new Date(),
        })
        .where(eq(organizations.id, tenantId));

      this.logger.log(`[${LOG}.${fn}] starting provisioning tenantId=${tenantId}`);

      await this.runStep('filesystem_setup', tenantId);
      await this.runStep('upload_templates', tenantId);
      await this.runStep('assign_document_templates', tenantId);
      await this.runStep('seed_catalog', tenantId);
      await this.runStep('seed_lookups', tenantId);
      await this.runStep('seed_mcp', tenantId);

      await this.db
        .update(organizations)
        .set({
          provisioningStatus: 'complete',
          provisioningCompletedAt: new Date(),
        })
        .where(eq(organizations.id, tenantId));

      this.logger.log(`[${LOG}.${fn}] provisioning complete tenantId=${tenantId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${LOG}.${fn}] provisioning failed tenantId=${tenantId}: ${message}`);

      await this.db
        .update(organizations)
        .set({ provisioningStatus: 'failed' })
        .where(eq(organizations.id, tenantId));
    } finally {
      activeProvisioningTenants.delete(tenantId);
    }
  }

  private async runRepairSteps(tenantId: string): Promise<void> {
    const fn = 'runRepairSteps';
    try {
      await this.runStep('upload_templates', tenantId);
      await this.runStep('assign_document_templates', tenantId);
      await this.runStep('seed_mcp', tenantId);
      await this.runStep('seed_lookups', tenantId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${LOG}.${fn}] repair failed tenantId=${tenantId}: ${message}`);
    }
  }

  private async runStep(step: ProvisioningStep, tenantId: string): Promise<void> {
    const fn = `runStep.${step}`;
    this.logger.log(`[${LOG}.${fn}] start tenantId=${tenantId}`);

    switch (step) {
      case 'filesystem_setup':
        await this.stepFilesystemSetup();
        break;
      case 'upload_templates':
        await this.stepUploadTemplates(tenantId);
        break;
      case 'assign_document_templates':
        await this.stepAssignDocumentTemplates(tenantId);
        break;
      case 'seed_catalog':
        await this.stepSeedCatalog(tenantId);
        break;
      case 'seed_lookups':
        await this.stepSeedLookups(tenantId);
        break;
      case 'seed_mcp':
        await this.stepSeedMcp(tenantId);
        break;
    }

    this.logger.log(`[${LOG}.${fn}] done tenantId=${tenantId}`);
  }

  private async stepFilesystemSetup(): Promise<void> {
    // Platform Company/Project templates are not created by per-tenant seed;
    // ensure they exist after a fresh DB (idempotent upsert).
    await this.ensurePlatformFilesystemTemplates();

    const options = this.pendingFilesystemOptions;
    this.pendingFilesystemOptions = null;

    try {
      await this.filesystemService.provisionCompanyFilesystem({
        companyTemplateId: options?.companyFilesystemTemplateId,
        defaultProjectTemplateId: options?.defaultProjectFilesystemTemplateId,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('already set up')
      ) {
        this.logger.log(`[${LOG}.stepFilesystemSetup] already set up — skipping`);
        return;
      }
      throw error;
    }
  }

  private async ensurePlatformFilesystemTemplates(): Promise<void> {
    const fn = 'ensurePlatformFilesystemTemplates';
    this.logger.log(`[${LOG}.${fn}] ensuring platform filesystem templates`);
    const result = await filesystemDefaultSeed.run({
      db: this.db,
      logger: {
        info: (msg) => this.logger.log(`[${LOG}.${fn}] ${msg}`),
        warn: (msg) => this.logger.warn(`[${LOG}.${fn}] ${msg}`),
        error: (msg) => this.logger.error(`[${LOG}.${fn}] ${msg}`),
      },
    });
    this.logger.log(
      `[${LOG}.${fn}] done inserted=${result.inserted} updated=${result.updated} skipped=${result.skipped}`,
    );
  }

  private async stepUploadTemplates(tenantId: string): Promise<void> {
    if (!this.storage) {
      this.logger.warn(
        `[${LOG}.stepUploadTemplates] GCS not configured — skipping template upload`,
      );
      return;
    }

    const filesystem = await this.filesystemService.getFilesystem();
    if (!filesystem) {
      throw new Error('Filesystem not set up — cannot upload templates');
    }

    const templatesCategory = filesystem.categories.find(
      (c: { slug: string }) => c.slug === 'TEMPLATES_FORMS',
    );
    if (!templatesCategory) {
      this.logger.warn(
        `[${LOG}.stepUploadTemplates] TEMPLATES_FORMS category not found — skipping`,
      );
      return;
    }

    const templateFiles = await this.loadPlatformTemplates();
    if (templateFiles.length === 0) {
      this.logger.warn(
        `[${LOG}.stepUploadTemplates] no template files available — skipping`,
      );
      return;
    }

    try {
      for (const { fileName, buffer } of templateFiles) {
        const existingDocs = await this.documentsService.findAll({
          categoryId: templatesCategory.id,
          search: fileName,
        });
        if (
          existingDocs.data.some(
            (d: { fileName: string; uploadStatus?: string }) =>
              d.fileName.toLowerCase() === fileName.toLowerCase() &&
              d.uploadStatus !== 'failed',
          )
        ) {
          this.logger.log(
            `[${LOG}.stepUploadTemplates] "${fileName}" already exists — skipping`,
          );
          continue;
        }

        const uploadResult = await this.documentsService.generateUploadUrl({
          fileName,
          mimeType: DOCX_MIME,
          fileSizeBytes: buffer.length,
          categoryId: templatesCategory.id,
        });

        await this.storage
          .bucket(this.bucket)
          .file(uploadResult.storageKey)
          .save(buffer, { contentType: DOCX_MIME, resumable: false });

        await this.documentsService.markUploadComplete(
          uploadResult.documentId,
          undefined,
          { skipThumbnail: true },
        );

        this.logger.log(
          `[${LOG}.stepUploadTemplates] uploaded "${fileName}" id=${uploadResult.documentId}`,
        );
      }
    } catch (error) {
      if (this.isLocalGcsPermissionDenied(error)) {
        this.logger.warn(
          `[${LOG}.stepUploadTemplates] GCS not writable — skipping Word template upload. ADC is not an account with storage.objects.create on bucket=${this.bucket}. Run: gcloud auth application-default login`,
        );
        return;
      }
      throw error;
    }
  }

  /** Local/dev ADC often still points at an account without bucket IAM. */
  private isLocalGcsPermissionDenied(error: unknown): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    const code =
      error && typeof error === 'object' && 'code' in error
        ? Number((error as { code: unknown }).code)
        : NaN;
    const message = error instanceof Error ? error.message : String(error);
    return (
      code === 403 ||
      message.includes('storage.objects.') ||
      message.includes('"code": 403')
    );
  }

  /**
   * Load platform templates from GCS platform prefix, falling back to local
   * `data/templates/seed/` for dev environments where CI hasn't synced to GCS yet.
   */
  private async loadPlatformTemplates(): Promise<
    Array<{ fileName: string; buffer: Buffer }>
  > {
    const results: Array<{ fileName: string; buffer: Buffer }> = [];

    if (this.storage) {
      try {
        const [files] = await this.storage
          .bucket(this.bucket)
          .getFiles({ prefix: PLATFORM_TEMPLATES_PREFIX });

        const docxFiles = files.filter((f) => f.name.endsWith('.docx'));
        if (docxFiles.length > 0) {
          for (const file of docxFiles) {
            const rawName = file.name.split('/').pop()!;
            const fileName = rawName.replace(/_/g, ' ');
            const [buffer] = await file.download();
            results.push({ fileName, buffer });
          }
          this.logger.log(
            `[${LOG}.loadPlatformTemplates] loaded ${results.length} files from GCS platform prefix`,
          );
          return results;
        }
      } catch (err) {
        this.logger.warn(
          `[${LOG}.loadPlatformTemplates] GCS platform prefix read failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    const localCandidates = [
      join(process.cwd(), 'data', 'templates', 'seed'),
      join(process.cwd(), '../../data/templates/seed'),
      join(process.cwd(), '../../../data/templates/seed'),
    ];
    const localDir = localCandidates.find(
      (dir) => existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.docx')),
    );

    if (localDir) {
      const files = readdirSync(localDir).filter((f) => f.endsWith('.docx'));
      for (const file of files) {
        results.push({
          fileName: file,
          buffer: readFileSync(join(localDir, file)),
        });
      }
      this.logger.log(
        `[${LOG}.loadPlatformTemplates] loaded ${results.length} files from local fallback ${localDir}`,
      );
    }

    return results;
  }

  private async stepAssignDocumentTemplates(tenantId: string): Promise<void> {
    const filesystem = await this.filesystemService.getFilesystem();
    if (!filesystem) return;

    const templatesCategory = filesystem.categories.find(
      (c: { slug: string }) => c.slug === 'TEMPLATES_FORMS',
    );
    if (!templatesCategory) return;

    await this.templateRegistry.setFolderSetting({
      tenantId,
      filesystemCategoryId: templatesCategory.id,
    });

    const allDocs = await this.documentsService.findAll({
      categoryId: templatesCategory.id,
      uploadStatus: 'complete',
      limit: 100,
    });

    const docxDocs = allDocs.data.filter((d: { fileName: string }) =>
      (d.fileName ?? '').toLowerCase().endsWith('.docx'),
    );
    if (docxDocs.length === 0) return;

    this.logger.log(
      `[${LOG}.stepAssignDocumentTemplates] candidates=${docxDocs.map((d) => d.fileName).join(', ')}`,
    );

    for (const documentType of ASSIGNABLE_TEMPLATE_TYPES) {
      const targetFile = DOCUMENT_TYPE_TO_FILE[documentType];
      const targetKey = normalizeTemplateKey(targetFile);
      const matchingDoc = docxDocs.find((d: { fileName: string }) => {
        const name = d.fileName ?? '';
        if (name.toLowerCase() === targetFile.toLowerCase()) return true;
        return normalizeTemplateKey(name) === targetKey;
      });

      if (!matchingDoc) {
        this.logger.warn(
          `[${LOG}.stepAssignDocumentTemplates] no matching doc for type=${documentType} target=${targetFile}`,
        );
        continue;
      }

      await this.templateRegistry.assignFilesystemDocument({
        tenantId,
        documentType,
        filesystemDocumentId: matchingDoc.id,
      });
    }
  }

  private async stepSeedCatalog(tenantId: string): Promise<void> {
    const logger = {
      info: (msg: string) => this.logger.log(`[${LOG}.stepSeedCatalog] ${msg}`),
      warn: (msg: string) => this.logger.warn(`[${LOG}.stepSeedCatalog] ${msg}`),
      error: (msg: string) => this.logger.error(`[${LOG}.stepSeedCatalog] ${msg}`),
    };

    await seedCatalogDevForTenant({ db: this.db, tenantId, logger });
  }

  private async stepSeedLookups(tenantId: string): Promise<void> {
    const logger = {
      info: (msg: string) => this.logger.log(`[${LOG}.stepSeedLookups] ${msg}`),
      warn: (msg: string) => this.logger.warn(`[${LOG}.stepSeedLookups] ${msg}`),
      error: (msg: string) => this.logger.error(`[${LOG}.stepSeedLookups] ${msg}`),
    };

    await seedLookupsForTenant({ db: this.db, tenantId, logger });
  }

  private async stepSeedMcp(tenantId: string): Promise<void> {
    const logger = {
      info: (msg: string) => this.logger.log(`[${LOG}.stepSeedMcp] ${msg}`),
      warn: (msg: string) => this.logger.warn(`[${LOG}.stepSeedMcp] ${msg}`),
      error: (msg: string) => this.logger.error(`[${LOG}.stepSeedMcp] ${msg}`),
    };

    await seedMcpForTenant({ db: this.db, tenantId, logger });
    await seedAssessmentSkillsForTenant({ db: this.db, tenantId, logger });
  }

  private buildStepStatuses(
    overallStatus: ProvisioningStatus,
  ): ProvisioningStepStatus[] {
    return PROVISIONING_STEPS.map((step) => ({
      step,
      label: STEP_LABELS[step],
      status: overallStatus === 'complete' ? 'done' : 'pending',
    }));
  }

  private async computeStepStatuses(
    tenantId: string,
    overallStatus: ProvisioningStatus,
  ): Promise<ProvisioningStepStatus[]> {
    if (overallStatus === 'complete') {
      return this.buildStepStatuses('complete');
    }
    if (overallStatus === 'pending') {
      return this.buildStepStatuses('pending');
    }

    const statuses: ProvisioningStepStatus[] = [];
    for (const step of PROVISIONING_STEPS) {
      const done = await this.isStepDone(step, tenantId);
      statuses.push({
        step,
        label: STEP_LABELS[step],
        status: done ? 'done' : overallStatus === 'failed' ? 'failed' : 'running',
      });
      if (!done && overallStatus !== 'failed') break;
    }

    const remaining = PROVISIONING_STEPS.slice(statuses.length);
    for (const step of remaining) {
      statuses.push({ step, label: STEP_LABELS[step], status: 'pending' });
    }

    return statuses;
  }

  private async isStepDone(step: ProvisioningStep, tenantId: string): Promise<boolean> {
    switch (step) {
      case 'filesystem_setup': {
        const fs = await this.filesystemService.getFilesystem();
        return !!(fs && fs.categories.length > 0);
      }
      case 'upload_templates': {
        const fs = await this.filesystemService.getFilesystem();
        if (!fs) return false;
        const cat = fs.categories.find((c: { slug: string }) => c.slug === 'TEMPLATES_FORMS');
        if (!cat) return false;
        const docs = await this.documentsService.findAll({
          categoryId: cat.id,
          uploadStatus: 'complete',
        });
        return docs.data.some((d: { fileName: string }) =>
          d.fileName.toLowerCase().endsWith('.docx'),
        );
      }
      case 'assign_document_templates': {
        const settings = await this.templateRegistry.getSettings({ tenantId });
        return settings.some((s) => s.template !== null);
      }
      case 'seed_catalog':
        return true;
      case 'seed_lookups': {
        const [row] = await this.db
          .select({ id: lookupValues.id })
          .from(lookupValues)
          .where(
            and(
              eq(lookupValues.tenantId, tenantId),
              eq(lookupValues.domain, 'group_label'),
            ),
          )
          .limit(1);
        return !!row;
      }
      case 'seed_mcp': {
        const [row] = await this.db
          .select({ id: mcpIntegration.id })
          .from(mcpIntegration)
          .where(
            and(
              eq(mcpIntegration.tenantId, tenantId),
              eq(mcpIntegration.name, 'Claims Tools'),
            ),
          )
          .limit(1);
        return !!row;
      }
      default:
        return false;
    }
  }
}
