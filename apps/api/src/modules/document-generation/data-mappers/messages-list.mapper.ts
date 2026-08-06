import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { messages, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class MessagesListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.tenantId, params.tenantId)))
      .orderBy(desc(messages.createdAt))
      .limit(500);

    const items = rows.map((m) => ({
      subject: m.subject ?? '',
      created_at: formatDate(m.createdAt),
      acknowledgement_required: m.acknowledgementRequired ? 'Yes' : 'No',
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Messages Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
