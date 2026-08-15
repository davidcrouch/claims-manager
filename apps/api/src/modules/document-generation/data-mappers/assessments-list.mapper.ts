import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { assessments, jobs, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class AssessmentsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId?: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.tenantId, params.tenantId),
          isNull(assessments.deletedAt),
        ),
      )
      .orderBy(desc(assessments.createdAt))
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
        status: a.status,
        job_name: job?.name ?? '',
        job_reference: job?.externalReference ?? '',
        created_at: formatDate(a.createdAt),
      };
    });

    return {
      company_name: org?.name ?? '',
      report_title: 'Assessments Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
