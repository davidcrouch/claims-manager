import { Injectable, Inject } from '@nestjs/common';
import { eq, and, asc, inArray, gte } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { appointments, jobs, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class ScheduleListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId?: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 7);

    const rows = await this.db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, params.tenantId),
          gte(appointments.startDate, windowStart),
        ),
      )
      .orderBy(asc(appointments.startDate))
      .limit(500);

    const jobIds = [
      ...new Set(
        rows
          .map((a) => a.jobId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const jobRows =
      jobIds.length > 0
        ? await this.db
            .select({
              id: jobs.id,
              name: jobs.name,
              externalReference: jobs.externalReference,
            })
            .from(jobs)
            .where(
              and(eq(jobs.tenantId, params.tenantId), inArray(jobs.id, jobIds)),
            )
        : [];
    const jobsById = new Map(jobRows.map((j) => [j.id, j]));

    const items = rows.map((a) => {
      const job = a.jobId ? jobsById.get(a.jobId) : undefined;
      return {
        name: a.name,
        location: a.location ?? '',
        start_date: formatDate(a.startDate),
        end_date: formatDate(a.endDate),
        status: a.status ?? '',
        job_name: job?.name ?? '',
        job_reference: job?.externalReference ?? '',
      };
    });

    return {
      company_name: org?.name ?? '',
      report_title: 'Schedule',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
