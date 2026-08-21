import { Injectable, Logger } from '@nestjs/common';
import {
  EntityActivitiesRepository,
  type EntityActivityRow,
  type EntityActivityInsert,
} from '../../database/repositories';

export interface LogActivityParams {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: 'user' | 'system' | 'provider';
  actorId?: string;
  actorName?: string;
  summary: string;
  detail?: Record<string, unknown>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  source?: string;
  sourceEventId?: string;
}

/**
 * Singleton activity writer/reader. Intentionally not REQUEST-scoped so domain
 * projection use cases (e.g. ProjectQuoteUseCase) remain singletons and can be
 * registered in UseCaseRegistry via ModuleRef.get().
 * Callers must pass tenantId explicitly — do not inject TenantContext here.
 */
@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(private readonly activitiesRepo: EntityActivitiesRepository) {}

  async log(params: LogActivityParams): Promise<void> {
    try {
      await this.activitiesRepo.create({
        data: {
          tenantId: params.tenantId,
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          actorType: params.actorType,
          actorId: params.actorId ?? null,
          actorName: params.actorName ?? null,
          summary: params.summary,
          detail: params.detail ?? {},
          relatedEntityType: params.relatedEntityType ?? null,
          relatedEntityId: params.relatedEntityId ?? null,
          source: params.source ?? 'internal',
          sourceEventId: params.sourceEventId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `ActivitiesService.log — failed to write activity: ${(err as Error).message}`,
      );
    }
  }

  async logMany(entries: LogActivityParams[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      const data: EntityActivityInsert[] = entries.map((p) => ({
        tenantId: p.tenantId,
        entityType: p.entityType,
        entityId: p.entityId,
        action: p.action,
        actorType: p.actorType,
        actorId: p.actorId ?? null,
        actorName: p.actorName ?? null,
        summary: p.summary,
        detail: p.detail ?? {},
        relatedEntityType: p.relatedEntityType ?? null,
        relatedEntityId: p.relatedEntityId ?? null,
        source: p.source ?? 'internal',
        sourceEventId: p.sourceEventId ?? null,
      }));
      await this.activitiesRepo.createMany({ data });
    } catch (err) {
      this.logger.warn(
        `ActivitiesService.logMany — failed to write ${entries.length} activities: ${(err as Error).message}`,
      );
    }
  }

  async list(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: EntityActivityRow[]; total: number }> {
    const result = await this.activitiesRepo.findByEntity({
      tenantId: params.tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
      page: params.page,
      limit: params.limit,
    });
    this.logger.log(
      `ActivitiesService.list — tenant=${params.tenantId} ${params.entityType}/${params.entityId} total=${result.total}`,
    );
    return result;
  }

  async listByRelated(params: {
    tenantId: string;
    relatedEntityType: string;
    relatedEntityId: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: EntityActivityRow[]; total: number }> {
    return this.activitiesRepo.findByRelatedEntity({
      tenantId: params.tenantId,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
      page: params.page,
      limit: params.limit,
    });
  }
}
