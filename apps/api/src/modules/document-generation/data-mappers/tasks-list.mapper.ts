import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { tasks, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class TasksListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.tenantId, params.tenantId)))
      .orderBy(desc(tasks.createdAt))
      .limit(500);

    const items = rows.map((t) => ({
      name: t.name,
      status: t.status,
      priority: t.priority,
      due_date: formatDate(t.dueDate),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Tasks Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
