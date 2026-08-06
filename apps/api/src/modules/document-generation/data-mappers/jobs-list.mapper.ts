import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { jobs, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class JobsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.tenantId, params.tenantId), isNull(jobs.deletedAt)))
      .orderBy(desc(jobs.createdAt))
      .limit(500);

    const items = rows.map((j) => ({
      name: j.name ?? '',
      reference: j.externalReference ?? j.externalJobId ?? '',
      request_date: formatDate(j.requestDate),
      suburb: j.addressSuburb ?? '',
      state: j.addressState ?? '',
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Jobs Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
