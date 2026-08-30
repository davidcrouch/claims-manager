import { Injectable, Inject, Logger } from '@nestjs/common';
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

@Injectable()
export class ProjectTaskUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectTaskUseCase');

  constructor(
    @Inject(TaskTransformer) private readonly transformer: TaskTransformer,
    @Inject(EntityRelationshipService) private readonly entityRelationship: EntityRelationshipService,
    @Inject(TasksRepository) private readonly tasksRepo: TasksRepository,
    @Inject(ExternalLinksRepository) private readonly externalLinksRepo: ExternalLinksRepository,
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

    const existingId = await this.resolveExistingTaskId({
      tenantId,
      externalObjectId,
      payload,
      tx,
    });
    const existingEntity = existingId
      ? await this.tasksRepo.findOne({ id: existingId, tenantId, tx })
      : null;

    const result = this.transformer.transform({
      payload,
      tenantId,
      existingEntity: existingEntity
        ? (existingEntity as unknown as Record<string, unknown>)
        : undefined,
    });

    const parentRefs = existingId
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

    if (!existingId && !claimId && !jobId) {
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

    if (jobId || claimId) {
      const resolvedEntityType = jobId ? 'Job' : 'Claim';
      const resolvedEntityId = (jobId ?? claimId)!;
      (result.entity as Record<string, unknown>).relatedEntityType = resolvedEntityType;
      (result.entity as Record<string, unknown>).relatedEntityId = resolvedEntityId;
    }

    let taskId: string;
    if (existingId) {
      await this.tasksRepo.update({
        id: existingId,
        data: result.entity as Partial<TaskInsert>,
        tx,
      });
      taskId = existingId;
    } else {
      const created = await this.tasksRepo.create({
        data: { tenantId, ...result.entity, originType: 'provider' } as TaskInsert,
        tx,
      });
      taskId = created.id;
    }

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

    return { status: 'completed', internalEntityId: taskId, internalEntityType: 'task' };
  }

  private async resolveExistingTaskId(params: {
    tenantId: string;
    externalObjectId: string;
    payload: Record<string, unknown>;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId: params.externalObjectId,
      tx: params.tx,
    });
    const link = existingLinks.find((l) => l.internalEntityType === 'task');
    if (link) return link.internalEntityId;

    const cwTaskId =
      typeof params.payload.id === 'string' ? params.payload.id.trim() : '';
    if (!cwTaskId) return null;

    const byExtRef = await this.tasksRepo.findByExternalReference({
      tenantId: params.tenantId,
      externalReference: cwTaskId,
      tx: params.tx,
    });
    if (byExtRef) {
      this.logger.log(
        `ProjectTaskUseCase.execute — matched existing task ${byExtRef.id} by Crunchwork id ${cwTaskId}`,
      );
      return byExtRef.id;
    }

    return null;
  }
}
