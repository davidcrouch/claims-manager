import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { journals, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class JournalsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(journals)
      .where(and(eq(journals.tenantId, params.tenantId), isNull(journals.deletedAt)))
      .orderBy(desc(journals.createdAt))
      .limit(500);

    const items = rows.map((j) => ({
      name: j.name,
      status: j.status,
      suburb: j.addressSuburb ?? '',
      state: j.addressState ?? '',
      created_at: formatDate(j.createdAt),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Journals Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
