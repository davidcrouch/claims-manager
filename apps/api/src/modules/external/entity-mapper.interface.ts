import type { DrizzleDbOrTx } from '../../database/drizzle.module';

/**
 * Contract for a CW-to-internal entity mapper. Each mapper takes an external
 * object row + tenant/connection context and projects it into the internal
 * tables, returning the linked internal entity id and type.
 *
 * Originally lived inside the old `ExternalToolsController`; extracted so
 * the More0 tool controllers (under `apps/api/more0/src/`) can consume the
 * interface without a circular dependency and the mappers themselves can
 * live alongside `EntityMapperRegistry`.
 */
export interface EntityMapper {
  map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{
    internalEntityId: string;
    internalEntityType: string;
    skipped?: string;
  }>;
}
