import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { tasks, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class TaskMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, params.entityId), eq(tasks.tenantId, params.tenantId)));
    if (!task) throw new NotFoundException('Task not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    return {
      company_name: org?.name ?? '',
      task_name: task.name,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      due_date: formatDate(task.dueDate),
      completed_at: formatDate(task.completedAt),
      report_date: formatDate(new Date()),
    };
  }
}
