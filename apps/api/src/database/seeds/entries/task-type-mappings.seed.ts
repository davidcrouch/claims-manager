/**
 * Default title → task type mappings seed.
 *
 * Idempotent via unique (tenant_id, title_pattern, match_mode).
 *
 * Callers:
 *   - api-server `POST /internal/seed-tenant`
 *   - first-login provisioning
 *   - TaskTypeMappingsService.ensureDefaults (lazy on empty tenant)
 */
import type { SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';
import { defaultTaskTypeMappingSpecs } from '../../../modules/tasks/task-type-from-title';

const LOG = '[seeds/task-type-mappings]';

export async function seedTaskTypeMappingsForTenant(params: {
  db: SeedDb;
  tenantId: string;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const { db, tenantId, logger } = params;
  const specs = defaultTaskTypeMappingSpecs();
  let inserted = 0;
  let skipped = 0;

  for (const spec of specs) {
    const rows = await db
      .insert(schema.taskTypeMappings)
      .values({
        tenantId,
        titlePattern: spec.titlePattern,
        matchMode: spec.matchMode,
        taskType: spec.taskType,
        priority: spec.priority,
        isActive: true,
      })
      .onConflictDoNothing()
      .returning({ id: schema.taskTypeMappings.id });

    if (rows.length > 0) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  logger?.info(
    `${LOG} tenantId=${tenantId} inserted=${inserted} skipped=${skipped}`,
  );

  return { inserted, updated: 0, skipped };
}
