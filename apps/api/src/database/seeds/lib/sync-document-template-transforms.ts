import { eq, inArray } from 'drizzle-orm';
import { TRANSFORM_DEFAULTS } from '../../../modules/document-generation/schemas/target/defaults';
import type { DocumentType } from '../../../modules/document-generation/types/document-types';
import {
  documentTemplateTransformVersions,
  documentTemplateTransforms,
} from '../../schema';
import type { SeedDb } from './db';
import type { SeedLogger, SeedResult } from './runner';

const LOG = '[seeds/sync-document-template-transforms]';

/**
 * Saved transforms for these types are synced to code defaults on seed/deploy.
 * Keeps staging/prod aligned when TRANSFORM_DEFAULTS changes (e.g. RFQ totals).
 */
export const SYNCED_TRANSFORM_DOCUMENT_TYPES = [
  'rfq',
  'purchase_order',
  'work_order',
  'scope_of_work',
  'invoice',
] as const satisfies readonly DocumentType[];

export type SyncedTransformDocumentType =
  (typeof SYNCED_TRANSFORM_DOCUMENT_TYPES)[number];

function needsTransformSync(rules: string | null, defaults: string): boolean {
  return (rules ?? '').trim() !== defaults.trim();
}

/** Re-sync scope_of_work rows saved before group label + dimensions mapping. */
function needsScopeOfWorkResync(rules: string | null, defaults: string): boolean {
  if (needsTransformSync(rules, defaults)) return true;
  const text = rules ?? '';
  return !text.includes('group_name') || !text.includes('group_length');
}

export async function syncDocumentTemplateTransforms(params: {
  db: SeedDb;
  logger?: SeedLogger;
  documentTypes?: readonly SyncedTransformDocumentType[];
}): Promise<SeedResult> {
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  const documentTypes = params.documentTypes ?? SYNCED_TRANSFORM_DOCUMENT_TYPES;
  const { db } = params;

  const rows = await db
    .select()
    .from(documentTemplateTransforms)
    .where(inArray(documentTemplateTransforms.documentType, [...documentTypes]));

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const documentType = row.documentType as DocumentType;
    const defaults = TRANSFORM_DEFAULTS[documentType];
    if (!defaults?.jsonataRules) {
      logger.warn(`no defaults for document_type=${documentType}`);
      continue;
    }

    const outOfDate =
      documentType === 'scope_of_work'
        ? needsScopeOfWorkResync(row.jsonataRules, defaults.jsonataRules)
        : needsTransformSync(row.jsonataRules, defaults.jsonataRules);

    if (!outOfDate) {
      skipped += 1;
      logger.info(`skip ${documentType} tenant=${row.tenantId}`);
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.insert(documentTemplateTransformVersions).values({
        transformId: row.id,
        version: row.version,
        jsonataRules: row.jsonataRules,
        targetSchema: row.targetSchema,
        createdBy: row.updatedBy,
      });

      await tx
        .update(documentTemplateTransforms)
        .set({
          jsonataRules: defaults.jsonataRules,
          targetSchema: defaults.targetSchema,
          testData: null,
          version: row.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(documentTemplateTransforms.id, row.id));
    });

    updated += 1;
    logger.info(
      `updated ${documentType} tenant=${row.tenantId} v${row.version}->${row.version + 1}`,
    );
  }

  return {
    inserted: 0,
    updated,
    skipped,
    notes: `scanned=${rows.length}; types=${documentTypes.join(',')}`,
  };
}
