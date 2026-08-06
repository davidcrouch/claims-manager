import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { appointments, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class AppointmentsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(appointments)
      .where(and(eq(appointments.tenantId, params.tenantId)))
      .orderBy(desc(appointments.startDate))
      .limit(500);

    const items = rows.map((a) => ({
      name: a.name,
      location: a.location ?? '',
      start_date: formatDate(a.startDate),
      end_date: formatDate(a.endDate),
      status: a.status ?? '',
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Appointments Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
