import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { rfqs, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class RfqsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.tenantId, params.tenantId)))
      .orderBy(desc(rfqs.createdAt))
      .limit(500);

    const items = rows.map((r) => ({
      rfq_number: r.rfqNumber ?? '',
      name: r.name ?? '',
      date: formatDate(r.sentDate),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'RFQs Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
