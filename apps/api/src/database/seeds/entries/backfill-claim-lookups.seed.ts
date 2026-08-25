/**
 * Backfill claim status / loss type FKs from stored Crunchwork payloads.
 *
 * Inbound claim projection historically left these null when the CW
 * `externalReference` did not match seed- prefixed lookup codes. After
 * lookups.seed writes the CW codes, this pass links existing claim rows.
 *
 * Callers:
 *   - Cloud Run job `seed-api-lookups` (`run-seed-lookups.js`)
 *   - CLI `pnpm --filter api run db:seed`
 */
import { sql } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';

const LOG = '[seeds/backfill-claim-lookups]';

async function upsertAndLink(params: {
  db: SeedDb;
  logger: SeedLogger;
  domain: string;
  column: 'status_lookup_id' | 'loss_type_lookup_id' | 'loss_subtype_lookup_id';
  objectKey: 'status' | 'lossType' | 'lossSubType';
}): Promise<{ inserted: number; updated: number }> {
  const { db, logger, domain, column, objectKey } = params;

  const created = await db.execute(sql`
    INSERT INTO lookup_values (
      id, tenant_id, domain, provider_code, external_reference, name, metadata, is_active
    )
    SELECT
      gen_random_uuid(),
      src.tenant_id,
      ${domain},
      'crunchwork',
      src.ext_ref,
      src.disp_name,
      '{}'::jsonb,
      true
    FROM (
      SELECT DISTINCT ON (
        c.tenant_id,
        COALESCE(
          NULLIF(c.api_payload->${objectKey}->>'externalReference', ''),
          NULLIF(c.api_payload->${objectKey}->>'id', '')
        )
      )
        c.tenant_id,
        COALESCE(
          NULLIF(c.api_payload->${objectKey}->>'externalReference', ''),
          NULLIF(c.api_payload->${objectKey}->>'id', '')
        ) AS ext_ref,
        COALESCE(
          NULLIF(c.api_payload->${objectKey}->>'name', ''),
          NULLIF(c.api_payload->${objectKey}->>'externalReference', ''),
          NULLIF(c.api_payload->${objectKey}->>'id', '')
        ) AS disp_name
      FROM claims c
      WHERE c.deleted_at IS NULL
      ORDER BY
        c.tenant_id,
        COALESCE(
          NULLIF(c.api_payload->${objectKey}->>'externalReference', ''),
          NULLIF(c.api_payload->${objectKey}->>'id', '')
        )
    ) src
    WHERE src.ext_ref IS NOT NULL
    ON CONFLICT (tenant_id, domain, provider_code, external_reference)
    DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = now()
    WHERE lookup_values.name IS DISTINCT FROM EXCLUDED.name
  `);

  const linked = await db.execute(sql.raw(`
    UPDATE claims c
    SET ${column} = lv.id, updated_at = now()
    FROM lookup_values lv
    WHERE c.tenant_id = lv.tenant_id
      AND c.deleted_at IS NULL
      AND lv.domain = '${domain}'
      AND lv.external_reference = COALESCE(
        NULLIF(c.api_payload->'${objectKey}'->>'externalReference', ''),
        NULLIF(c.api_payload->'${objectKey}'->>'id', '')
      )
      AND c.${column} IS DISTINCT FROM lv.id
  `));

  const inserted = Number(created.rowCount ?? 0);
  const updated = Number(linked.rowCount ?? 0);
  logger.info(
    `${LOG} domain=${domain} lookupsUpserted=${inserted} claimsLinked=${updated}`,
  );
  return { inserted, updated };
}

export async function backfillClaimLookupsForAllTenants(params: {
  db: SeedDb;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const { db } = params;
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  const status = await upsertAndLink({
    db,
    logger,
    domain: 'claim_status',
    column: 'status_lookup_id',
    objectKey: 'status',
  });
  const loss = await upsertAndLink({
    db,
    logger,
    domain: 'loss_type',
    column: 'loss_type_lookup_id',
    objectKey: 'lossType',
  });
  const sub = await upsertAndLink({
    db,
    logger,
    domain: 'loss_subtype',
    column: 'loss_subtype_lookup_id',
    objectKey: 'lossSubType',
  });

  return {
    inserted: status.inserted + loss.inserted + sub.inserted,
    updated: status.updated + loss.updated + sub.updated,
    skipped: 0,
    notes: 'from claims.api_payload',
  };
}

const seed: Seed = {
  name: 'backfill-claim-lookups',
  description:
    'Link existing claims to Crunchwork status / loss-type lookup codes from api_payload',
  run: (ctx: SeedContext) =>
    backfillClaimLookupsForAllTenants({ db: ctx.db, logger: ctx.logger }),
};

export default seed;
