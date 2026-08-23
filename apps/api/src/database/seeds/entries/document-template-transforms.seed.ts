/**
 * Sync saved document-template JSONata transforms to current code defaults.
 *
 * Tenants with custom rows in `document_template_transforms` otherwise keep
 * stale rules (e.g. RFQ missing subtotal/tax/total). Code defaults apply only
 * when no row exists.
 *
 * Callers:
 *   - CLI (`pnpm --filter api run db:seed`)
 *   - Cloud Run job `seed-api-lookups` (`run-seed-lookups.js`) after lookups
 */
import type { Seed, SeedContext, SeedResult } from '../lib/runner';
import { syncDocumentTemplateTransforms } from '../lib/sync-document-template-transforms';

export async function seedDocumentTemplateTransforms(
  ctx: Pick<SeedContext, 'db' | 'logger'>,
): Promise<SeedResult> {
  return syncDocumentTemplateTransforms({
    db: ctx.db,
    logger: ctx.logger,
  });
}

const seed: Seed = {
  name: 'document-template-transforms',
  description:
    'Sync saved RFQ / PO / WO JSONata transforms to current code defaults',
  run: seedDocumentTemplateTransforms,
};

export default seed;
