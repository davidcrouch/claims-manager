import {
  Injectable,
  Logger,
  Inject,
} from '@nestjs/common';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { organizations } from '../../database/schema';
import { TenantContext } from '../../tenant/tenant-context';
import { FilesystemService } from '../filesystem/filesystem.service';
import { DocumentsService } from '../filesystem/documents.service';
import { TemplateRegistryService } from '../document-generation/services/template-registry.service';
import { seedCatalogDevForTenant } from '../../database/seeds/entries/catalog-dev.seed';
import {
  DOCUMENT_TYPES,
  type DocumentType,
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

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const DOCUMENT_TYPE_TO_FILE: Record<DocumentType, string> = {
  invoice: 'TAX_INVOICE.docx',
  bill: 'INVOICE.docx',
  rfq: 'REQUEST_FOR_QUOTATION.docx',
  quote: 'REQUEST_FOR_QUOTATION.docx',
  purchase_order: 'REQUEST_FOR_QUOTATION.docx',
  work_order: 'SCOPE_OF_WORK.docx',
  proposal: 'SCOPE_OF_WORK.docx',
  report: 'SCOPE_OF_WORK.docx',
};

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(LOG);
  private readonly storage: Storage | null;
  private readonly bucket: string;

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

  async startProvisioning(): Promise<ProvisioningStatusResponse> {
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

    if (org.provisioningStatus === 'complete') {
      return this.getStatus();
    }

    if (org.provisioningStatus === 'provisioning') {
      return this.getStatus();
    }

    await this.db
      .update(organizations)
      .set({
        provisioningStatus: 'provisioning',
        provisioningStartedAt: new Date(),
      })
      .where(eq(organizations.id, tenantId));

    this.logger.log(`[${LOG}.${fn}] starting provisioning tenantId=${tenantId}`);

    try {
      await this.runStep('filesystem_setup', tenantId);
      await this.runStep('upload_templates', tenantId);
      await this.runStep('assign_document_templates', tenantId);
      await this.runStep('seed_catalog', tenantId);

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
    }

    return this.getStatus();
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
    }

    this.logger.log(`[${LOG}.${fn}] done tenantId=${tenantId}`);
  }

  private async stepFilesystemSetup(): Promise<void> {
    const existing = await this.filesystemService.getFilesystem();
    if (existing && existing.categories.length > 0) {
      this.logger.log(`[${LOG}.stepFilesystemSetup] already set up — skipping`);
      return;
    }

    try {
      await this.filesystemService.setupFromDefault();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('already set up')
      ) {
        return;
      }
      throw error;
    }
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

    for (const { fileName, buffer } of templateFiles) {
      const existingDocs = await this.documentsService.findAll({
        categoryId: templatesCategory.id,
        search: fileName,
        uploadStatus: 'complete',
      });
      if (
        existingDocs.data.some(
          (d: { fileName: string }) =>
            d.fileName.toLowerCase() === fileName.toLowerCase(),
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

      await this.documentsService.markUploadComplete(uploadResult.documentId);

      this.logger.log(
        `[${LOG}.stepUploadTemplates] uploaded "${fileName}" id=${uploadResult.documentId}`,
      );
    }
  }

  /**
   * Load platform templates from GCS platform prefix, falling back to local
   * `data/templates/` for dev environments where CI hasn't synced to GCS yet.
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
      join(process.cwd(), 'data', 'templates'),
      join(process.cwd(), '../../data/templates'),
      join(process.cwd(), '../../../data/templates'),
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

    const allDocs = await this.documentsService.findAll({
      categoryId: templatesCategory.id,
      uploadStatus: 'complete',
    });

    const docxDocs = allDocs.data.filter((d: { fileName: string }) =>
      d.fileName.toLowerCase().endsWith('.docx'),
    );
    if (docxDocs.length === 0) return;

    for (const documentType of DOCUMENT_TYPES) {
      const targetFile = DOCUMENT_TYPE_TO_FILE[documentType];
      const matchingDoc = docxDocs.find(
        (d: { fileName: string }) =>
          d.fileName.replace(/\s+/g, '_').toUpperCase() === targetFile.toUpperCase() ||
          d.fileName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() ===
            targetFile.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(),
      );

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
      default:
        return false;
    }
  }
}
