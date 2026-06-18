import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
  type DrizzleDbOrTx,
} from '../../../database/drizzle.module';
import {
  lookupValues,
  externalReferenceResolutionLog,
} from '../../../database/schema';
import type { LookupRequest } from '../transformers/transformer.interface';

/**
 * Migrated from modules/external/lookup-resolver.service.ts.
 *
 * Resolves external references to lookup_values IDs. Auto-creates stub
 * entries when `autoCreate` is true and no match exists.
 */
@Injectable()
export class LookupResolutionService {
  private readonly logger = new Logger('LookupResolutionService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async resolve(params: {
    domain: string;
    externalReference: string;
    name?: string;
    tenantId: string;
    providerCode?: string;
    autoCreate?: boolean;
    sourceEntity?: string;
    sourceEntityId?: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (!params.externalReference) return null;
    const db = params.tx ?? this.db;

    const conditions = [
      eq(lookupValues.tenantId, params.tenantId),
      eq(lookupValues.domain, params.domain),
      eq(lookupValues.externalReference, params.externalReference),
    ];
    if (params.providerCode) {
      conditions.push(eq(lookupValues.providerCode, params.providerCode));
    }

    const [existing] = await db
      .select()
      .from(lookupValues)
      .where(and(...conditions))
      .limit(1);

    if (existing) return existing.id;

    if (params.autoCreate) {
      this.logger.debug(
        `LookupResolutionService.resolve — auto-creating ${params.domain}/${params.externalReference} for tenant=${params.tenantId}`,
      );
      const [created] = await db
        .insert(lookupValues)
        .values({
          tenantId: params.tenantId,
          domain: params.domain,
          providerCode: params.providerCode ?? null,
          externalReference: params.externalReference,
          name: params.name ?? params.externalReference,
          metadata: {},
          isActive: true,
        })
        .returning();
      return created.id;
    }

    // Try case-insensitive name match
    if (params.name) {
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
      if (match) return match.id;
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
      `LookupResolutionService.resolve — no match for ${params.domain}/${params.externalReference}, logged to resolution log`,
    );

    return null;
  }

  /**
   * Resolve a lookup field that may be an object `{ externalReference, name }`
   * or a bare string. Mirrors the CrunchworkClaimMapper's resolveLookup helper.
   */
  async resolveField(params: {
    tenantId: string;
    domain: string;
    field: unknown;
    providerCode?: string;
    autoCreate?: boolean;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (!params.field) return null;

    if (typeof params.field === 'string') {
      return this.resolve({
        tenantId: params.tenantId,
        domain: params.domain,
        externalReference: params.field,
        name: params.field,
        providerCode: params.providerCode,
        autoCreate: false,
        tx: params.tx,
      });
    }

    if (typeof params.field === 'object' && params.field !== null) {
      const obj = params.field as Record<string, unknown>;
      const externalReference =
        (obj.externalReference as string | undefined) ??
        (obj.id as string | undefined);
      if (!externalReference) return null;
      const name = (obj.name as string | undefined) ?? externalReference;
      return this.resolve({
        tenantId: params.tenantId,
        domain: params.domain,
        externalReference,
        name,
        providerCode: params.providerCode,
        autoCreate: params.autoCreate ?? false,
        tx: params.tx,
      });
    }

    return null;
  }

  /**
   * Resolve all lookups declared by a transformer in batch.
   * Returns a map: { fieldName: resolvedLookupId }
   */
  async resolveAll(params: {
    lookups: LookupRequest[];
    tenantId: string;
    providerCode?: string;
    sourceEntity?: string;
    sourceEntityId?: string;
    tx?: DrizzleDbOrTx;
  }): Promise<Record<string, string>> {
    const resolved: Record<string, string> = {};
    for (const lookup of params.lookups) {
      const id = await this.resolve({
        domain: lookup.domain,
        externalReference: lookup.externalReference,
        name: lookup.name,
        tenantId: params.tenantId,
        providerCode: params.providerCode,
        autoCreate: lookup.autoCreate,
        sourceEntity: params.sourceEntity,
        sourceEntityId: params.sourceEntityId,
        tx: params.tx,
      });
      if (id) resolved[lookup.field] = id;
    }
    return resolved;
  }
}
