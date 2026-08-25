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

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'task');

    const result = this.transformer.transform({ payload, tenantId });

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

    if (jobId || claimId) {
      const resolvedEntityType = jobId ? 'Job' : 'Claim';
      const resolvedEntityId = (jobId ?? claimId)!;
      (result.entity as Record<string, unknown>).relatedEntityType = resolvedEntityType;
      (result.entity as Record<string, unknown>).relatedEntityId = resolvedEntityId;
    }

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
}
