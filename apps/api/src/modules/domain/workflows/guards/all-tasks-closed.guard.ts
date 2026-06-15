import { Injectable } from '@nestjs/common';
import { TasksRepository } from '../../../../database/repositories';
import type { WorkflowGuard, WorkflowContext } from '../workflow.interface';

@Injectable()
export class AllTasksClosedGuard implements WorkflowGuard {
  name = 'allTasksClosed';

  constructor(private readonly tasksRepo: TasksRepository) {}

  async evaluate(context: WorkflowContext): Promise<boolean> {
    const tasks = await this.tasksRepo.findByEntity({
      tenantId: context.tenantId,
      entityType: context.entityType === 'job' ? 'Job' : context.entityType,
      entityId: context.entityId,
    });

    if (tasks.length === 0) return true;
    return tasks.every((t) => t.status === 'Completed' || t.status === 'Failed');
  }
}
