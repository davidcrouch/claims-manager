import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { appointments, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class AppointmentMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [appt] = await this.db
      .select()
      .from(appointments)
      .where(and(eq(appointments.id, params.entityId), eq(appointments.tenantId, params.tenantId)));
    if (!appt) throw new NotFoundException('Appointment not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    return {
      company_name: org?.name ?? '',
      appointment_name: appt.name,
      location: appt.location ?? '',
      start_date: formatDate(appt.startDate),
      end_date: formatDate(appt.endDate),
      status: appt.status ?? '',
      report_date: formatDate(new Date()),
    };
  }
}
