import { Injectable, Logger } from '@nestjs/common';
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
    private readonly transformer: TaskTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly tasksRepo: TasksRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
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

    // 3. Resolve parents
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    const claimId = resolvedParents.claim;
    const jobId = resolvedParents.job;

    if (claimId) (result.entity as Record<string, unknown>).claimId = claimId;
    if (jobId) (result.entity as Record<string, unknown>).jobId = jobId;

    // Tasks require at least one parent (chk_task_parent)
    if (!existingLink && !claimId && !jobId) {
      const missingRefs = result.parentRefs
        .filter((r) => r.required !== false)
        .map((r) => ({
          internalEntityType: r.entityType,
          providerEntityType: r.entityType,
          providerEntityId: r.externalId,
        }));
      throw new ParentNotProjectedError(
        'task',
        externalObjectId,
        missingRefs,
        `Task ${externalObjectId} requires at least one parent (job or claim)`,
      );
    }

    // Derive relatedEntityType / relatedEntityId
    const resolvedEntityType = jobId ? 'Job' : 'Claim';
    const resolvedEntityId = (jobId ?? claimId)!;
    (result.entity as Record<string, unknown>).relatedEntityType = resolvedEntityType;
    (result.entity as Record<string, unknown>).relatedEntityId = resolvedEntityId;

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
        data: { tenantId, ...result.entity } as TaskInsert,
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
