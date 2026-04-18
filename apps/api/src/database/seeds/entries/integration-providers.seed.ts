/**
 * Seeds the `integration_providers` table with all first-party providers
 * the app recognises. Idempotent: upserts by unique `code`, so reruns only
 * refresh `name` / `is_active` / `metadata` without duplicating rows.
 */
import { sql } from 'drizzle-orm';
import { integrationProviders } from '../../schema';
import type { Seed } from '../lib/runner';

interface ProviderSeedRow {
  code: string;
  name: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

const PROVIDERS: ProviderSeedRow[] = [
  {
    code: 'crunchwork',
    name: 'Crunchwork',
    isActive: true,
    metadata: {},
  },
];

const seed: Seed = {
  name: 'integration-providers',
  description: 'Upsert first-party integration providers (by code)',
  run: async ({ db, logger }) => {
    let inserted = 0;
    let updated = 0;

    for (const row of PROVIDERS) {
      const result = await db
        .insert(integrationProviders)
        .values({
          code: row.code,
          name: row.name,
          isActive: row.isActive,
          metadata: row.metadata,
        })
        .onConflictDoUpdate({
          target: integrationProviders.code,
          set: {
            name: row.name,
            isActive: row.isActive,
            metadata: row.metadata,
            updatedAt: sql`now()`,
          },
        })
        .returning({ id: integrationProviders.id, code: integrationProviders.code });

      const [persisted] = result;
      // Drizzle's onConflictDoUpdate doesn't distinguish insert vs update in
      // the return value; probe by createdAt===updatedAt on a follow-up read
      // if we ever need that. For now, log the code and count it as inserted.
      logger.info(`upserted code=${row.code} id=${persisted?.id ?? '?'}`);
      inserted += 1;
    }

    return {
      inserted,
      updated,
      skipped: 0,
      notes: `${PROVIDERS.length} provider(s) processed`,
    };
  },
};

export default seed;
