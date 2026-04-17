import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
  type DrizzleDbOrTx,
} from '../../database/drizzle.module';
import {
  lookupValues,
  externalReferenceResolutionLog,
} from '../../database/schema';

@Injectable()
export class LookupResolver {
  private readonly logger = new Logger('LookupResolver');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Resolve a lookup value's id by (tenantId, domain, externalReference).
   *
   * - If `autoCreate` is true and no row exists, a stub row is created with
   *   `name = name ?? externalReference` and its id returned.
   * - Otherwise the miss is written to `external_reference_resolution_log`
   *   and `null` is returned.
   *
   * Pass `tx` to run the reads/writes inside an existing transaction.
   */
  async resolve(params: {
    tenantId: string;
    domain: string;
    externalReference: string;
    name?: string;
    autoCreate?: boolean;
    sourceEntity?: string;
    sourceEntityId?: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (!params.externalReference) return null;
    const db = params.tx ?? this.db;

    const [existing] = await db
      .select()
      .from(lookupValues)
      .where(
        and(
          eq(lookupValues.tenantId, params.tenantId),
          eq(lookupValues.domain, params.domain),
          eq(lookupValues.externalReference, params.externalReference),
        ),
      )
      .limit(1);

    if (existing) return existing.id;

    if (params.autoCreate) {
      this.logger.debug(
        `LookupResolver.resolve — auto-creating ${params.domain}/${params.externalReference} for tenant=${params.tenantId}`,
      );
      const [created] = await db
        .insert(lookupValues)
        .values({
          tenantId: params.tenantId,
          domain: params.domain,
          externalReference: params.externalReference,
          name: params.name ?? params.externalReference,
          metadata: {},
          isActive: true,
        })
        .returning();
      return created.id;
    }

    await db.insert(externalReferenceResolutionLog).values({
      tenantId: params.tenantId,
      domain: params.domain,
      externalReference: params.externalReference,
      sourceEntity: params.sourceEntity,
      sourceEntityId: params.sourceEntityId,
      resolutionAction: 'not_found',
      details: {},
    });

    this.logger.warn(
      `LookupResolver.resolve — no match for ${params.domain}/${params.externalReference}, logged to resolution log`,
    );

    return null;
  }

  /**
   * Object-or-string tolerance helper (see docs/mapping/claims.md §3).
   *
   * CW sometimes returns a lookup as `{ externalReference, name }` and
   * sometimes as a bare `"name"` string. When given a raw name, we attempt
   * a case-insensitive match within the domain. On miss `null` is returned;
   * the caller is expected to stash the raw value under `custom_data.<field>Raw`.
   */
  async resolveByName(params: {
    tenantId: string;
    domain: string;
    name: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (!params.name) return null;
    const db = params.tx ?? this.db;

    const rows = await db
      .select()
      .from(lookupValues)
      .where(
        and(
          eq(lookupValues.tenantId, params.tenantId),
          eq(lookupValues.domain, params.domain),
        ),
      );

    const needle = params.name.trim().toLowerCase();
    const match = rows.find(
      (r) => (r.name ?? '').trim().toLowerCase() === needle,
    );
    return match?.id ?? null;
  }
}
