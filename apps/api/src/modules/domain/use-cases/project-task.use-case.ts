import { Injectable, Inject, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { TaskTransformer } from '../transformers/task.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
import { ParentNotProjectedError } from '../services/entity-relationship.service';
import {
  TasksRepository,
  ExternalLinksRepository,
  type TaskInsert,
} from '../../../database/repositories';
import { TaskTypeMappingsService } from '../../tasks/task-type-mappings.service';

@Injectable()
export class ProjectTaskUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectTaskUseCase');

  // Explicit @Inject on every param: SWC collapses constructor types to Object.
  // TaskTypeMappingsService is request-scoped (via TenantContext) so we resolve
  // it lazily through ModuleRef to keep this use case singleton-scoped.
  constructor(
    @Inject(TaskTransformer) private readonly transformer: TaskTransformer,
    @Inject(EntityRelationshipService) private readonly entityRelationship: EntityRelationshipService,
    @Inject(TasksRepository) private readonly tasksRepo: TasksRepository,
    @Inject(ExternalLinksRepository) private readonly externalLinksRepo: ExternalLinksRepository,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  async execute(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<ProjectionResult> {
    const { tenantId, connectionId, tx } = params;
    const payload = (params.externalObject.latestPayload ?? {}) as Record<string, unknown>;
    const externalObjectId = params.externalObject.id as string;

    this.logger.log(`ProjectTaskUseCase.execute — externalObjectId=${externalObjectId}`);

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'task');

    // 2. Transform
    const result = this.transformer.transform({ payload, tenantId });

    // 3. Resolve parents.
    // For updates, relax required→false so we don't block on missing parents;
    // for new tasks the transformer's required:true lets resolveParents throw
    // ParentNotProjectedError directly, engaging inline recovery.
    const parentRefs = existingLink
      ? result.parentRefs.map((r) => ({ ...r, required: false }))
      : result.parentRefs;

    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    const claimId = resolvedParents.claim;
    const jobId = resolvedParents.job;

    if (claimId) (result.entity as Record<string, unknown>).claimId = claimId;
    if (jobId) (result.entity as Record<string, unknown>).jobId = jobId;

    // Defensive fallback: if resolveParents didn't throw (e.g. no parentRefs
    // in the payload at all) but this is a new task with no parent, throw so
    // the retry machinery can attempt recovery.
    if (!existingLink && !claimId && !jobId) {
      throw new ParentNotProjectedError(
        'task',
        externalObjectId,
        result.parentRefs.map((r) => ({
          internalEntityType: r.entityType,
          providerEntityType: r.entityType,
          providerEntityId: r.externalId,
        })),
        `Task ${externalObjectId} requires at least one parent (job or claim)`,
      );
    }

    // Derive relatedEntityType / relatedEntityId only when at least one
    // parent resolved — avoids overwriting good values on the update path.
    if (jobId || claimId) {
      const resolvedEntityType = jobId ? 'Job' : 'Claim';
      const resolvedEntityId = (jobId ?? claimId)!;
      (result.entity as Record<string, unknown>).relatedEntityType = resolvedEntityType;
      (result.entity as Record<string, unknown>).relatedEntityId = resolvedEntityId;
    }

    // Infer taskType from title when not explicitly set on the payload entity
    await this.applyInferredTaskType({
      tenantId,
      entity: result.entity as Record<string, unknown>,
      existingTaskId: existingLink?.internalEntityId,
    });

    // 4. Upsert
    let taskId: string;
    if (existingLink) {
      await this.tasksRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<TaskInsert>,
        tx,
      });
      taskId = existingLink.internalEntityId;
    } else {
      const created = await this.tasksRepo.create({
        data: { tenantId, ...result.entity, originType: 'provider' } as TaskInsert,
        tx,
      });
      taskId = created.id;

      await this.externalLinksRepo.upsert({
        data: {
          tenantId,
          externalObjectId,
          internalEntityType: 'task',
          internalEntityId: taskId,
          linkRole: 'source',
          isPrimary: true,
          metadata: {},
        },
        tx,
      });
    }

    return { status: 'completed', internalEntityId: taskId, internalEntityType: 'task' };
  }

  private async applyInferredTaskType(params: {
    tenantId: string;
    entity: Record<string, unknown>;
    existingTaskId?: string;
  }): Promise<void> {
    let taskTypeMappings: TaskTypeMappingsService | undefined;
    try {
      taskTypeMappings = await this.moduleRef.resolve(TaskTypeMappingsService);
    } catch {
      return;
    }
    if (!taskTypeMappings) return;

    const explicit =
      typeof params.entity.taskType === 'string' ? params.entity.taskType.trim() : '';
    if (explicit) return;

    // On update, preserve an existing type if already set
    if (params.existingTaskId) {
      const existing = await this.tasksRepo.findOne({
        id: params.existingTaskId,
        tenantId: params.tenantId,
      });
      const existingType =
        typeof existing?.taskType === 'string' ? existing.taskType.trim() : '';
      if (existingType) return;
    }

    const title =
      typeof params.entity.name === 'string' ? params.entity.name : undefined;
    const resolved = await taskTypeMappings.resolveFromTitle({
      tenantId: params.tenantId,
      title,
    });
    if (!resolved) return;

    params.entity.taskType = resolved;
    this.logger.log(
      `ProjectTaskUseCase.applyInferredTaskType — title="${title}" → type="${resolved}"`,
    );
  }
}
