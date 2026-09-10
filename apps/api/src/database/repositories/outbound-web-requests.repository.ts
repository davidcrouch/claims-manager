import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, desc, asc, count as drizzleCount, max, inArray, ilike, or, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { outboundWebRequests, integrationConnections } from '../schema';
import {
  appendQueryParamsToUrl,
  parseEntityFromPath,
  sanitizeJsonBody,
} from '../../crunchwork/outbound-web-request.util';
import { getRequestActor } from '../../common/request-actor.store';

export type OutboundWebRequestRow = typeof outboundWebRequests.$inferSelect;
export type OutboundWebRequestInsert = typeof outboundWebRequests.$inferInsert;

function buildOrderBy(sort?: string) {
  switch (sort) {
    case 'created_at_asc':
      return [asc(outboundWebRequests.createdAt)];
    case 'http_method_asc':
      return [asc(outboundWebRequests.httpMethod)];
    case 'http_method_desc':
      return [desc(outboundWebRequests.httpMethod)];
    case 'status_code_asc':
      return [asc(outboundWebRequests.statusCode)];
    case 'status_code_desc':
      return [desc(outboundWebRequests.statusCode)];
    case 'duration_ms_asc':
      return [asc(outboundWebRequests.durationMs)];
    case 'duration_ms_desc':
      return [desc(outboundWebRequests.durationMs)];
    case 'entity_type_asc':
      return [asc(outboundWebRequests.entityType)];
    case 'entity_type_desc':
      return [desc(outboundWebRequests.entityType)];
    case 'initiated_by_name_asc':
      return [asc(outboundWebRequests.initiatedByName)];
    case 'initiated_by_name_desc':
      return [desc(outboundWebRequests.initiatedByName)];
    case 'created_at_desc':
    default:
      return [desc(outboundWebRequests.createdAt)];
  }
}

export interface RecordHttpCallParams {
  connectionId: string;
  method: string;
  path: string;
  url: string;
  queryParams?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  statusCode: number | null;
  durationMs: number;
  errorMessage?: string | null;
  outcome?: 'success' | 'failed';
}

@Injectable()
export class OutboundWebRequestsRepository {
  private readonly logger = new Logger('OutboundWebRequestsRepository');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async recordHttpCall(params: RecordHttpCallParams): Promise<OutboundWebRequestRow | null> {
    try {
      const [conn] = await this.db
        .select({ tenantId: integrationConnections.tenantId })
        .from(integrationConnections)
        .where(eq(integrationConnections.id, params.connectionId))
        .limit(1);
      if (!conn) {
        this.logger.warn(
          `OutboundWebRequestsRepository.recordHttpCall — connection ${params.connectionId} not found`,
        );
        return null;
      }

      const { entityType, entityId } = parseEntityFromPath(params.path);
      const outcome =
        params.outcome ??
        (params.statusCode != null && params.statusCode >= 200 && params.statusCode < 400
          ? 'success'
          : 'failed');

      const actor = getRequestActor();
      const [inserted] = await this.db
        .insert(outboundWebRequests)
        .values({
          tenantId: conn.tenantId,
          connectionId: params.connectionId,
          httpMethod: params.method.toUpperCase(),
          path: params.path,
          url: appendQueryParamsToUrl(params.url, params.queryParams),
          queryParams: params.queryParams ?? {},
          entityType,
          entityId,
          statusCode: params.statusCode,
          outcome,
          durationMs: Math.max(0, Math.round(params.durationMs)),
          requestBody: sanitizeJsonBody(params.requestBody),
          responseBody: sanitizeJsonBody(params.responseBody),
          errorMessage: params.errorMessage ?? null,
          initiatedByUserId: actor?.userId ?? null,
          initiatedByName: actor?.userName ?? null,
        })
        .returning();
      return inserted ?? null;
    } catch (error) {
      this.logger.warn(
        `OutboundWebRequestsRepository.recordHttpCall — failed to persist ${params.method} ${params.path}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private connectionTenantCondition(connectionId: string, tenantId: string) {
    return and(
      eq(outboundWebRequests.connectionId, connectionId),
      eq(outboundWebRequests.tenantId, tenantId),
    )!;
  }

  async findByConnectionId(params: {
    connectionId: string;
    tenantId: string;
    outcome?: string;
    method?: string;
    entityType?: string;
    user?: string;
    search?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: OutboundWebRequestRow[]; total: number }> {
    const limit = params.limit ?? 20;
    const offset = ((params.page ?? 1) - 1) * limit;

    let whereClause = this.connectionTenantCondition(
      params.connectionId,
      params.tenantId,
    );

    const outcomes =
      params.outcome?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (outcomes.length === 1) {
      whereClause = and(whereClause, eq(outboundWebRequests.outcome, outcomes[0]))!;
    } else if (outcomes.length > 1) {
      whereClause = and(whereClause, inArray(outboundWebRequests.outcome, outcomes))!;
    }

    const methods =
      params.method?.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean) ?? [];
    if (methods.length === 1) {
      whereClause = and(whereClause, eq(outboundWebRequests.httpMethod, methods[0]))!;
    } else if (methods.length > 1) {
      whereClause = and(whereClause, inArray(outboundWebRequests.httpMethod, methods))!;
    }

    const entityTypes =
      params.entityType?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (entityTypes.length === 1) {
      whereClause = and(whereClause, eq(outboundWebRequests.entityType, entityTypes[0]))!;
    } else if (entityTypes.length > 1) {
      whereClause = and(
        whereClause,
        inArray(outboundWebRequests.entityType, entityTypes),
      )!;
    }

    const users =
      params.user?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (users.length > 0) {
      const includeBlank = users.includes('__blank__');
      const realNames = users.filter((value) => value !== '__blank__');
      const blankCondition = or(
        isNull(outboundWebRequests.initiatedByName),
        eq(outboundWebRequests.initiatedByName, ''),
      )!;
      if (includeBlank && realNames.length > 0) {
        whereClause = and(
          whereClause,
          or(blankCondition, inArray(outboundWebRequests.initiatedByName, realNames))!,
        )!;
      } else if (includeBlank) {
        whereClause = and(whereClause, blankCondition)!;
      } else if (realNames.length === 1) {
        whereClause = and(
          whereClause,
          eq(outboundWebRequests.initiatedByName, realNames[0]),
        )!;
      } else if (realNames.length > 1) {
        whereClause = and(
          whereClause,
          inArray(outboundWebRequests.initiatedByName, realNames),
        )!;
      }
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(outboundWebRequests.path, term),
          ilike(outboundWebRequests.entityId, term),
          ilike(outboundWebRequests.entityType, term),
          ilike(outboundWebRequests.initiatedByName, term),
        )!,
      )!;
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(outboundWebRequests)
        .where(whereClause)
        .orderBy(...buildOrderBy(params.sort))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: drizzleCount() })
        .from(outboundWebRequests)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  async distinctUsersByConnectionId(params: {
    connectionId: string;
    tenantId: string;
  }): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ initiatedByName: outboundWebRequests.initiatedByName })
      .from(outboundWebRequests)
      .where(this.connectionTenantCondition(params.connectionId, params.tenantId))
      .orderBy(asc(outboundWebRequests.initiatedByName));
    return rows
      .map((row) => (row.initiatedByName ?? '').trim())
      .filter(Boolean);
  }

  async distinctEntityTypesByConnectionId(params: {
    connectionId: string;
    tenantId: string;
  }): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ entityType: outboundWebRequests.entityType })
      .from(outboundWebRequests)
      .where(this.connectionTenantCondition(params.connectionId, params.tenantId))
      .orderBy(asc(outboundWebRequests.entityType));
    return rows
      .map((row) => (row.entityType ?? '').trim())
      .filter(Boolean);
  }

  async countByConnectionId(params: { connectionId: string; tenantId: string }): Promise<number> {
    const [result] = await this.db
      .select({ count: drizzleCount() })
      .from(outboundWebRequests)
      .where(this.connectionTenantCondition(params.connectionId, params.tenantId));
    return result?.count ?? 0;
  }

  async lastRequestAtByConnectionId(params: {
    connectionId: string;
    tenantId: string;
  }): Promise<Date | null> {
    const [result] = await this.db
      .select({ lastAt: max(outboundWebRequests.createdAt) })
      .from(outboundWebRequests)
      .where(this.connectionTenantCondition(params.connectionId, params.tenantId));
    return result?.lastAt ?? null;
  }
}
