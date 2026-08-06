import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { workOrders, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate, formatCurrency } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class WorkOrdersListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.tenantId, params.tenantId), isNull(workOrders.deletedAt)))
      .orderBy(desc(workOrders.createdAt))
      .limit(500);

    const items = rows.map((w) => ({
      wo_number: w.workOrderNumber ?? '',
      name: w.name ?? '',
      start_date: formatDate(w.startDate),
      total_amount: formatCurrency(w.totalAmount),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Work Orders Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
