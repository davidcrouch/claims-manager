/**
 * @deprecated — No longer registered in the seed runner. Document template
 * uploads are now handled by first-login provisioning (ProvisioningService)
 * which goes through the real API pipeline (thumbnails, pipelines, etc.).
 *
 * This file is kept for reference only. Do not re-register it in index.ts.
 *
 * See: apps/api/src/modules/provisioning/provisioning.service.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Storage } from '@google-cloud/storage';
import { and, eq, isNull } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import { templatesDir } from '../lib/catalog-data-paths';
import * as schema from '../../schema';
import type { AssignableTemplateType } from '../../../modules/document-generation/types/document-types';
import { ASSIGNABLE_TEMPLATE_TYPES } from '../../../modules/document-generation/types/document-types';

const LOG = '[seeds/document-templates]';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const TEMPLATES_FORMS_SLUG = 'TEMPLATES_FORMS';

const ADC_REAUTH_REQUIRED_RE =
  /invalid_grant|invalid_rapt|reauth related error|credentials expired/i;

function isGcsAuthError(err: unknown): boolean {
  const message =
    err instanceof Error
      ? `${err.message} ${JSON.stringify((err as { response?: { data?: unknown } }).response?.data ?? {})}`
      : String(err);
  return ADC_REAUTH_REQUIRED_RE.test(message);
}

/** Files expected under `data/templates/`. */
const TEMPLATE_FILES = [
  'INVOICE.docx',
  'TAX INVOICE.docx',
  'SCOPE OF WORK.docx',
  'REQUEST FOR QUOTATION.docx',
] as const;

/**
 * Map each Document Templates scenario to one of the standard Word files.
 * Scenarios without a dedicated file reuse the closest match.
 */
const DOCUMENT_TYPE_TO_FILE: Record<AssignableTemplateType, (typeof TEMPLATE_FILES)[number]> = {
  default: 'SCOPE OF WORK.docx',
  invoice: 'TAX INVOICE.docx',
  bill: 'INVOICE.docx',
  rfq: 'REQUEST FOR QUOTATION.docx',
  quote: 'REQUEST FOR QUOTATION.docx',
  purchase_order: 'REQUEST FOR QUOTATION.docx',
  work_order: 'SCOPE OF WORK.docx',
  proposal: 'SCOPE OF WORK.docx',
  report: 'SCOPE OF WORK.docx',
  job_details: 'SCOPE OF WORK.docx',
  scope_of_work: 'SCOPE OF WORK.docx',
  claim: 'SCOPE OF WORK.docx',
  contact: 'SCOPE OF WORK.docx',
  task: 'SCOPE OF WORK.docx',
  appointment: 'SCOPE OF WORK.docx',
  message: 'SCOPE OF WORK.docx',
  journal: 'SCOPE OF WORK.docx',
  vendor: 'SCOPE OF WORK.docx',
  assessment: 'SCOPE OF WORK.docx',
  document: 'SCOPE OF WORK.docx',
  jobs_list: 'SCOPE OF WORK.docx',
  quotes_list: 'SCOPE OF WORK.docx',
  invoices_list: 'SCOPE OF WORK.docx',
  bills_list: 'SCOPE OF WORK.docx',
  work_orders_list: 'SCOPE OF WORK.docx',
  purchase_orders_list: 'SCOPE OF WORK.docx',
  proposals_list: 'SCOPE OF WORK.docx',
  rfqs_list: 'SCOPE OF WORK.docx',
  reports_list: 'SCOPE OF WORK.docx',
  claims_list: 'SCOPE OF WORK.docx',
  contacts_list: 'SCOPE OF WORK.docx',
  tasks_list: 'SCOPE OF WORK.docx',
  appointments_list: 'SCOPE OF WORK.docx',
  messages_list: 'SCOPE OF WORK.docx',
  journals_list: 'SCOPE OF WORK.docx',
  vendors_list: 'SCOPE OF WORK.docx',
  assessments_list: 'SCOPE OF WORK.docx',
  documents_list: 'SCOPE OF WORK.docx',
  schedule_list: 'SCOPE OF WORK.docx',
};

function safeGcsFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveGcsConfig(): { projectId: string; bucket: string } | null {
  const projectId = (process.env.GCP_PROJECT_ID ?? '').trim();
  const bucket = (process.env.GCS_DOCUMENTS_BUCKET ?? '').trim();
  if (!projectId || !bucket) return null;
  return { projectId, bucket };
}

async function ensureTemplatesFormsCategory(
  db: SeedDb,
  tenantId: string,
  logger: SeedLogger,
): Promise<{ filesystemId: string; categoryId: string } | null> {
  let [filesystem] = await db
    .select()
    .from(schema.filesystems)
    .where(
      and(eq(schema.filesystems.tenantId, tenantId), isNull(schema.filesystems.archivedAt)),
    )
    .limit(1);

  if (!filesystem) {
    const [created] = await db
      .insert(schema.filesystems)
      .values({ tenantId })
      .returning();
    filesystem = created;
    logger.info(`${LOG} created filesystem id=${filesystem.id} tenant=${tenantId}`);
  }

  const [existing] = await db
    .select()
    .from(schema.filesystemCategories)
    .where(
      and(
        eq(schema.filesystemCategories.filesystemId, filesystem.id),
        eq(schema.filesystemCategories.slug, TEMPLATES_FORMS_SLUG),
        isNull(schema.filesystemCategories.archivedAt),
      ),
    )
    .limit(1);

  if (existing) {
    return { filesystemId: filesystem.id, categoryId: existing.id };
  }

  const [cat] = await db
    .insert(schema.filesystemCategories)
    .values({
      filesystemId: filesystem.id,
      parentCategoryId: null,
      displayName: 'Templates & Forms',
      description:
        'Blank forms, letterheads, scope templates, and reusable document templates. ' +
        'Do NOT file completed/filled forms for a job here.',
      slug: TEMPLATES_FORMS_SLUG,
      config: {},
      sortOrder: 40,
    })
    .returning();

  logger.info(
    `${LOG} created category TEMPLATES_FORMS id=${cat.id} filesystem=${filesystem.id}`,
  );
  return { filesystemId: filesystem.id, categoryId: cat.id };
}

async function upsertTemplateDocument(params: {
  db: SeedDb;
  tenantId: string;
  categoryId: string;
  fileName: string;
  buffer: Buffer;
  bucket: string;
  storage: Storage;
  logger: SeedLogger;
}): Promise<{ documentId: string; inserted: boolean; updated: boolean }> {
  const { db, tenantId, categoryId, fileName, buffer, bucket, storage, logger } = params;

  const [existing] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.tenantId, tenantId),
        eq(schema.documents.fileName, fileName),
        eq(schema.documents.filesystemCategoryId, categoryId),
        isNull(schema.documents.archivedAt),
      ),
    )
    .limit(1);

  const documentId = existing?.id ?? crypto.randomUUID();
  const gcsObjectPath =
    existing?.gcsObjectPath ??
    `tenants/${tenantId}/documents/${documentId}/${safeGcsFileName(fileName)}`;
  const uri = `gs://${bucket}/${gcsObjectPath}`;
  const file = storage.bucket(bucket).file(gcsObjectPath);

  const alreadyComplete =
    existing &&
    existing.uploadStatus === 'complete' &&
    existing.fileSizeBytes === buffer.length &&
    existing.filesystemCategoryId === categoryId;

  if (alreadyComplete) {
    const [exists] = await file.exists();
    if (exists) {
      logger.info(`${LOG} reuse document file="${fileName}" id=${existing.id}`);
      return { documentId: existing.id, inserted: false, updated: false };
    }
  }

  await file.save(buffer, {
    contentType: DOCX_MIME,
    resumable: false,
  });

  if (existing) {
    await db
      .update(schema.documents)
      .set({
        mimeType: DOCX_MIME,
        fileSizeBytes: buffer.length,
        gcsBucket: bucket,
        gcsObjectPath,
        uri,
        uploadStatus: 'complete',
        filesystemCategoryId: categoryId,
        sourceSystem: 'seed',
        updatedAt: new Date(),
      })
      .where(eq(schema.documents.id, existing.id));
    logger.info(`${LOG} refreshed document file="${fileName}" id=${existing.id}`);
    return { documentId: existing.id, inserted: false, updated: true };
  }

  await db.insert(schema.documents).values({
    id: documentId,
    tenantId,
    filesystemCategoryId: categoryId,
    fileName,
    mimeType: DOCX_MIME,
    fileSizeBytes: buffer.length,
    gcsBucket: bucket,
    gcsObjectPath,
    uri,
    uploadStatus: 'complete',
    sourceSystem: 'seed',
  });
  logger.info(`${LOG} uploaded document file="${fileName}" id=${documentId}`);
  return { documentId, inserted: true, updated: false };
}

async function upsertDocumentTemplateAssignment(params: {
  db: SeedDb;
  tenantId: string;
  documentType: AssignableTemplateType;
  fileName: string;
  filesystemDocumentId: string;
}): Promise<'inserted' | 'updated' | 'skipped'> {
  const { db, tenantId, documentType, fileName, filesystemDocumentId } = params;

  const [existing] = await db
    .select()
    .from(schema.documentTemplates)
    .where(
      and(
        eq(schema.documentTemplates.tenantId, tenantId),
        eq(schema.documentTemplates.documentType, documentType),
      ),
    )
    .limit(1);

  if (existing) {
    if (
      existing.filesystemDocumentId === filesystemDocumentId &&
      existing.name === fileName
    ) {
      return 'skipped';
    }
    await db
      .update(schema.documentTemplates)
      .set({
        name: fileName,
        filesystemDocumentId,
        s3Key: null,
        isDefault: true,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.documentTemplates.id, existing.id));
    return 'updated';
  }

  await db.insert(schema.documentTemplates).values({
    tenantId,
    documentType,
    name: fileName,
    filesystemDocumentId,
    s3Key: null,
    isDefault: true,
    version: 1,
  });
  return 'inserted';
}

export async function seedDocumentTemplatesForTenant(params: {
  db: SeedDb;
  tenantId: string;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const logger = params.logger ?? {
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
    error: (m: string) => console.error(m),
  };
  const { db, tenantId } = params;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const gcs = resolveGcsConfig();
  if (!gcs) {
    logger.warn(
      `${LOG} GCS not configured (GCP_PROJECT_ID / GCS_DOCUMENTS_BUCKET) — skipping tenant=${tenantId}`,
    );
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
      notes: 'gcs-not-configured',
    };
  }

  const dir = templatesDir();
  const missing = TEMPLATE_FILES.filter((f) => !existsSync(join(dir, f)));
  if (missing.length > 0) {
    throw new Error(
      `${LOG} missing template files under ${dir}: ${missing.join(', ')}`,
    );
  }

  const category = await ensureTemplatesFormsCategory(db, tenantId, logger);
  if (!category) {
    return { inserted: 0, updated: 0, skipped: 0, notes: 'no-filesystem' };
  }

  const storage = new Storage({ projectId: gcs.projectId });
  const docIdByFile = new Map<string, string>();

  try {
    for (const fileName of TEMPLATE_FILES) {
      const buffer = readFileSync(join(dir, fileName));
      const result = await upsertTemplateDocument({
        db,
        tenantId,
        categoryId: category.categoryId,
        fileName,
        buffer,
        bucket: gcs.bucket,
        storage,
        logger,
      });
      docIdByFile.set(fileName, result.documentId);
      if (result.inserted) inserted += 1;
      else if (result.updated) updated += 1;
      else skipped += 1;
    }

    for (const documentType of ASSIGNABLE_TEMPLATE_TYPES) {
      const fileName = DOCUMENT_TYPE_TO_FILE[documentType];
      const filesystemDocumentId = docIdByFile.get(fileName);
      if (!filesystemDocumentId) {
        throw new Error(`${LOG} missing document id for file="${fileName}"`);
      }
      const outcome = await upsertDocumentTemplateAssignment({
        db,
        tenantId,
        documentType,
        fileName,
        filesystemDocumentId,
      });
      if (outcome === 'inserted') inserted += 1;
      else if (outcome === 'updated') updated += 1;
      else skipped += 1;
    }
  } catch (err) {
    if (isGcsAuthError(err)) {
      logger.warn(
        `${LOG} Google ADC requires re-authentication — run ` +
          `"gcloud auth application-default login" and re-seed. Skipping tenant=${tenantId}`,
      );
      return {
        inserted,
        updated,
        skipped,
        notes: 'gcs-adc-reauth-required',
      };
    }
    throw err;
  }

  logger.info(
    `${LOG} done tenant=${tenantId} files=${TEMPLATE_FILES.length} scenarios=${ASSIGNABLE_TEMPLATE_TYPES.length}`,
  );

  return {
    inserted,
    updated,
    skipped,
    notes: `tenant=${tenantId}; TEMPLATES_FORMS + document_templates`,
  };
}

async function run(ctx: SeedContext): Promise<SeedResult> {
  const { db, logger } = ctx;

  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .limit(1);
  if (!org) {
    logger.warn(`${LOG} no organization — skipping`);
    return { inserted: 0, updated: 0, skipped: 0, notes: 'no tenant' };
  }

  return seedDocumentTemplatesForTenant({ db, tenantId: org.id, logger });
}

const seed: Seed = {
  name: 'document-templates',
  description:
    'Upload data/templates/*.docx into Templates & Forms and assign Document Templates settings',
  run,
};

export default seed;
